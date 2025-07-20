# Marker Page Redux Migration Plan

## Overview

This plan outlines the step-by-step migration of the Marker page from React Context (`MarkerContext`) to Redux, following the established patterns from the Search page. The migration will be done incrementally to minimize disruption and ensure stability. This file must be kept up-to-date when proceeding with the plan. Always check after completing a checkbox if a git commit should be made.

## Current State Analysis

### MarkerContext State (42+ properties)

- **Core Data**: markers, availableTags, sceneId, sceneTitle, scene
- **UI State**: 20+ boolean flags for modals, editing states, operations
- **Video State**: videoDuration, currentVideoTime, videoElement
- **Temporary State**: Various editing fields, time selections, clipboard data
- **Filter State**: filteredSwimlane, incorrectMarkers
- **Loading/Error**: isLoading, error

### Components Using MarkerContext (8 components)

- MarkerLayout, MarkerList, MarkerHeader, MarkerItem
- VideoPlayer, MarkerSummary, Timeline, main marker page

### Async Operations (handled in custom hooks)

- `useMarkerOperations`: CRUD operations, bulk operations
- `useMarkerKeyboardShortcuts`: Keyboard interaction logic

## Migration Strategy

### Phase 1: Redux Slice Setup

**Goal**: Create the foundation without breaking existing functionality

#### Step 1.1: Create Marker Slice Structure ✅ COMPLETED

- [x] Create `src/store/slices/markerSlice.ts`
- [x] Define TypeScript interfaces for marker state
- [x] Set up initial state structure following search slice patterns
- [x] Create basic sync actions (setters, UI state toggles)

#### Step 1.2: Add to Store Configuration ✅ COMPLETED

- [x] Update `src/store/index.ts` to include marker reducer
- [x] Ensure type safety with updated `RootState` type
- [x] Test that store setup doesn't break existing search functionality

### Phase 2: Async Operations Migration ✅ COMPLETED

**Goal**: Move complex operations from custom hooks to Redux thunks

#### Step 2.1: Core CRUD Operations ✅ COMPLETED

- [x] Create async thunks for:
  - `initializeMarkerPage`: Load scene, markers, and tags
  - `loadMarkers`: Fetch markers for current scene
  - `createMarker`: Create new marker with status handling
  - `updateMarker`: Update existing marker (updateMarkerTimes, updateMarkerTag)
  - `deleteMarker`: Delete marker with confirmations
  - `bulkUpdateMarkers`: Handle batch operations (deleteRejectedMarkers)
  - `confirmMarker`: Add confirmed status tag
  - `rejectMarker`: Add rejected status tag
  - `resetMarker`: Remove status tags

#### Step 2.2: Tag Operations ✅ COMPLETED

- [x] Create async thunks for:
  - `loadAvailableTags`: Fetch all available tags
  - `addTagToMarker`: Add tag to specific marker (same as updateMarkerTag)
  - `removeTagFromMarker`: Remove tag from marker (note: not needed - markers have one primary tag)
  - `convertAITags`: Convert AI tags to real tags
  - `findConfirmedAIMarkers`: Find AI markers ready for conversion

#### Step 2.3: Advanced Operations ✅ COMPLETED

- [x] Create async thunks for:
  - `duplicateMarker`: Create copy of existing marker
  - `mergeMarkers`: Combine multiple markers (placeholder implementation)
  - `splitMarker`: Split marker at current time (placeholder implementation)
  - `exportMarkers`: Export markers to various formats (placeholder implementation)

### Phase 3: Component Migration (Incremental)

**Goal**: Migrate components one by one to use Redux

#### Step 3.1: Core Data Components (Low Risk)

- [x] **MarkerSummary**: Simple read-only component ✅ COMPLETED
  - Update to use `useAppSelector` for marker counts
  - Remove MarkerContext dependency
- [x] **MarkerHeader**: Basic UI state management ✅ COMPLETED
  - Migrated to use Redux selectors (selectMarkers, selectScene, selectMarkerLoading, selectIncorrectMarkers)
  - Updated modal toggles to use Redux actions (setAIConversionModalOpen, setCollectingModalOpen, setGeneratingMarkers)
  - Replaced useMarkerOperations with direct Redux thunk dispatch (deleteRejectedMarkers)

#### Step 3.2: List Components (Medium Risk)

- [x] **MarkerList**: Main list rendering ✅ COMPLETED
  - Updated to use Redux selectors (selectMarkers, selectFilteredSwimlane, selectSelectedMarkerId)
  - Replaced useMarker hook with useAppSelector
  - Maintained scroll-to-selected functionality
