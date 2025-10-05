# Shot Boundary Refactor Status

## Summary
- Removed the `MARKER_SHOT_BOUNDARY` tag usage from the Stashapp service and configuration.
- Introduced dedicated Redux actions/selectors for shot boundaries (`createShotBoundary`, `updateShotBoundary`, `deleteShotBoundary`, `selectShotBoundaries`).
- Reworked timeline components to accept shot boundaries separately instead of filtering markers by tag.
- Updated the scene page to call `createShotBoundary` directly rather than `createMarker` with a tag ID.
- Detached `isShotBoundaryMarker` checks from marker logic to fully separate tag-based flows.

## Outstanding Tasks
- Replace legacy field names (`seconds`, `end_seconds`, `primary_tag`, etc.) with the new shot boundary schema (`startTime`, `endTime`, metadata) across the scene page and timeline components.
- Update Redux selectors, hooks, and tests (`TimelineAxis.test.tsx`, `useMarkerOperations.ts`) to consume `ShotBoundary[]` instead of `SceneMarker[]` where appropriate.
- Remove any remaining deletion of video cut markers that targets Stashapp data; persistence now lives entirely in the local database.
- Refresh unit/integration tests to match the new architecture and add coverage for shot boundary CRUD flows.
- Document the new shot boundary workflow in user-facing docs and onboarding materials.
- Run `npx tsc --noEmit` regularly until the type errors introduced by the refactor are resolved.

## Current TypeScript Errors
Output from `npx tsc --noEmit` highlights the main gaps:
- `src/app/config/shot-boundary/page.tsx`: state initialization still expects the old shape.
- `src/app/marker/[sceneId]/page.tsx`: multiple usages assume marker fields such as `title`, `seconds`, and `primary_tag`; these need to read from shot boundary properties instead.
- `src/components/timeline-redux/TimelineAxis.tsx` and related tests: props and expectations must switch to `shotBoundaries` data rather than `markers`.
- `src/hooks/useMarkerOperations.ts`: references to `isShotBoundaryMarker` should be removed or replaced with the new actions.

Addressing the field name conversions should resolve most of the type errors observed above.
