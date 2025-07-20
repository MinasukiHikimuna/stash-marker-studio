# Marker Page Redux Migration Plan

## Overview

This plan outlines the step-by-step migration of the Marker page from React Context (`MarkerContext`) to Redux, following the established patterns from the Search page. The migration will be done incrementally to minimize disruption and ensure stability.

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

#### Step 1.1: Create Marker Slice Structure
- [ ] Create `src/store/slices/markerSlice.ts`
- [ ] Define TypeScript interfaces for marker state
- [ ] Set up initial state structure following search slice patterns
- [ ] Create basic sync actions (setters, UI state toggles)

#### Step 1.2: Add to Store Configuration
- [ ] Update `src/store/index.ts` to include marker reducer
- [ ] Ensure type safety with updated `RootState` type
- [ ] Test that store setup doesn't break existing search functionality

### Phase 2: Async Operations Migration
**Goal**: Move complex operations from custom hooks to Redux thunks

#### Step 2.1: Core CRUD Operations
- [ ] Create async thunks for:
  - `initializeMarkerPage`: Load scene, markers, and tags
  - `loadMarkers`: Fetch markers for current scene
  - `createMarker`: Create new marker with status handling
  - `updateMarker`: Update existing marker
  - `deleteMarker`: Delete marker with confirmations
  - `bulkUpdateMarkers`: Handle batch operations

#### Step 2.2: Tag Operations
- [ ] Create async thunks for:
  - `loadAvailableTags`: Fetch all available tags
  - `addTagToMarker`: Add tag to specific marker
  - `removeTagFromMarker`: Remove tag from marker
  - `convertAITags`: Convert AI tags to real tags

#### Step 2.3: Advanced Operations
- [ ] Create async thunks for:
  - `duplicateMarker`: Create copy of existing marker
  - `mergeMarkers`: Combine multiple markers
  - `splitMarker`: Split marker at current time
  - `exportMarkers`: Export markers to various formats

### Phase 3: Component Migration (Incremental)
**Goal**: Migrate components one by one to use Redux

#### Step 3.1: Core Data Components (Low Risk)
- [ ] **MarkerSummary**: Simple read-only component
  - Update to use `useAppSelector` for marker counts
  - Remove MarkerContext dependency
  
- [ ] **MarkerHeader**: Basic UI state management
  - Migrate filter state to Redux
  - Update modal toggles to use Redux actions

#### Step 3.2: List Components (Medium Risk)
- [ ] **MarkerList**: Main list rendering
  - Update to use Redux selectors for filtered markers
  - Replace context dispatch with Redux dispatch
  
- [ ] **MarkerItem**: Individual marker rendering
  - Update to use Redux actions for marker operations
  - Handle edit mode state through Redux

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

## Notes

- Each phase should be completed and tested before moving to the next
- Consider creating feature branch for each major phase
- Regular testing with full application to ensure no regressions
- Document any deviations from this plan as they occur