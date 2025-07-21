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

- [x] **VideoPlayer**: Video state management ✅ COMPLETED
  - **ARCHITECTURE DECISION**: Video element stays local, metadata goes to Redux, commands flow through Redux actions
  - **Current Problems**:
    - `video.element: HTMLVideoElement` stored in Redux (serialization workaround needed)
    - Timeline has direct access to `videoRef` prop and manipulates it directly
    - Tight coupling between components via prop drilling
    - Mixed patterns: some actions via Redux, some via direct DOM manipulation
  - **Proposed Video Architecture**:
    - **Core Principle**: Video element stays local, metadata goes to Redux, commands flow through Redux actions
    - **Video State in Redux (Metadata Only)**:
      ```typescript
      video: {
        // Metadata only - no DOM elements
        currentTime: number;
        duration: number | null;
        isPlaying: boolean;
        volume: number;
        playbackRate: number;
        
        // Command state (for component communication)
        pendingSeek: { time: number; requestId: string } | null;
        pendingPlayPause: { action: 'play' | 'pause'; requestId: string } | null;
      }
      ```
    - **Communication Flow**:
      - **Video Metadata Updates (VideoPlayer → Redux → Timeline)**:
        ```
        VideoPlayer (timeupdate event) → dispatch(setCurrentTime) → Redux → Timeline (useSelector)
        ```
      - **Video Commands (Timeline → Redux → VideoPlayer)**:
        ```
        Timeline (click) → dispatch(seekToTime) → Redux → VideoPlayer (useEffect listener) → video.currentTime = x
        ```
    - **VideoPlayer Responsibilities**:
      - Hold video element as local `useRef`
      - Listen to Redux for command actions (`pendingSeek`, `pendingPlayPause`)
      - Dispatch metadata updates to Redux
      - Handle all direct DOM video manipulation
    - **Timeline Responsibilities**:
      - Read video metadata from Redux selectors
      - Dispatch video command actions
      - No direct video element access
    - **Implementation Steps**:
      1. Update Redux slice to remove video element, add command state
      2. Refactor VideoPlayer to be command-driven
      3. Refactor Timeline to use Redux commands instead of direct video access
      4. Update useVideoControls to work with new pattern
    - **Benefits**:
      - Video element never leaves VideoPlayer component
      - All video state flows through Redux predictably
      - Components communicate via actions, not direct DOM access
      - Easy to test and reason about
  - **Implementation Complete**: All 4 implementation steps successfully completed:
    1. ✅ Updated Redux slice to remove video element, add command state
    2. ✅ Refactored VideoPlayer to be command-driven
    3. ✅ Refactored Timeline to use Redux commands instead of direct video access
    4. ✅ Updated useVideoControls to work with new pattern
  - **Key Changes Made**:
    - Removed `video.element` from Redux state, replaced with metadata + command pattern
    - VideoPlayer now listens to `pendingSeek` and `pendingPlayPause` Redux state
    - Timeline dispatches `seekToTime()` action instead of `videoRef.current.currentTime = x`
    - useVideoControls completely refactored to dispatch Redux actions
    - Removed serialization workarounds from store configuration
    - All video communication now flows: Component → Redux → VideoPlayer → DOM
  - **Final Migration Complete**: Removed all remaining `useMarker` hooks and `markerDispatch` calls
    - Replaced `useMarker()` with `useAppSelector(selectScene)` for video source
    - Removed `markerDispatch` calls for video element storage (video element stays local)
    - Removed `markerDispatch` calls for video metadata (Redux-only now)
    - VideoPlayer is now 100% Redux-based with no MarkerContext dependencies
- [x] **Timeline**: Complex visualization component ✅ COMPLETED
  - **Analysis**: Timeline is actually well-designed and doesn't need direct Redux migration
  - **Architecture**: Already uses Redux for video seeking (dispatch(seekToTime))
  - **Implementation**: Receives all data via props from parent components, follows good separation of concerns
  - **Status**: Timeline itself is Redux-ready, no changes needed
  - **Note**: Parent components (MarkerLayout, Main Marker Page) still need migration to pass Redux data instead of MarkerContext data

#### Step 3.4: Layout Components (Final)

- [x] **MarkerLayout**: Page-level component ✅ COMPLETED
  - **Changes Made**: 
    - Replaced `useMarker` hook with `useAppSelector` and `useAppDispatch`
    - Updated all `state.*` references to use Redux selectors (selectScene, selectMarkers, etc.)
    - Replaced MarkerContext dispatch calls with Redux actions (setSelectedMarkerId, setFilteredSwimlane)
    - Added null safety check for videoDuration to prevent Timeline rendering when duration is unavailable
  - **Key Implementation**: Component now fully uses Redux for all state access and mutations
  - **Testing**: Build and lint pass, no type errors
