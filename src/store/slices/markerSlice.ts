import { createSlice, createAsyncThunk, PayloadAction, current } from '@reduxjs/toolkit';
import { SceneMarker, Scene, Tag, stashappService } from '@/services/StashappService';
import type { IncorrectMarker } from '@/utils/incorrectMarkerStorage';

// Extended Scene type with markers
export type SceneWithMarkers = Scene & {
  scene_markers?: SceneMarker[];
};

// Core state interface matching the existing MarkerState but organized for Redux
export interface MarkerState {
  // Core data
  markers: SceneMarker[];
  scene: Scene | null;
  sceneId: string | null;
  sceneTitle: string | null;
  availableTags: Tag[];
  
  // UI state - organized into logical groups
  ui: {
    // Selection state
    selectedMarkerId: string | null;
    
    // Modal states
    modals: {
      isEditingMarker: boolean;
      isCreatingMarker: boolean;
      isDuplicatingMarker: boolean;
      isDeletingRejected: boolean;
      isGeneratingMarkers: boolean;
      isAIConversionModalOpen: boolean;
      isKeyboardShortcutsModalOpen: boolean;
      isCollectingModalOpen: boolean;
    };
    
    // Temporary editing state
    editing: {
      markerStartTime: number | null;
      markerEndTime: number | null;
      newTagSearch: string;
      selectedNewTag: string;
      selectedDuplicateTag: string;
      newMarkerStartTime: number | null;
      newMarkerEndTime: number | null;
      duplicateStartTime: number | null;
      duplicateEndTime: number | null;
    };
  };
  
  // Video state
  video: {
    duration: number;
    currentTime: number;
    element: HTMLVideoElement | null;
  };
  
  // Operation state
  operations: {
    generationJobId: string | null;
    rejectedMarkers: SceneMarker[];
    confirmedAIMarkers: { aiMarker: SceneMarker; correspondingTag: Tag }[];
    copiedMarkerTimes: { start: number; end: number | undefined } | null;
  };
  
  // Filters and display
  filters: {
    filteredSwimlane: string | null;
    incorrectMarkers: IncorrectMarker[];
  };
  
  // Async state
  loading: boolean;
  error: string | null;
  initialized: boolean;
  initializing: boolean;
  initializationError: string | null;
}

// Initial state following search slice patterns
const initialState: MarkerState = {
  // Core data
  markers: [],
  scene: null,
  sceneId: null,
  sceneTitle: null,
  availableTags: [],
  
  // UI state
  ui: {
    selectedMarkerId: null,
    modals: {
      isEditingMarker: false,
      isCreatingMarker: false,
      isDuplicatingMarker: false,
      isDeletingRejected: false,
      isGeneratingMarkers: false,
      isAIConversionModalOpen: false,
      isKeyboardShortcutsModalOpen: false,
      isCollectingModalOpen: false,
    },
    editing: {
      markerStartTime: null,
      markerEndTime: null,
      newTagSearch: '',
      selectedNewTag: '',
      selectedDuplicateTag: '',
      newMarkerStartTime: null,
      newMarkerEndTime: null,
      duplicateStartTime: null,
      duplicateEndTime: null,
    },
  },
  
  // Video state
  video: {
    duration: 0,
    currentTime: 0,
    element: null,
  },
  
  // Operation state
  operations: {
    generationJobId: null,
    rejectedMarkers: [],
    confirmedAIMarkers: [],
    copiedMarkerTimes: null,
  },
  
  // Filters
  filters: {
    filteredSwimlane: null,
    incorrectMarkers: [],
  },
  
  // Async state
  loading: false,
  error: null,
  initialized: false,
  initializing: false,
  initializationError: null,
};

// Basic async thunk for initialization (we'll expand this in Phase 2)
export const initializeMarkerPage = createAsyncThunk(
  'marker/initializeMarkerPage',
  async (sceneId: string) => {
    // For now, just return the sceneId - we'll implement full logic in Phase 2
    return { sceneId };
  }
);

