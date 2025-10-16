# Migration Plan: Use Local Database Instead of StashappService

## Problem Statement

The application currently fetches tags, scenes, and performers from Stashapp via `StashappService` on every page load and in many operations. This causes:

1. **Performance issues**: Multiple GraphQL queries to Stashapp on every page load
2. **Server-side rendering blocked**: Cannot use Next.js RSC (React Server Components) because data fetching happens client-side
3. **Inconsistent data**: We have a local database with synced data (`stash_tags`, `stash_scenes`, `stash_performers`) but we're not using it
4. **Network overhead**: Every operation that needs tag/scene/performer data makes a GraphQL request

## Current State Analysis

### Database Schema (Already Exists)

We already have synced tables in PostgreSQL:

- `stash_tags` - Cached tags with parent/child relationships
- `stash_scenes` - Cached scenes with metadata
- `stash_performers` - Cached performers with gender info
- `stash_scene_tags` - Many-to-many relationship
- `stash_scene_performers` - Many-to-many relationship
- `stash_tag_parents` - Tag hierarchy

These tables are marked as READ-ONLY caches, populated via sync operations.

### Current StashappService Usage

Based on code analysis, here are all the places using `StashappService` for data that should come from local DB:

#### 1. **API Routes**

- [src/app/api/markers/route.ts:145-147](src/app/api/markers/route.ts#L145-L147) - `GET /api/markers`
  ```typescript
  const [scene, tagsResult] = await Promise.all([
    stashappService.getScene(sceneId),
    stashappService.getAllTags(),
  ]);
  ```
  **Impact**: Every marker load for a scene hits Stashapp twice

#### 2. **Redux Thunks in markerSlice**

- [src/store/slices/markerSlice.ts:195](src/store/slices/markerSlice.ts#L195) - `initializeMarkerPage`
  ```typescript
  const scene = await stashappService.getScene(sceneId);
  ```

- [src/store/slices/markerSlice.ts:231-232](src/store/slices/markerSlice.ts#L231-L232) - `initializeMarkerPage`
  ```typescript
  const [tagsResult, performersResult] = await Promise.all([
    stashappService.getAllTags(),
    stashappService.getAllPerformers(),
  ]);
  ```

- [src/store/slices/markerSlice.ts:439](src/store/slices/markerSlice.ts#L439) - `createMarker`
- [src/store/slices/markerSlice.ts:539](src/store/slices/markerSlice.ts#L539) - `updateMarkerTag`
- [src/store/slices/markerSlice.ts:749](src/store/slices/markerSlice.ts#L749) - `loadAvailableTags`
- [src/store/slices/markerSlice.ts:871](src/store/slices/markerSlice.ts#L871) - `duplicateMarker`
- [src/store/slices/markerSlice.ts:937](src/store/slices/markerSlice.ts#L937) - `mergeMarkers`
- [src/store/slices/markerSlice.ts:1019](src/store/slices/markerSlice.ts#L1019) - `splitMarker`

#### 3. **Hooks**

- [src/hooks/useMarkerOperations.ts:343](src/hooks/useMarkerOperations.ts#L343) - `getSceneTags`
- [src/hooks/useMarkerOperations.ts:354](src/hooks/useMarkerOperations.ts#L354) - `getAllTags`

#### 4. **Page Components**

- [src/app/marker/[sceneId]/page.tsx:434](src/app/marker/[sceneId]/page.tsx#L434) - `fetchTags`
- [src/app/marker/[sceneId]/page.tsx:752](src/app/marker/[sceneId]/page.tsx#L752) - `getSceneTags`

## Solution Architecture

### Phase 1: Create API Routes for Local Database Queries

Create new API routes that serve data from local database:

#### A. `/api/stash/tags` (GET)

**Purpose**: Replace `getAllTags()`

**Query**:
```typescript
const tags = await prisma.stashTag.findMany({
  include: {
    parents: {
      include: {
        parent: {
          include: {
            parents: {
              include: { parent: true }
            }
          }
        }
      }
    },
    children: {
      include: {
        child: true
      }
    }
  },
  orderBy: { syncedAt: 'desc' }
});
```

**Response Format**: Match `TagsResponse` from StashappService
```typescript
{
  findTags: {
    count: number;
    tags: Tag[];
  }
}
```

#### B. `/api/stash/scenes/[sceneId]` (GET)

**Purpose**: Replace `getScene(sceneId)`

**Query**:
```typescript
const scene = await prisma.stashScene.findUnique({
  where: { id: parseInt(sceneId) },
  include: {
    tags: {
      include: { tag: true }
    },
    performers: {
      include: { performer: true }
    }
  }
});
```

**Response Format**: Match `Scene` from StashappService

#### C. `/api/stash/performers` (GET)

**Purpose**: Replace `getAllPerformers()`

**Query**:
```typescript
const performers = await prisma.stashPerformer.findMany({
  orderBy: { name: 'asc' }
});
```

**Response Format**: Match `PerformersResponse` from StashappService

#### D. `/api/stash/scenes/[sceneId]/tags` (GET)

**Purpose**: Replace `getSceneTags(sceneId)`

**Query**:
```typescript
const sceneTags = await prisma.stashSceneTag.findMany({
  where: { sceneId: parseInt(sceneId) },
  include: { tag: true }
});
```

**Response Format**: Array of tags

### Phase 2: Migrate API Routes

Replace StashappService calls in API routes with local database queries:

#### File: `src/app/api/markers/route.ts`

**Current** (lines 144-148):
```typescript
// Fetch scene and tags from Stashapp for enrichment
const [scene, tagsResult] = await Promise.all([
  stashappService.getScene(sceneId),
  stashappService.getAllTags(),
]);
```

**Replace with**:
```typescript
// Fetch scene and tags from local database for enrichment
const [sceneResponse, tagsResponse] = await Promise.all([
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stash/scenes/${sceneId}`),
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stash/tags`),
]);

const scene = await sceneResponse.json();
const tagsResult = await tagsResponse.json();
```

Or directly query Prisma in the API route:
```typescript
const [scene, tagsResult] = await Promise.all([
  prisma.stashScene.findUnique({
    where: { id: parseInt(sceneId) },
    include: { tags: { include: { tag: true } }, performers: { include: { performer: true } } }
  }),
  prisma.stashTag.findMany({ include: { parents: true, children: true } })
]);
```

**Preferred approach**: Direct Prisma queries in API routes (faster, no HTTP overhead)

### Phase 3: Migrate Redux Thunks

Update all thunks in `markerSlice.ts` to use new API routes or direct DB queries:

#### `initializeMarkerPage` (lines 190-253)

**Current**:
```typescript
const scene = await stashappService.getScene(sceneId);
// ...
const [tagsResult, performersResult] = await Promise.all([
  stashappService.getAllTags(),
  stashappService.getAllPerformers(),
]);
```

**Replace with**: API route calls
```typescript
const sceneResponse = await fetch(`/api/stash/scenes/${sceneId}`);
const scene = await sceneResponse.json();
// ...
const [tagsResponse, performersResponse] = await Promise.all([
  fetch('/api/stash/tags'),
  fetch('/api/stash/performers'),
]);
const tagsResult = await tagsResponse.json();
const performersResult = await performersResponse.json();
```

#### Other thunks using `getAllTags()`

Create a helper function to fetch tags:
```typescript
async function fetchTagsFromLocalDB() {
  const response = await fetch('/api/stash/tags');
  return response.json();
}
```

Use this helper in:
- `createMarker` (line 439)
- `updateMarkerTag` (line 539)
- `loadAvailableTags` (line 749)
- `duplicateMarker` (line 871)
- `mergeMarkers` (line 937)
- `splitMarker` (line 1019)

### Phase 4: Migrate Client-Side Code

#### File: `src/app/marker/[sceneId]/page.tsx`

**Current** (line 432-444):
```typescript
const fetchTags = useCallback(async () => {
  try {
    const result = await stashappService.getAllTags();
    dispatch(setAvailableTags(result.findTags.tags));
  } catch (err) {
    console.error("Error fetching tags:", err);
    dispatch(setError(`Failed to fetch tags: ${err}`));
  }
}, [dispatch]);
```

**Replace with**:
```typescript
const fetchTags = useCallback(async () => {
  try {
    const response = await fetch('/api/stash/tags');
    const result = await response.json();
    dispatch(setAvailableTags(result.findTags.tags));
  } catch (err) {
    console.error("Error fetching tags:", err);
    dispatch(setError(`Failed to fetch tags: ${err}`));
  }
}, [dispatch]);
```

#### File: `src/hooks/useMarkerOperations.ts`

Similar replacements for:
- Line 343: `getSceneTags` → `/api/stash/scenes/${sceneId}/tags`
- Line 354: `getAllTags` → `/api/stash/tags`

### Phase 5: Server-Side Rendering Migration

Convert `src/app/marker/[sceneId]/page.tsx` to use Server Components for initial data fetch:

#### Current Structure
```
page.tsx (Client Component)
  ↓
  useEffect → initializeMarkerPage thunk
  ↓
  Client-side API calls to Stashapp
```

#### New Structure
```
page.tsx (Server Component)
  ↓
  Direct Prisma queries at build time
  ↓
  Pass initial data as props to Client Component
  ↓
  MarkerPageClient (Client Component with Redux)
```

#### Implementation

**New file**: `src/app/marker/[sceneId]/MarkerPageClient.tsx`
- Move all client-side logic here (useState, useEffect, Redux, etc.)
- Accept initial data as props

**Modified file**: `src/app/marker/[sceneId]/page.tsx`
```typescript
import { prisma } from '@/lib/prisma';
import MarkerPageClient from './MarkerPageClient';

export default async function MarkerPage({
  params
}: {
  params: Promise<{ sceneId: string }>
}) {
  const { sceneId } = await params;

  // Fetch all data server-side in parallel
  const [scene, markers, tags, performers, shotBoundaries] = await Promise.all([
    prisma.stashScene.findUnique({
      where: { id: parseInt(sceneId) },
      include: {
        tags: { include: { tag: true } },
        performers: { include: { performer: true } }
      }
    }),
    prisma.marker.findMany({
      where: { stashappSceneId: parseInt(sceneId) },
      include: {
        additionalTags: true,
        markerSlots: { include: { slotDefinition: true } }
      }
    }),
    prisma.stashTag.findMany({
      include: { parents: true, children: true }
    }),
    prisma.stashPerformer.findMany(),
    prisma.shotBoundary.findMany({
      where: { stashappSceneId: parseInt(sceneId) }
    })
  ]);

  // Return client component with pre-fetched data
  return (
    <MarkerPageClient
      initialScene={scene}
      initialMarkers={markers}
      initialTags={tags}
      initialPerformers={performers}
      initialShotBoundaries={shotBoundaries}
    />
  );
}
```

**Benefits**:
- Fast initial page load (server-side rendering)
- SEO-friendly (if needed in future)
- Reduced client-side JavaScript
- Better performance on slow connections
- Data available at page paint time

### Phase 6: Testing & Validation

#### Test Cases

1. **Data Consistency**
   - [ ] Verify tags from local DB match Stashapp
   - [ ] Verify scenes from local DB match Stashapp
   - [ ] Verify performers from local DB match Stashapp
   - [ ] Test with fresh sync vs. stale sync

2. **Performance**
   - [ ] Measure page load time before/after
   - [ ] Measure time to first marker render
   - [ ] Check Network tab for eliminated Stashapp calls

3. **Functionality**
   - [ ] Marker creation with tags
   - [ ] Marker tag updates
   - [ ] Tag selector dropdown
   - [ ] Scene performer auto-assignment
   - [ ] All keyboard shortcuts still work

4. **Edge Cases**
   - [ ] Scene not found in local DB
   - [ ] Empty tags/performers
   - [ ] Sync operation while page is open

## Implementation Order

1. ✅ **Phase 1**: Create `/api/stash/tags`, `/api/stash/scenes/[sceneId]`, `/api/stash/performers` routes
   - Created `/api/stash/tags/route.ts` - Returns tags with parent/child relationships
   - Created `/api/stash/scenes/[sceneId]/route.ts` - Returns scene with tags and performers
   - Created `/api/stash/performers/route.ts` - Returns all performers
   - Created `/api/stash/scenes/[sceneId]/tags/route.ts` - Returns scene tags
2. ✅ **Phase 2**: Migrate `src/app/api/markers/route.ts` to use local DB
   - Replaced `stashappService.getScene()` with direct Prisma query to `stashScene`
   - Replaced `stashappService.getAllTags()` with direct Prisma query to `stashTag`
   - Replaced `stashappService.getPerformer()` with direct Prisma query to `stashPerformer`
   - Removed unused imports (StashappService, AppConfig, fs, path)
   - Removed unused `loadConfig()` function
3. ✅ **Phase 3**: Migrate Redux thunks in `markerSlice.ts`
   - Replaced `stashappService.getScene()` in `initializeMarkerPage` with `/api/stash/scenes/${sceneId}`
   - Replaced `stashappService.getAllTags()` in `initializeMarkerPage` with `/api/stash/tags`
   - Replaced `stashappService.getAllPerformers()` in `initializeMarkerPage` with `/api/stash/performers`
   - Replaced `stashappService.getAllTags()` in `createMarker` with `/api/stash/tags`
   - Replaced `stashappService.getAllTags()` in `updateMarkerTag` with `/api/stash/tags`
   - Replaced `stashappService.getAllTags()` in `loadAvailableTags` with `/api/stash/tags`
   - Replaced `stashappService.getAllTags()` in `duplicateMarker` with `/api/stash/tags`
   - Replaced `stashappService.getAllTags()` in `mergeMarkers` with `/api/stash/tags`
   - Replaced `stashappService.getAllTags()` in `splitMarker` with `/api/stash/tags`
   - Note: Kept `stashappService` for config values (marker status/source tags) and business logic methods
4. ✅ **Phase 4**: Migrate client-side code in page component and hooks
   - Replaced `stashappService.getAllTags()` in `src/app/marker/[sceneId]/page.tsx` with `/api/stash/tags`
   - Replaced `stashappService.getSceneTags()` in `src/app/marker/[sceneId]/page.tsx` with `/api/stash/scenes/${sceneId}/tags`
   - Replaced `stashappService.getSceneTags()` in `src/hooks/useMarkerOperations.ts` with `/api/stash/scenes/${sceneId}/tags`
   - Replaced `stashappService.getAllTags()` in `src/hooks/useMarkerOperations.ts` with `/api/stash/tags`
5. ✅ **Phase 4.5**: Eliminate duplicate API calls (architectural duplicates)
   - **Issue**: Noticed duplicate API calls in DevTools during page load - `/api/tags` (from searchSlice) and `/api/stash/tags` (from markerSlice) were both being called
   - **Root Cause Analysis**:
     - **First issue**: `page.tsx` had a separate `fetchTags()` callback with its own `useEffect` that duplicated the tag fetch already happening in `initializeMarkerPage` thunk
     - **Second issue**: `Timeline.tsx` component (used on marker page) was importing `loadAllTags()` from `searchSlice` and calling `/api/tags`, while marker page was already loading `/api/stash/tags`
     - **React Strict Mode duplication**: `reactStrictMode: true` in `next.config.js` causes all effects to run twice in development mode (this is expected behavior)
   - **Fixes Applied**:
     - Removed redundant `fetchTags()` callback and its `useEffect` from `src/app/marker/[sceneId]/page.tsx`
     - Removed unused imports: `stashappService`, `setAvailableTags` from page.tsx
     - Changed `Timeline.tsx` to use `selectAvailableTags` from `markerSlice` instead of `selectAllTags` from `searchSlice`
     - Removed `loadAllTags()` calls from `Timeline.tsx` (3 locations)
     - Removed `searchSlice` import from `Timeline.tsx`
     - Added documentation comment explaining Strict Mode behavior
   - **Result**:
     - **Eliminated `/api/tags` calls entirely** from marker page (only `/api/stash/tags` is now called)
     - Reduced network overhead: ~650 KB saved per page load (2x `/api/tags` calls eliminated)
     - All endpoints now fetch 2x in dev (Strict Mode only), 1x in production
     - Clean separation: search page uses `/api/tags`, marker page uses `/api/stash/tags`
   - **Note**: The 2x calls in development are **expected behavior** from React Strict Mode and help catch bugs. Production builds disable Strict Mode and will only call each endpoint once.
6. 🚧 **Phase 5**: Convert to Server Components for SSR
7. ⏳ **Phase 6**: Test and validate

## Rollback Plan

If issues arise:

1. **Immediate**: Keep StashappService code intact during migration (use feature flag if needed)
2. **Fallback**: Add environment variable `USE_LOCAL_DB=true/false` to toggle behavior
3. **Revert**: Git revert specific commits if data inconsistencies found

## Data Sync Requirements

**Important**: This migration assumes the local database is kept in sync with Stashapp. Need to verify:

1. Is there an existing sync script/process?
2. How often does sync run?
3. What happens if sync fails?
4. Should we show "last synced" timestamp in UI?

**TODO**: Document the sync process and ensure it's running regularly.

## Success Metrics

- **Performance**: Page load time reduced by >50%
- **Network**: Zero GraphQL calls to Stashapp for tags/scenes/performers
- **Reliability**: No data inconsistencies reported
- **Developer Experience**: Faster local development (no Stashapp dependency for basic features)

## Notes

- Keep `StashappService` for operations that truly need real-time Stashapp data (marker export, import, etc.)
- Consider adding cache invalidation strategy if sync is infrequent
- May need to add "Refresh from Stashapp" button if users want latest data
- This migration is about read operations; write operations still go through Stashapp eventually (export step)