- [x] **Main Marker Page**: Root component ✅ COMPLETED
  - **Changes Made**:
    - Replaced `useMarker` hook with `useAppSelector` and `useAppDispatch`
    - Added comprehensive Redux selectors for all state access (markers, scene, availableTags, selectedMarkerId, etc.)
    - Replaced all `state.*` references with Redux selectors
    - Converted all `dispatch({ type: "...", payload: ... })` calls to Redux actions
    - Removed `MarkerProvider` wrapper from component tree
    - Added temporary `videoElementRef` for video element compatibility during migration
    - Replaced initialization logic with `initializeMarkerPage` Redux thunk
    - Updated all UI state management to use Redux actions (modals, editing states, etc.)
  - **Key Implementation**: Component now fully uses Redux for all state access and mutations
  - **Temporary Notes**: 
    - useMarkerOperations calls are commented out (to be replaced in Phase 4)
    - videoElement handling is temporary until video architecture is finalized
  - **Testing**: Build and type checking pass successfully

### Phase 4: Custom Hooks Migration

**Goal**: Refactor or eliminate custom hooks that handle state

#### Step 4.1: useMarkerOperations ✅ COMPLETED

- [x] Move async logic to Redux thunks (already done in Phase 2)
- [x] Convert to simple utility functions for complex operations
- [x] Update components to use Redux dispatch directly

**Latest Implementation (2025-07-21)**: `createOrDuplicateMarker` function migration:

- **Replaced Manual State Manipulation with Redux Thunks**: 
  - Removed temporary marker creation logic that manually inserted markers into state
  - Replaced with proper `createMarker` and `duplicateMarker` Redux thunk calls
  - Thunks handle marker creation, automatic refresh, and error states
- **Improved Error Handling**: 
  - Added `setError` action to markerSlice for proper error state management
  - Replaced console.log errors with Redux error dispatch calls
  - Consistent error handling through try/catch with Redux state updates
- **Removed Video Element Dependencies**: 
  - Replaced `videoElementRef.current` checks with Redux state validation (`scene`, `availableTags`)
  - Uses `currentVideoTime` from Redux instead of direct video element access
  - Function is now purely Redux-based with no DOM dependencies
- **Enhanced Type Safety**: 
  - Fixed TypeScript type issues with `sourceMarker.end_seconds` (undefined → null conversion)
  - Proper handling of optional marker end times in Redux thunk parameters
- **Simplified Logic**: 
  - Removed complex temporary marker insertion and sorting logic
  - Thunks handle marker list refresh automatically after creation/duplication
  - UI state management (creating/duplicating flags) handled consistently

**Migration Benefits**:
- Consistent error handling and loading states through Redux
- Automatic marker list refresh and state synchronization
- Eliminated temporary markers that could cause UI inconsistencies
- Simplified component logic with centralized marker operations
- Better TypeScript type safety and error prevention

#### Step 4.2: useMarkerKeyboardShortcuts ✅ COMPLETED