// Create the slice with basic sync actions
const markerSlice = createSlice({
  name: 'marker',
  initialState,
  reducers: {
    // Core data setters
    setMarkers: (state, action: PayloadAction<SceneMarker[]>) => {
      // Preserve selection if marker still exists
      const selectedMarkerStillExists = action.payload.some(
        (m) => m.id === state.ui.selectedMarkerId
      );
      
      state.markers = action.payload;
      if (!selectedMarkerStillExists) {
        state.ui.selectedMarkerId = null;
      }
    },
    
    setScene: (state, action: PayloadAction<Scene | null>) => {
      state.scene = action.payload;
      state.sceneId = action.payload?.id ?? null;
      state.sceneTitle = action.payload?.title ?? null;
    },
    
    setAvailableTags: (state, action: PayloadAction<Tag[]>) => {
      state.availableTags = action.payload;
    },
    
    // UI actions - selection
    setSelectedMarkerId: (state, action: PayloadAction<string | null>) => {
      // Prevent selection of shot boundary markers (matching original logic)
      if (action.payload) {
        const marker = state.markers.find((m) => m.id === action.payload);
        if (marker?.primary_tag.id === stashappService.MARKER_SHOT_BOUNDARY) {
          return; // Don't update state
        }
      }
      state.ui.selectedMarkerId = action.payload;
    },
    
    // UI actions - modals
    setEditingMarker: (state, action: PayloadAction<boolean>) => {
      state.ui.modals.isEditingMarker = action.payload;
    },
    
    setCreatingMarker: (state, action: PayloadAction<boolean>) => {
      state.ui.modals.isCreatingMarker = action.payload;
    },
    
    setDuplicatingMarker: (state, action: PayloadAction<boolean>) => {
      state.ui.modals.isDuplicatingMarker = action.payload;
    },
    
    setAIConversionModalOpen: (state, action: PayloadAction<boolean>) => {
      state.ui.modals.isAIConversionModalOpen = action.payload;
    },
    
    setKeyboardShortcutsModalOpen: (state, action: PayloadAction<boolean>) => {
      state.ui.modals.isKeyboardShortcutsModalOpen = action.payload;
    },
    
    // Video actions
    setVideoDuration: (state, action: PayloadAction<number>) => {
      state.video.duration = action.payload;
    },
    
    setCurrentVideoTime: (state, action: PayloadAction<number>) => {
      state.video.currentTime = action.payload;
    },
    
    setVideoElement: (state, action: PayloadAction<HTMLVideoElement | null>) => {
      // Use return to create a new state object for DOM elements
      return {
        ...current(state),
        video: {
          ...current(state).video,
          element: action.payload,
        },
      };
    },
    
    // Filter actions
    setFilteredSwimlane: (state, action: PayloadAction<string | null>) => {
      state.filters.filteredSwimlane = action.payload;
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    // Reset state
    resetState: () => initialState,
  },
  
  extraReducers: (builder) => {
    // Handle initialization thunk
    builder
      .addCase(initializeMarkerPage.pending, (state) => {
        state.initializing = true;
        state.initializationError = null;
      })
      .addCase(initializeMarkerPage.fulfilled, (state, action) => {
        state.initializing = false;
        state.initialized = true;
        state.sceneId = action.payload.sceneId;
      })
      .addCase(initializeMarkerPage.rejected, (state, action) => {
        state.initializing = false;
        state.initializationError = action.error.message || 'Failed to initialize marker page';
      });
  },
});

// Export actions
export const {
  setMarkers,
  setScene,
  setAvailableTags,
  setSelectedMarkerId,
  setEditingMarker,
  setCreatingMarker,
  setDuplicatingMarker,
  setAIConversionModalOpen,
  setKeyboardShortcutsModalOpen,
  setVideoDuration,
  setCurrentVideoTime,
  setVideoElement,
  setFilteredSwimlane,
  clearError,
  resetState,
} = markerSlice.actions;

// Export selectors following search slice patterns
export const selectMarkerState = (state: { marker: MarkerState }) => state.marker;
export const selectMarkers = (state: { marker: MarkerState }) => state.marker.markers;
export const selectScene = (state: { marker: MarkerState }) => state.marker.scene;
export const selectSceneId = (state: { marker: MarkerState }) => state.marker.sceneId;
export const selectAvailableTags = (state: { marker: MarkerState }) => state.marker.availableTags;
export const selectSelectedMarkerId = (state: { marker: MarkerState }) => state.marker.ui.selectedMarkerId;
export const selectIsEditingMarker = (state: { marker: MarkerState }) => state.marker.ui.modals.isEditingMarker;
export const selectVideoDuration = (state: { marker: MarkerState }) => state.marker.video.duration;
export const selectCurrentVideoTime = (state: { marker: MarkerState }) => state.marker.video.currentTime;
export const selectVideoElement = (state: { marker: MarkerState }) => state.marker.video.element;
export const selectFilteredSwimlane = (state: { marker: MarkerState }) => state.marker.filters.filteredSwimlane;
export const selectMarkerLoading = (state: { marker: MarkerState }) => state.marker.loading;
export const selectMarkerError = (state: { marker: MarkerState }) => state.marker.error;
export const selectMarkerInitialized = (state: { marker: MarkerState }) => state.marker.initialized;

export default markerSlice.reducer;