# Stash ↔️ Local Sync Plan

## Objectives
- Cache essential performer, tag, and scene metadata locally so the app can power richer marker-search experiences without repeatedly querying Stash on-demand.
- Preserve Stash as the single source of truth. Local copies must stay read-only and be refreshable at any time from Stash.
- Ship an explicit, manual sync trigger first; design the flow so we can bolt on automated or scheduled syncs later without rework.

## Data Model Additions

> All tables live in the existing Postgres database. Every record stores the Stash ID as the primary key so we can upsert efficiently and highlight the upstream ownership.

### Performers
- **Table**: `stash_performers`
- **Fields**: `id` (PK, Stash performer ID), `name`, `gender`, `imagePath`, `stashUpdatedAt`, `syncedAt`
- **Indexes**: `name` (text search), optional `gender`
- **Notes**:
  - Populate `stashUpdatedAt` from the GraphQL `updated_at` field; use it as the incremental sync high-water mark.
  - No nullable image files should break the sync; store empty strings as `null`.

### Tags
- **Table**: `stash_tags`
- **Fields**: `id` (PK), `name`, `stashUpdatedAt`, `syncedAt`
- **Parent Relationships**: separate join table `stash_tag_parents (childId, parentId, syncedAt)` so we can support multiple parents.
- **Indexes**: `name` (case-insensitive unique), `parentId`
- **Notes**:
  - Keep only the minimal fields the UI needs for filtering/grouping today; we can extend later if required.
  - Mirror `updated_at` for tags as well so incremental syncs cover taxonomy changes.

### Scenes
- **Table**: `stash_scenes`
- **Fields**: `id` (PK), `title`, `date`, `details`, `filesize`, `duration`, `stashUpdatedAt`, `syncedAt`
- **Relationships**:
  - `stash_scene_performers (sceneId, performerId, syncedAt)`
  - `stash_scene_tags (sceneId, tagId, syncedAt)`
- **Indexes**: `date`, `filesize`, `duration`, plus composite indexes on `sceneId` in the join tables.
- **Notes**:
  - Stash returns `filesize`/`duration` alongside `count`; persist them to support UI filtering without extra joins.
  - Store `details` as text for keyword searches.

### Read-only Guarantees
- Do **not** expose CRUD routes for these tables.
- Consider Prisma middleware or database-level triggers that raise on INSERT/UPDATE outside the sync code path if edits ever become a risk.
- Surface a prominent warning in the Prisma schema comments and TypeScript types so future contributors understand the constraint.

### GraphQL Fields Required
- Performers: `id`, `name`, `gender`, `image_path`, `updated_at`
- Tags: `id`, `name`, `parents { id }`, `updated_at`
- Scenes: `id`, `title`, `date`, `details`, `filesize`, `duration`, `performers { id }`, `tags { id }`, `updated_at`

## Sync Flow

### Fetch Strategy
1. Instantiate `StashappService` with the current config (reuses existing `applyConfig` logic).
2. For each entity (performers, tags, scenes):
   - Look up the entity’s stored high-water mark (`max(stashUpdatedAt)`), defaulting to the Unix epoch (`1970-01-01T00:00:00Z`) for the first sync.
   - Request pages with `sort: "updated_at"` and `direction: "ASC"` so older rows arrive first.
   - Skip rows where `updated_at` is older than the stored high-water mark; process rows with equal timestamps to remain idempotent when multiple updates share the same second.
   - Continue fetching pages until you encounter a page where every row has `updated_at <= highWaterMark`, or until Stash reports no more results.
   - Log progress per page for observability.
   - Normalize Stash IDs to integers before persistence.
3. Upsert rows:
   - Use `prisma.<table>.upsert({ where: { id }, update: {..., stashUpdatedAt, syncedAt: now }, create: {..., stashUpdatedAt, syncedAt: now } })`.
   - Replace relationship join rows for the entity inside a transaction (delete existing → bulk insert latest).
   - Track the maximum `stashUpdatedAt` observed per batch and commit it as the new high-water mark before fetching the next page.
4. Optionally prune stale records (e.g., performers no longer returned). Start with **soft retention** (mark `isStale=true`) so we can debug before hard deletes.

### Manual Trigger (MVP)
- Add a Next.js API route: `POST /api/sync/stash`.
  - Body accepts `{ entities: ["performers","tags","scenes"] }` (default all) to limit scope.
  - Returns summary counts (`fetched`, `upserted`, `staleMarked`).
  - Enforce a simple mutex (e.g., advisory lock or `sync_jobs` row with `in_progress`) to avoid concurrent runs.
- Provide a script alias (`npm run sync:stash`) that issues the POST request (or invokes the underlying sync module directly via `ts-node`).
- Log results to the server console and optionally persist to a `stash_sync_runs` table for later auditing.

### Future Automation Hooks
- Cron-compatible entry point (Next.js Route Handler + Vercel cron, or local cron hitting the same API).
- `sync_jobs` table storing `id`, `entity`, `startedAt`, `finishedAt`, `status`, `errorMessage`.
- On automation, re-use the same high-water mark strategy; add a small overlap window (e.g., subtract one minute) before fetching so transient clock skew or simultaneous updates are still captured.

## UI & Developer Experience
- Expose a Settings screen action “Sync Stash Metadata” that calls the API endpoint and shows progress/toasts.
- Update developer docs (README + onboarding) to note:
  - Sync must run at least once before marker-slot search features appear.
  - Local tables are read-only mirrors.
- Plan for caching layers:
  - Redux slices (or RTK Query) should consume the local DB via existing `/api` routes instead of hitting Stash directly once the mirror exists.

## Open Questions / Follow-ups
- Confirm whether we need to store performer aliases or additional tag metadata sooner than later.
- Determine retention for scenes that leave Stash—do we delete locally or mark as archived?
- Evaluate the performance impact of full refreshes with large libraries; consider batching and rate limiting.
- Document recovery steps if a sync fails halfway (e.g., rerun is safe because of upserts).

## Next Steps
1. Design the Prisma schema updates (tables + indexes) and discuss naming conventions.
2. Implement shared sync module(s) that encapsulate the fetch → normalize → upsert pipeline per entity.
3. Build the manual API endpoint and CLI wrapper.
4. Draft the UI affordance for triggering syncs and surface last-sync timestamps.
5. Revisit automation once the manual path proves stable.