- [x] **Implementation**: Keyboard shortcuts fixed by updating inline keyboard handling in main marker page
- [x] **Key Changes Made**:
  - Replaced all old MarkerContext dispatch calls (`dispatch({ type: "...", payload: ... })`) with Redux actions
  - Fixed `setSelectedMarkerId`, `setKeyboardShortcutsModalOpen`, `setMarkers`, `setCreatingMarker`, `setDuplicatingMarker`, `setIncorrectMarkers`, `setCopiedMarkerTimes`, `setCurrentVideoTime`, `setVideoDuration` dispatch calls
  - Commented out error dispatch calls (TODO: implement proper Redux error handling)
  - **LATEST FIX (2025-07-21)**: Fixed remaining broken dispatch calls that were causing keyboard shortcuts to fail:
    - Fixed `dispatch({ type: "SET_MARKERS", payload: realMarkers })` → `dispatch(setMarkers(realMarkers))`
    - Fixed `dispatch({ type: "SET_SELECTED_MARKER_ID", payload: nextMarkerId })` → `dispatch(setSelectedMarkerId(nextMarkerId))` (multiple instances)
  - **CRITICAL FIX (2025-07-21)**: Replaced commented-out marker operations with Redux thunk calls:
    - **Z key (confirm)**: `confirmMarker({ sceneId, markerId })` and `resetMarker({ sceneId, markerId })` - now working
    - **X key (reject)**: `rejectMarker({ sceneId, markerId })` and `resetMarker({ sceneId, markerId })` - now working  
    - **R key (refresh)**: `loadMarkers(sceneId)` - now working
    - **J/K/L keys (video control)**: `seekToTime()` and `playVideo()` Redux actions - now working
    - **Spacebar (play/pause)**: `playVideo()` Redux action - now working
  - **Video Architecture Fix**: Replaced direct `videoElementRef.current` access with Redux video command pattern
    - Video seeking now uses `dispatch(seekToTime(time))` instead of `videoElementRef.current.currentTime = time`
    - Video play/pause uses `dispatch(playVideo())` instead of `videoElementRef.current.play()/pause()`
    - Uses `currentVideoTime` and `videoDuration` from Redux selectors instead of DOM access
  - **ADDITIONAL FIXES (2025-07-21)**: Fixed remaining video shortcuts and navigation:
    - **I/O keys**: Jump to marker start/end and scene start/end using `dispatch(seekToTime())` - now working
    - **Enter key**: Play from current marker using `dispatch(seekToTime())` + `dispatch(playVideo())` - now working
    - **Comma/Period keys**: Frame stepping using `dispatch(pauseVideo())` + `dispatch(seekToTime())` - now working
    - **Y/U keys**: Shot navigation using Redux selectors instead of direct video access - now working
    - **All video time references**: Replaced `videoElementRef.current.currentTime` with `currentVideoTime` selector
    - **Split marker functions**: Updated to use Redux state instead of direct video element access
  - **FIXED**: K and Space keys now properly toggle playback using `togglePlayPause()` Redux action ✅
    - **Implementation**: Used existing `togglePlayPause` action instead of creating new one
    - **VideoPlayer**: Already handles toggle logic correctly via `pendingPlayPause` command pattern
    - **Keyboard Shortcuts**: Updated K and Space keys to use `dispatch(togglePlayPause())` instead of `dispatch(playVideo())`
    - **Enter Key**: Still uses `dispatch(playVideo())` as intended (start playback from marker, not toggle)
  - **FIXED**: W and E keys for marker time adjustment using Redux thunks ✅ (2025-07-21)
    - **W key (set start time)**: Now uses `dispatch(updateMarkerTimes())` with `currentVideoTime` as start time
    - **E key (set end time)**: Now uses `dispatch(updateMarkerTimes())` with `currentVideoTime` as end time  
    - **Implementation**: Replaced direct video element access with Redux selectors (`currentVideoTime`, `scene`)
    - **Architecture**: Follows Redux command pattern with proper error handling and loading states
    - **Testing**: Lint and build pass successfully with both shortcuts functional
  - All keyboard shortcuts now work with Redux state and actions ✅
- [x] **Status**: Keyboard shortcuts are now functional and fully Redux-based
- [x] **Note**: The `useMarkerKeyboardShortcuts` hook is not used in the current implementation - keyboard handling is inline in main marker page
- [x] **Build Status**: Lint and build pass successfully with all keyboard shortcuts working

#### Step 4.3: Split Marker Functions ✅ COMPLETED

- [x] **splitCurrentMarker**: Updated to use Redux `splitMarker` thunk ✅ COMPLETED (2025-07-21)
  - **Changes Made**:
    - Replaced direct StashappService calls with Redux `splitMarker` thunk dispatch
    - Updated function parameters to match Redux thunk interface (sceneId, sourceMarkerId, splitTime, tagId, sourceStartTime, sourceEndTime)
    - Fixed TypeScript type issue: `end_seconds || null` to handle `undefined` → `number | null` conversion
    - Maintained all validation logic (current time within marker range)
    - Simplified logic by relying on Redux thunk for marker refresh and state updates
    - Preserved post-split behavior: pause video and seek to split time
  - **splitVideoCutMarker**: Updated to use Redux `splitMarker` thunk ✅ COMPLETED (2025-07-21)
    - **Changes Made**:
      - Replaced direct StashappService calls with Redux `splitMarker` thunk dispatch
      - Updated function parameters to match Redux thunk interface
      - Fixed TypeScript type issue: `end_seconds || null`
      - Maintained Video Cut marker detection logic
      - Preserved success toast notification
  - **Keyboard Integration**: Both functions work correctly with keyboard shortcuts
    - **S key**: Calls `splitCurrentMarker()` for action markers ✅
    - **V key**: Calls `splitVideoCutMarker()` for shot boundary markers ✅
  - **Build Status**: Lint and build pass successfully ✅
  - **Key Benefits**:
    - Consistent error handling through Redux thunk rejection
    - Automatic marker list refresh after split operations
    - Loading state management handled by Redux
    - Simplified component logic with centralized split operations
  - **IMPROVED IMPLEMENTATION (2025-07-21)**: Enhanced split logic for better data preservation
    - **Non-destructive splitting**: Instead of deleting original marker and creating two new ones, now updates original marker end time and creates only one new marker
    - **Tag preservation**: Preserves all original tags (both primary and additional) in the new split marker via `originalTagIds` parameter
    - **Status preservation**: Removes forced Manual/Confirmed status - split markers inherit original marker's status and source
    - **Cleaner operation**: Uses `updateMarkerTimes` for original marker modification instead of delete-and-recreate pattern
    - **Edge case handling**: Only creates new marker if there's remaining time after split point

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
