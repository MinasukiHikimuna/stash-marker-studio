# Technical Debt

This document tracks known refactoring opportunities and technical debt in the Stash Marker Studio codebase.

## High Priority (Security/Correctness)

### 1. Add Request Validation to API Routes

**Issue**: API routes use manual validation with incomplete checks
**Impact**: Security risk, runtime errors, inconsistent validation
**Location**: All `/src/app/api/**/*.ts` files
**Example**:
```typescript
// Current approach in route.ts
if (!stashappSceneId || seconds === undefined) {
  return NextResponse.json({ error: 'stashappSceneId and seconds are required' }, { status: 400 });
}
```
**Solution**: Implement Zod schemas for request validation
```typescript
const createMarkerSchema = z.object({
  stashappSceneId: z.string(),
  seconds: z.number(),
  // ... other fields
});
```

### 2. Standardize Error Handling Across API Routes

**Issue**: Inconsistent error response formats - some return `{ error: string }`, others throw, some return detailed errors
**Impact**: Frontend can't reliably handle errors, poor user experience
**Location**: All API routes
**Solution**: Create standard error response format
```typescript
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
};
```

### 3. Add Tests for Critical Paths

**Issue**: Major features have zero test coverage
**Impact**: High risk of regressions, difficult to refactor safely
**Missing Tests**:
- `useDynamicKeyboardShortcuts.ts` (593 lines) - **NO TESTS**
- `useMarkerOperations.ts` (483 lines) - **NO TESTS**
- `useMarkerNavigation.ts` (698 lines) - **NO TESTS**
- `useTimelineZoom.ts` - **NO TESTS**
- `useVideoControls.ts` - **NO TESTS**
- All API routes - **NO TESTS**
- `StashappService.ts` (1,415 lines) - **NO TESTS**

**Solution**: Add Jest tests with Redux store mocking for hooks, integration tests for API routes

### 4. Fix Type Safety Issues