- [x] **MarkerItem**: Individual marker rendering ✅ COMPLETED
  - Updated to use Redux selectors (selectVideoElement) and actions (setSelectedMarkerId)
  - Removed MarkerContext dependency and replaced with useAppDispatch/useAppSelector
  - Maintained all existing functionality including marker selection and video seeking

#### Step 3.3: Complex Components (High Risk)

- [ ] **VideoPlayer**: Video state management
  - Migrate video time and duration to Redux
  - Handle video element reference carefully
- [ ] **Timeline**: Complex visualization component
  - Update to use Redux selectors for timeline data
  - Ensure performance with proper memoization

#### Step 3.4: Layout Components (Final)

- [ ] **MarkerLayout**: Page-level component
  - Update initialization logic to use Redux thunks
  - Remove MarkerProvider wrapper
- [ ] **Main Marker Page**: Root component
  - Replace useMarker hook calls with Redux hooks
  - Update error handling to use Redux error state

### Phase 4: Custom Hooks Migration

**Goal**: Refactor or eliminate custom hooks that handle state

#### Step 4.1: useMarkerOperations

- [ ] Move async logic to Redux thunks (already done in Phase 2)
- [ ] Convert to simple utility functions for complex operations
- [ ] Update components to use Redux dispatch directly

#### Step 4.2: useMarkerKeyboardShortcuts

- [ ] Keep as custom hook but update to use Redux dispatch
- [ ] Migrate keyboard state to Redux if needed
- [ ] Ensure keyboard shortcuts work with new Redux actions

### Phase 5: Cleanup and Optimization

**Goal**: Remove old code and optimize performance

#### Step 5.1: Remove Context Implementation

- [ ] Delete `src/contexts/MarkerContext.tsx`
- [ ] Remove MarkerProvider from component tree
- [ ] Update imports across all components

#### Step 5.2: Performance Optimization

- [ ] Add proper selectors with memoization
- [ ] Optimize re-rendering with `useAppSelector`
- [ ] Add middleware for logging/debugging if needed

#### Step 5.3: Testing and Validation

- [ ] Update existing tests to work with Redux
- [ ] Add Redux-specific tests for new thunks and selectors
- [ ] Verify all keyboard shortcuts still work
- [ ] Test error handling and loading states

## Technical Implementation Details

### State Structure Design

```typescript
interface MarkerState {
  // Core data
  markers: MarkerWithTags[];
  scene: SceneWithMarkers | null;
  availableTags: Tag[];

  // UI state - group related flags
  ui: {
    modals: {
      editModal: boolean;
      deleteModal: boolean;
      bulkEditModal: boolean;
      // ... other modals
    };
    editing: {
      isEditing: boolean;
      editingMarkerId: string | null;
      // ... editing state
    };
  };

  // Video state
  video: {
    duration: number | null;
    currentTime: number;
    element: HTMLVideoElement | null;
  };

  // Filters and temporary state
  filters: {
    filteredSwimlane: string | null;
    incorrectMarkers: boolean;
  };

  // Async state
  loading: boolean;
  error: string | null;
  initialized: boolean;
}
```

### Async Thunk Patterns

Follow search slice patterns:

- Use `createAsyncThunk` for all async operations
- Include proper TypeScript typing
- Handle loading/error states consistently
- Return normalized data when possible

### Migration Safety

- **Backward Compatibility**: Keep context running during migration
- **Feature Flags**: Use environment variables to toggle Redux usage
- **Rollback Plan**: Maintain ability to revert to context if issues arise
- **Testing**: Thorough testing at each phase before proceeding

## Risk Assessment

### Low Risk Steps

- Creating slice structure
- Migrating read-only components
- Adding to store configuration

### Medium Risk Steps

- Migrating list components
- Moving async operations to thunks
- Updating keyboard shortcuts

### High Risk Steps

- Migrating video player state
- Timeline component updates
- Removing context entirely

## Success Criteria

- [ ] All marker functionality works identically to current implementation
- [ ] No performance regressions
- [ ] All keyboard shortcuts function correctly
- [ ] Error handling maintains current behavior
- [ ] Tests pass with new Redux implementation
- [ ] Code follows established Redux patterns from search page

## Timeline Estimate

- **Phase 1**: 2-3 days (slice setup and store integration)
- **Phase 2**: 3-4 days (async operations migration)
- **Phase 3**: 4-5 days (component migration, incremental)
- **Phase 4**: 2-3 days (custom hooks refactoring)
- **Phase 5**: 1-2 days (cleanup and optimization)

**Total**: 12-17 days (2-3 weeks)

## Phase 1 Implementation Notes & Findings

### ✅ Completed Successfully (Commit: e8ba629)

**Key Implementation Decisions:**