**Issue**: Using index signatures instead of proper types loses type safety
**Impact**: Runtime errors, loss of IDE autocomplete, harder to refactor
**Locations**:
- [useDynamicKeyboardShortcuts.ts:35](src/hooks/useDynamicKeyboardShortcuts.ts#L35)
  ```typescript
  incorrectMarkers: { markerId: string; [key: string]: unknown }[];
  availableTags: { id: string; name: string; [key: string]: unknown }[] | null;
  ```
- [useMarkerNavigation.ts:42](src/hooks/useMarkerNavigation.ts#L42)
  ```typescript
  tagGroups: { name: string; [key: string]: unknown }[];
  ```

**Solution**: Use proper imported types (`IncorrectMarker`, `Tag`, `TagGroup`)

## Medium Priority (Maintainability)

### 5. Split StashappService.ts (1,415 lines)

**Issue**: God object handling GraphQL, VTT parsing, URL transformations, tag management, performer management
**Impact**: Single Responsibility Principle violation, hard to test individual features
**Location**: [src/services/StashappService.ts](src/services/StashappService.ts)
**Solution**: Extract into focused services:
- `GraphQLService` - Base query/mutation functionality
- `SpriteService` - VTT parsing and sprite handling
- `TagService` - Tag operations
- `PerformerService` - Performer operations
- Keep `StashappService` as facade coordinating these services

### 6. Split markerSlice.ts (1,755 lines)

**Issue**: Monolithic slice combining UI state, video state, operations, filters, async thunks
**Impact**: Difficult to maintain, test, and understand
**Location**: [src/store/slices/markerSlice.ts](src/store/slices/markerSlice.ts)
**Solution**:
- Split into `markerDataSlice`, `markerUISlice`, `videoSlice`
- Move async thunks to separate `markerThunks.ts` file
- Create focused selector files per domain

### 7. Extract Config Loading Duplication

**Issue**: Every API route loads config and creates StashappService instance identically
**Impact**: DRY violation, maintenance burden when config loading changes
**Location**: 10+ API route files
**Example**:
```typescript
// Duplicated pattern across multiple files
const config = await loadConfig();
const stashappService = new StashappService();
stashappService.applyConfig(config);
```
**Solution**: Create `getStashappService()` helper in `/src/lib/stashappService.ts`

### 8. Create Repository Layer for Database Access

**Issue**: Direct Prisma queries in route handlers
**Impact**: Hard to test, hard to add business logic, hard to add caching
**Location**: All API routes with database access
**Solution**:
- Create `MarkerRepository` class
- Create `ShotBoundaryRepository` class
- Move all Prisma queries to repositories
- Makes testing and caching easier

### 9. Refactor marker/[sceneId]/page.tsx (1,398 lines)

**Issue**: Massive page component with too much state management, business logic, and UI coordination
**Impact**: Difficult to test, modify, or reuse logic
**Location**: [src/app/marker/[sceneId]/page.tsx](src/app/marker/[sceneId]/page.tsx)
**Solution**:
- Extract business logic into custom hooks (partially done but needs completion)
- Split into smaller sub-components (header, video section, timeline section)
- Move shot boundary logic to dedicated hook
- Move marker CRUD operations to dedicated hook

### 10. Split Large Hooks Using Command Pattern

**Issue**: Massive hooks with 50+ inline action handlers
**Impact**: Hard to test individual features, difficult to modify
**Locations**:
- [useDynamicKeyboardShortcuts.ts](src/hooks/useDynamicKeyboardShortcuts.ts) (593 lines)
- [useMarkerNavigation.ts](src/hooks/useMarkerNavigation.ts) (698 lines)
- [useMarkerOperations.ts](src/hooks/useMarkerOperations.ts) (483 lines)

**Solution**:
- Extract action handlers to separate command objects/classes
- Use command pattern for better testability
- Consider separating modal shortcuts from main shortcuts
- Extract pure functions to `/src/core/marker/` for navigation logic

## Lower Priority (Performance & Polish)

### 11. Implement Virtualization for MarkerList

**Issue**: Renders all markers without virtualization
**Impact**: Performance degrades with 100+ markers
**Location**: [src/components/marker/MarkerList.tsx](src/components/marker/MarkerList.tsx)
**Solution**: Implement React Virtual or similar library

### 12. Create BaseModal Component

**Issue**: Each modal implements its own shell (backdrop, dialog, buttons)
**Impact**: Code duplication, inconsistent UX
**Location**: `CompletionModal`, `DeleteRejectedModal`, `CorrespondingTagConversionModal`
**Solution**: Extract common modal shell into `BaseModal` component

### 13. Add Reselect for Memoized Selectors

**Issue**: Selectors create new arrays/objects on every call
**Impact**: Causes unnecessary re-renders
**Location**: [src/store/slices/markerSlice.ts](src/store/slices/markerSlice.ts) selectors
**Example**:
```typescript
export const selectRejectedMarkers = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'deleteRejected' ? state.marker.ui.modal.data.rejectedMarkers : [];
```
**Solution**: Use reselect library for memoized selectors

### 14. Fix State Duplication Between Local and Redux

**Issue**: Local state for editing when Redux has `ui.isEditingMarker`
**Impact**: Multiple sources of truth, easy to get out of sync
**Location**: [src/app/marker/[sceneId]/page.tsx](src/app/marker/[sceneId]/page.tsx)
**Example**:
```typescript
const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
const [editingTagId, setEditingTagId] = useState<string>("");
```
**Solution**: Move all editing state to Redux or remove from Redux (choose one source of truth)

### 15. Complete VideoPlayer Refactoring

**Issue**: Temporary videoElementRef still used in page component
**Impact**: Incomplete refactoring, coupling between components
**Location**: [src/app/marker/[sceneId]/page.tsx:89](src/app/marker/[sceneId]/page.tsx#L89)
**Comment**: "Temporary ref for video element compatibility - can be removed when VideoPlayer fully handles all video interactions"
**Solution**: Complete VideoPlayer refactor to expose all needed video controls

## Additional Issues by Category

### Component Structure

#### Split MarkerGroupSettings.tsx (755 lines)
**Location**: [src/components/settings/MarkerGroupSettings.tsx](src/components/settings/MarkerGroupSettings.tsx)
**Issue**: Handles marker group list, editing, child tag management, sorting
**Solution**: Extract `MarkerGroupList`, `MarkerGroupEditor`, `ChildTagManager` components

#### Split KeyboardShortcutsSettings.tsx (328 lines)
**Location**: [src/components/settings/KeyboardShortcutsSettings.tsx](src/components/settings/KeyboardShortcutsSettings.tsx)
**Issue**: Manages shortcut display and editing in one component
**Solution**: Extract `ShortcutItem` and `ShortcutEditor` components

#### Split Timeline.tsx (766 lines)
**Location**: [src/components/timeline-redux/Timeline.tsx](src/components/timeline-redux/Timeline.tsx)
**Issue**: Complex component managing state, calculations, scrolling, and rendering
**Solution**: Extract scroll synchronization logic into custom hook, extract swimlane calculations

### Performance Concerns

#### Unnecessary Re-renders
**Location**: [src/app/marker/[sceneId]/page.tsx](src/app/marker/[sceneId]/page.tsx)
**Issue**: Multiple inline function definitions that change every render
**Solution**: Audit dependency arrays, use useCallback consistently

#### Computed State in Local State
**Location**: [src/app/marker/[sceneId]/page.tsx](src/app/marker/[sceneId]/page.tsx)
**Issue**: `tagGroups` and `markersWithTracks` stored in state but computed from markers
**Solution**: Move to Redux selectors or compute with useMemo

#### Props Drilling
**Location**: `page.tsx` → `MarkerList` → `MarkerListItem`
**Issue**: Passing `availableTags`, `incorrectMarkers`, `videoElementRef` through multiple levels
**Solution**: Use Redux selectors in leaf components, consider React Context for video ref

### Service Layer

#### Mutable Service Configuration
**Location**: [src/services/StashappService.ts](src/services/StashappService.ts)
**Issue**: `applyConfig()` mutates service state after construction
**Solution**: Make config part of constructor, create factory function or use DI

#### Missing Request Transformation
**Location**: Multiple API routes
**Issue**: Complex marker transformation from DB to SceneMarker format duplicated
**Solution**: Extract to `/src/lib/markerTransformers.ts` with `dbMarkerToSceneMarker()` helper

### Testing Gaps

#### Untestable Code Patterns
**Issue**: Direct DOM manipulation makes testing difficult
**Example**: `videoElementRef.current?.play();`
**Solution**: Abstract video operations behind interface

#### Inline Business Logic
**Location**: [src/app/marker/[sceneId]/page.tsx](src/app/marker/[sceneId]/page.tsx)
**Issue**: Complex shot boundary logic inline in component
**Solution**: Extract to testable functions in `/src/core/shotBoundary/`

### Naming and Conventions

#### Inconsistent Boolean Naming
**Issue**: Mix of `isLoading`, `loading`, `initialized` vs `isInitialized`
**Solution**: Always prefix booleans with `is`, `has`, `should`, `can`

#### Unclear Selector Names
**Example**: `selectConfirmedCorrespondingTagMarkers` (too long and unclear)
**Suggestion**: `selectMarkersForTagConversion`

#### Mixed Naming Conventions
**Issue**: `end_seconds` (snake_case from GraphQL) vs `endSeconds` (camelCase in local DB)
**Solution**: Transform at boundaries, use one convention internally

### Technical Debt

#### TODO: Show Error Message
**Location**: [src/components/settings/ShortcutCaptureInput.tsx:69](src/components/settings/ShortcutCaptureInput.tsx#L69)
**Solution**: Implement error display for invalid shortcuts

#### Incomplete Shot Boundary Source Usage
**Issue**: `source?: ShotBoundarySource` field not consistently used throughout codebase
**Solution**: Ensure all shot boundary operations properly set/update source field

#### Architecture Decision Comments
**Example**: "Note: Shot boundary marker filtering is now done in the component to avoid coupling reducer logic with service constants"
**Solution**: Document decision in architecture docs (CLAUDE.md), not code comments

## Refactoring Strategy

When addressing technical debt:

1. **Start with High Priority items** - They have security/correctness implications
2. **Add tests before refactoring** - Especially for complex logic being moved
3. **Refactor incrementally** - Don't try to fix everything at once
4. **One concern per commit** - Makes it easier to review and revert if needed
5. **Update this document** - Remove items as they're completed

## Notes

- The codebase is generally well-structured with good Redux patterns
- Main issues are **file size**, **missing tests**, and **type safety gaps**
- Many issues can be resolved by extracting logic into smaller, focused modules
- Test coverage should be added before major refactorings to prevent regressions