1. **State Organization**: Organized 42+ MarkerContext properties into logical groups:

   - `ui.modals`: All modal states (8 boolean flags)
   - `ui.editing`: Temporary editing state and form fields
   - `ui.selectedMarkerId`: Primary selection mechanism
   - `video`: Duration, currentTime, element reference
   - `operations`: Background operations (generation, AI conversion, etc.)
   - `filters`: Display filtering state

2. **HTMLVideoElement Handling**: Resolved Redux serialization issue by:

   - Adding `ignoredPaths: ['marker.video.element']` to store config
   - Using `current()` helper in setVideoElement reducer for proper immer handling
   - No `any` types or ESLint rule disabling required

3. **Pattern Consistency**: Followed search slice patterns for:
   - Async thunk structure with pending/fulfilled/rejected states
   - Selector naming conventions (`selectMarkerX`)
   - Action naming patterns (`setX`, `clearError`, `resetState`)

### Critical Findings for Next Phases

**MarkerContext Analysis:**

- 42+ state properties across 8 components (MarkerLayout, MarkerList, MarkerHeader, MarkerItem, VideoPlayer, MarkerSummary, Timeline, main page)
- Complex selection logic with shot boundary prevention (`MARKER_SHOT_BOUNDARY` filtering)
- Heavy use of temporary state for multi-step operations (duplicate, create, edit flows)

**Redux Store Integration:**

- Successfully integrated without breaking search functionality
- All tests pass, linting clean, build successful
- Type safety maintained with proper `RootState` updates

**Next Phase Readiness:**

- Basic slice structure ready for async thunk expansion
- Store configuration handles non-serializable DOM elements properly
- Foundation supports incremental component migration

## Phase 2 Implementation Notes & Findings

### ✅ Completed Successfully (Date: 2025-07-20)

**Key Implementation Decisions:**

1. **Comprehensive Async Thunk Coverage**: Implemented all core CRUD operations with proper error handling:

   - Full initialization workflow (`initializeMarkerPage`)
   - Marker CRUD operations (create, update times, update tags, delete, bulk delete)
   - Marker status operations (confirm, reject, reset)
   - Tag operations (load tags, add/update tags, AI conversion)
   - Advanced operations (duplicate, merge, split, export) with placeholder implementations

2. **Error Handling & Loading States**: All thunks follow consistent patterns:

   - Use `rejectWithValue` for proper error handling
   - Loading states managed in extraReducers
   - Automatic marker refresh after mutations

3. **Service Integration**: Fixed method name discrepancies:

   - `getScene()` instead of `findScene()`
   - `getAllTags()` instead of `findTags()`
   - `convertConfirmedAIMarkers(markers[])` instead of `findConfirmedAIMarkers(sceneId)`

4. **Complete State Management**: Added all missing sync actions and selectors:
   - Modal state management (8 different modals)
   - Editing state (temporary form fields)
   - Operations state (AI conversion, generation, etc.)
   - Comprehensive selector coverage

### Phase 2 Achievements:

**✅ All Original useMarkerOperations Functions Replicated:**

- `refreshMarkersOnly` → `loadMarkers`
- `updateMarkerTimes` → `updateMarkerTimes`
- `updateMarkerTag` → `updateMarkerTag`
- `deleteRejectedMarkers` → `deleteRejectedMarkers`
- `createMarker` → `createMarker`
- `confirmMarker` → `confirmMarker`
- `rejectMarker` → `rejectMarker`
- `resetMarker` → `resetMarker`

**✅ Enhanced with Additional Operations:**

- Full initialization workflow
- Tag management operations
- AI marker conversion workflow
- Advanced operations (placeholders for future development)

**✅ Build & Type Safety:**

- All code compiles successfully
- Full TypeScript type safety maintained
- ESLint clean with no warnings
- Store integration tested

### Ready for Phase 3:

The marker slice is now complete with:

- 15+ async thunks covering all marker operations
- 25+ sync actions for UI and temporary state
- 35+ selectors for all state access patterns
- Complete error handling and loading state management
- Backward compatibility maintained (MarkerContext still functional)

### Potential Issues Identified

1. **Video Element Management**: Need careful handling during component migration since DOM refs shouldn't persist in Redux
2. **Selection Logic**: Complex `selectedMarkerId` logic with shot boundary filtering must be preserved
3. **Temporary State**: Many editing fields are temporary - consider if they belong in Redux long-term

## Notes

- Each phase should be completed and tested before moving to the next
- Consider creating feature branch for each major phase
- Regular testing with full application to ensure no regressions
- Document any deviations from this plan as they occur
- **Phase 1 Complete**: Ready to proceed with async operations migration
- **Phase 2 Complete**: All async operations migrated to Redux thunks, ready for component migration
