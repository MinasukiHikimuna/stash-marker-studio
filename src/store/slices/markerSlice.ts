import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  SceneMarker,
  Scene,
  Tag,
  stashappService,
} from "@/services/StashappService";
import type { IncorrectMarker } from "@/utils/incorrectMarkerStorage";

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
    duration: number | null;
    currentTime: number;
    isPlaying: boolean;
    volume: number;
    playbackRate: number;

    // Command state for component communication
    pendingSeek: { time: number; requestId: string } | null;
    pendingPlayPause: { action: "play" | "pause"; requestId: string } | null;
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
      newTagSearch: "",
      selectedNewTag: "",
      selectedDuplicateTag: "",
      newMarkerStartTime: null,
      newMarkerEndTime: null,
      duplicateStartTime: null,
      duplicateEndTime: null,
    },
  },

  // Video state - metadata only, no DOM elements
  video: {
    duration: null,
    currentTime: 0,
    isPlaying: false,
    volume: 1,
    playbackRate: 1,
    pendingSeek: null,
    pendingPlayPause: null,
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

// Async thunks for marker operations

// Initialize the marker page with scene, markers, and tags
export const initializeMarkerPage = createAsyncThunk(
  "marker/initializeMarkerPage",
  async (sceneId: string, { rejectWithValue }) => {
    try {
      // Load scene data
      const scene = await stashappService.getScene(sceneId);

      if (!scene) {
        throw new Error("Scene not found");
      }

      // Load markers
      const markersResult = await stashappService.getSceneMarkers(sceneId);
      const markers = markersResult.findSceneMarkers.scene_markers || [];

      // Load available tags
      const tagsResult = await stashappService.getAllTags();
      const availableTags = tagsResult.findTags.tags;

      return {
        scene,
        markers,
        availableTags,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to initialize marker page"
      );
    }
  }
);

// Load only markers (for refreshing after operations)
export const loadMarkers = createAsyncThunk(
  "marker/loadMarkers",
  async (sceneId: string, { rejectWithValue }) => {
    try {
      const result = await stashappService.getSceneMarkers(sceneId);
      const markers = result.findSceneMarkers.scene_markers || [];
      return markers;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load markers"
      );
    }
  }
);

// Create a new marker
export const createMarker = createAsyncThunk(
  "marker/createMarker",
  async (
    params: {
      sceneId: string;
      startTime: number;
      endTime: number | null;
      tagId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const newMarker = await stashappService.createSceneMarker(
        params.sceneId,
        params.tagId,
        params.startTime,
        params.endTime,
        [
          stashappService.MARKER_SOURCE_MANUAL,
          stashappService.MARKER_STATUS_CONFIRMED,
        ]
      );

      // Refresh markers after creation
      await dispatch(loadMarkers(params.sceneId));

      return newMarker;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to create marker"
      );
    }
  }
);

// Update marker times
export const updateMarkerTimes = createAsyncThunk(
  "marker/updateMarkerTimes",
  async (
    params: {
      sceneId: string;
      markerId: string;
      startTime: number;
      endTime: number | null;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await stashappService.updateMarkerTimes(
        params.markerId,
        params.startTime,
        params.endTime
      );

      // Refresh markers after update
      await dispatch(loadMarkers(params.sceneId));

      return true;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to update marker times"
      );
    }
  }
);

// Update marker tag
export const updateMarkerTag = createAsyncThunk(
  "marker/updateMarkerTag",
  async (
    params: {
      sceneId: string;
      markerId: string;
      tagId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await stashappService.updateMarkerTagAndTitle(
        params.markerId,
        params.tagId
      );

      // Refresh markers after update
      await dispatch(loadMarkers(params.sceneId));

      return true;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to update marker tag"
      );
    }
  }
);

// Delete a single marker
export const deleteMarker = createAsyncThunk(
  "marker/deleteMarker",
  async (
    params: {
      sceneId: string;
      markerId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await stashappService.deleteMarkers([params.markerId]);

      // Refresh markers after deletion
      await dispatch(loadMarkers(params.sceneId));

      return params.markerId;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to delete marker"
      );
    }
  }
);

// Bulk delete rejected markers
export const deleteRejectedMarkers = createAsyncThunk(
  "marker/deleteRejectedMarkers",
  async (
    params: {
      sceneId: string;
      rejectedMarkerIds: string[];
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      if (params.rejectedMarkerIds.length === 0) {
        return [];
      }

      await stashappService.deleteMarkers(params.rejectedMarkerIds);

      // Refresh markers after deletion
      await dispatch(loadMarkers(params.sceneId));

      return params.rejectedMarkerIds;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to delete rejected markers"
      );
    }
  }
);

// Confirm a marker (add confirmed status tag)
export const confirmMarker = createAsyncThunk(
  "marker/confirmMarker",
  async (
    params: {
      sceneId: string;
      markerId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await stashappService.confirmMarker(params.markerId, params.sceneId);

      // Refresh markers after confirmation
      await dispatch(loadMarkers(params.sceneId));

      return params.markerId;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to confirm marker"
      );
    }
  }
);

// Reject a marker (add rejected status tag)
export const rejectMarker = createAsyncThunk(
  "marker/rejectMarker",
  async (
    params: {
      sceneId: string;
      markerId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await stashappService.rejectMarker(params.markerId, params.sceneId);

      // Refresh markers after rejection
      await dispatch(loadMarkers(params.sceneId));

      return params.markerId;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to reject marker"
      );
    }
  }
);

// Reset a marker (remove status tags)
export const resetMarker = createAsyncThunk(
  "marker/resetMarker",
  async (
    params: {
      sceneId: string;
      markerId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await stashappService.resetMarker(params.markerId, params.sceneId);

      // Refresh markers after reset
      await dispatch(loadMarkers(params.sceneId));

      return params.markerId;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to reset marker"
      );
    }
  }
);

// Load available tags (for tag selector)
export const loadAvailableTags = createAsyncThunk(
  "marker/loadAvailableTags",
  async (_, { rejectWithValue }) => {
    try {
      const result = await stashappService.getAllTags();
      return result.findTags.tags;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load available tags"
      );
    }
  }
);

// Add tag to marker (this is already handled by updateMarkerTag, but keeping for API consistency)
export const addTagToMarker = createAsyncThunk(
  "marker/addTagToMarker",
  async (
    params: {
      sceneId: string;
      markerId: string;
      tagId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await stashappService.updateMarkerTagAndTitle(
        params.markerId,
        params.tagId
      );

      // Refresh markers after update
      await dispatch(loadMarkers(params.sceneId));

      return { markerId: params.markerId, tagId: params.tagId };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to add tag to marker"
      );
    }
  }
);

// Note: removeTagFromMarker doesn't exist in the original codebase - markers have one primary tag
// If this functionality is needed, it would require extending the StashappService

// Convert AI tags to real tags
export const convertAITags = createAsyncThunk(
  "marker/convertAITags",
  async (
    params: {
      sceneId: string;
      aiMarkers: { aiMarker: SceneMarker; correspondingTag: Tag }[];
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      // Convert each AI marker to its corresponding tag
      for (const { aiMarker, correspondingTag } of params.aiMarkers) {
        await stashappService.updateMarkerTagAndTitle(
          aiMarker.id,
          correspondingTag.id
        );
      }

      // Refresh markers after conversion
      await dispatch(loadMarkers(params.sceneId));

      return params.aiMarkers;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to convert AI tags"
      );
    }
  }
);

// Find confirmed AI markers (for AI tag conversion workflow)
export const findConfirmedAIMarkers = createAsyncThunk(
  "marker/findConfirmedAIMarkers",
  async (markers: SceneMarker[], { rejectWithValue }) => {
    try {
      const result = await stashappService.convertConfirmedAIMarkers(markers);
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to find confirmed AI markers"
      );
    }
  }
);

// Advanced operations (for future implementation)

// Duplicate a marker
export const duplicateMarker = createAsyncThunk(
  "marker/duplicateMarker",
  async (
    params: {
      sceneId: string;
      sourceMarkerId: string;
      newStartTime: number;
      newEndTime: number | null;
      tagId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      // Create a new marker with the same properties but different times
      const newMarker = await stashappService.createSceneMarker(
        params.sceneId,
        params.tagId,
        params.newStartTime,
        params.newEndTime,
        [
          stashappService.MARKER_SOURCE_MANUAL,
          stashappService.MARKER_STATUS_CONFIRMED,
        ]
      );

      // Refresh markers after creation
      await dispatch(loadMarkers(params.sceneId));

      return newMarker;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to duplicate marker"
      );
    }
  }
);

// Merge markers (placeholder - would need custom StashappService method)
export const mergeMarkers = createAsyncThunk(
  "marker/mergeMarkers",
  async (
    params: {
      sceneId: string;
      markerIds: string[];
      newStartTime: number;
      newEndTime: number | null;
      tagId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      // Delete the source markers
      await stashappService.deleteMarkers(params.markerIds);

      // Create a new merged marker
      await stashappService.createSceneMarker(
        params.sceneId,
        params.tagId,
        params.newStartTime,
        params.newEndTime,
        [
          stashappService.MARKER_SOURCE_MANUAL,
          stashappService.MARKER_STATUS_CONFIRMED,
        ]
      );

      // Refresh markers after merge
      await dispatch(loadMarkers(params.sceneId));

      return params.markerIds;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to merge markers"
      );
    }
  }
);

// Split marker (placeholder - would need custom StashappService method)
export const splitMarker = createAsyncThunk(
  "marker/splitMarker",
  async (
    params: {
      sceneId: string;
      sourceMarkerId: string;
      splitTime: number;
      tagId: string;
      originalTagIds: string[];
      sourceStartTime: number;
      sourceEndTime: number | null;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      // Update the original marker to end at the split time
      await stashappService.updateMarkerTimes(
        params.sourceMarkerId,
        params.sourceStartTime,
        params.splitTime
      );

      // Create second part (split time to end) only if there's remaining time
      if (params.sourceEndTime && params.splitTime < params.sourceEndTime) {
        await stashappService.createSceneMarker(
          params.sceneId,
          params.tagId,
          params.splitTime,
          params.sourceEndTime,
          params.originalTagIds // Preserve all original tags
        );
      }

      // Refresh markers after split
      await dispatch(loadMarkers(params.sceneId));

      return {
        sourceMarkerId: params.sourceMarkerId,
        splitTime: params.splitTime,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to split marker"
      );
    }
  }
);

// Export markers (placeholder - would need custom export functionality)
export const exportMarkers = createAsyncThunk(
  "marker/exportMarkers",
  async (
    params: {
      sceneId: string;
      format: "csv" | "json" | "vtt";
      markerIds?: string[];
    },
    { getState, rejectWithValue }
  ) => {
    try {
      // This is a placeholder - would need to implement export functionality
      // For now, just return the current markers
      const state = getState() as { marker: MarkerState };
      const markersToExport = params.markerIds
        ? state.marker.markers.filter((m) => params.markerIds!.includes(m.id))
        : state.marker.markers;

      // TODO: Implement actual export logic based on format
      console.log(
        `Exporting ${markersToExport.length} markers in ${params.format} format`
      );

      return { format: params.format, count: markersToExport.length };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to export markers"
      );
    }
  }
);

// Create the slice with basic sync actions
const markerSlice = createSlice({
  name: "marker",
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

    setCollectingModalOpen: (state, action: PayloadAction<boolean>) => {
      state.ui.modals.isCollectingModalOpen = action.payload;
    },

    setGeneratingMarkers: (state, action: PayloadAction<boolean>) => {
      state.ui.modals.isGeneratingMarkers = action.payload;
    },

    setDeletingRejected: (state, action: PayloadAction<boolean>) => {
      state.ui.modals.isDeletingRejected = action.payload;
    },

    // Editing actions
    setMarkerStartTime: (state, action: PayloadAction<number | null>) => {
      state.ui.editing.markerStartTime = action.payload;
    },

    setMarkerEndTime: (state, action: PayloadAction<number | null>) => {
      state.ui.editing.markerEndTime = action.payload;
    },

    setNewTagSearch: (state, action: PayloadAction<string>) => {
      state.ui.editing.newTagSearch = action.payload;
    },

    setSelectedNewTag: (state, action: PayloadAction<string>) => {
      state.ui.editing.selectedNewTag = action.payload;
    },

    setSelectedDuplicateTag: (state, action: PayloadAction<string>) => {
      state.ui.editing.selectedDuplicateTag = action.payload;
    },

    setNewMarkerStartTime: (state, action: PayloadAction<number | null>) => {
      state.ui.editing.newMarkerStartTime = action.payload;
    },

    setNewMarkerEndTime: (state, action: PayloadAction<number | null>) => {
      state.ui.editing.newMarkerEndTime = action.payload;
    },

    setDuplicateStartTime: (state, action: PayloadAction<number | null>) => {
      state.ui.editing.duplicateStartTime = action.payload;
    },

    setDuplicateEndTime: (state, action: PayloadAction<number | null>) => {
      state.ui.editing.duplicateEndTime = action.payload;
    },

    // Operations actions
    setGenerationJobId: (state, action: PayloadAction<string | null>) => {
      state.operations.generationJobId = action.payload;
    },

    setRejectedMarkers: (state, action: PayloadAction<SceneMarker[]>) => {
      state.operations.rejectedMarkers = action.payload;
    },

    setConfirmedAIMarkers: (
      state,
      action: PayloadAction<{ aiMarker: SceneMarker; correspondingTag: Tag }[]>
    ) => {
      state.operations.confirmedAIMarkers = action.payload;
    },

    setCopiedMarkerTimes: (
      state,
      action: PayloadAction<{ start: number; end: number | undefined } | null>
    ) => {
      state.operations.copiedMarkerTimes = action.payload;
    },

    // Filters actions
    setIncorrectMarkers: (state, action: PayloadAction<IncorrectMarker[]>) => {
      state.filters.incorrectMarkers = action.payload;
    },

    // Video actions
    // Video metadata actions (VideoPlayer -> Redux -> Timeline)
    setVideoDuration: (state, action: PayloadAction<number | null>) => {
      state.video.duration = action.payload;
    },

    setCurrentVideoTime: (state, action: PayloadAction<number>) => {
      state.video.currentTime = action.payload;
    },

    setVideoPlaying: (state, action: PayloadAction<boolean>) => {
      state.video.isPlaying = action.payload;
    },

    setVideoVolume: (state, action: PayloadAction<number>) => {
      state.video.volume = action.payload;
    },

    setVideoPlaybackRate: (state, action: PayloadAction<number>) => {
      state.video.playbackRate = action.payload;
    },

    // Video command actions (Timeline -> Redux -> VideoPlayer)
    seekToTime: (state, action: PayloadAction<number>) => {
      state.video.pendingSeek = {
        time: action.payload,
        requestId: `seek-${Date.now()}-${Math.random()}`,
      };
    },

    playVideo: (state) => {
      state.video.pendingPlayPause = {
        action: "play",
        requestId: `play-${Date.now()}-${Math.random()}`,
      };
    },

    pauseVideo: (state) => {
      state.video.pendingPlayPause = {
        action: "pause",
        requestId: `pause-${Date.now()}-${Math.random()}`,
      };
    },

    togglePlayPause: (state) => {
      const action = state.video.isPlaying ? "pause" : "play";
      state.video.pendingPlayPause = {
        action,
        requestId: `toggle-${Date.now()}-${Math.random()}`,
      };
    },

    // Clear command actions after VideoPlayer processes them
    clearPendingSeek: (state) => {
      state.video.pendingSeek = null;
    },

    clearPendingPlayPause: (state) => {
      state.video.pendingPlayPause = null;
    },

    // Filter actions
    setFilteredSwimlane: (state, action: PayloadAction<string | null>) => {
      state.filters.filteredSwimlane = action.payload;
    },

    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
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
        state.scene = action.payload.scene;
        state.sceneId = action.payload.scene.id;
        state.sceneTitle = action.payload.scene.title;
        state.markers = action.payload.markers;
        state.availableTags = action.payload.availableTags;
      })
      .addCase(initializeMarkerPage.rejected, (state, action) => {
        state.initializing = false;
        state.initializationError =
          (action.payload as string) || "Failed to initialize marker page";
      })

      // Handle load markers
      .addCase(loadMarkers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadMarkers.fulfilled, (state, action) => {
        state.loading = false;
        // Preserve selection if marker still exists
        const selectedMarkerStillExists = action.payload.some(
          (m) => m.id === state.ui.selectedMarkerId
        );
        state.markers = action.payload;
        if (!selectedMarkerStillExists) {
          state.ui.selectedMarkerId = null;
        }
      })
      .addCase(loadMarkers.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to load markers";
      })

      // Handle create marker
      .addCase(createMarker.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createMarker.fulfilled, (state) => {
        state.loading = false;
        // Markers are refreshed by the thunk
      })
      .addCase(createMarker.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to create marker";
      })

      // Handle update marker times
      .addCase(updateMarkerTimes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateMarkerTimes.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateMarkerTimes.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to update marker times";
      })

      // Handle update marker tag
      .addCase(updateMarkerTag.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateMarkerTag.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateMarkerTag.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to update marker tag";
      })

      // Handle delete marker
      .addCase(deleteMarker.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteMarker.fulfilled, (state, action) => {
        state.loading = false;
        // Clear selection if deleted marker was selected
        if (state.ui.selectedMarkerId === action.payload) {
          state.ui.selectedMarkerId = null;
        }
      })
      .addCase(deleteMarker.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to delete marker";
      })

      // Handle delete rejected markers
      .addCase(deleteRejectedMarkers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteRejectedMarkers.fulfilled, (state, action) => {
        state.loading = false;
        // Clear selection if deleted marker was selected
        if (action.payload.includes(state.ui.selectedMarkerId || "")) {
          state.ui.selectedMarkerId = null;
        }
      })
      .addCase(deleteRejectedMarkers.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to delete rejected markers";
      })

      // Handle confirm marker
      .addCase(confirmMarker.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(confirmMarker.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(confirmMarker.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to confirm marker";
      })

      // Handle reject marker
      .addCase(rejectMarker.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(rejectMarker.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(rejectMarker.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to reject marker";
      })

      // Handle reset marker
      .addCase(resetMarker.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetMarker.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(resetMarker.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to reset marker";
      })

      // Handle load available tags
      .addCase(loadAvailableTags.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadAvailableTags.fulfilled, (state, action) => {
        state.loading = false;
        state.availableTags = action.payload;
      })
      .addCase(loadAvailableTags.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to load available tags";
      })

      // Handle add tag to marker
      .addCase(addTagToMarker.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addTagToMarker.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(addTagToMarker.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to add tag to marker";
      })

      // Handle convert AI tags
      .addCase(convertAITags.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(convertAITags.fulfilled, (state) => {
        state.loading = false;
        // Clear the confirmed AI markers after conversion
        state.operations.confirmedAIMarkers = [];
      })
      .addCase(convertAITags.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to convert AI tags";
      })

      // Handle find confirmed AI markers
      .addCase(findConfirmedAIMarkers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(findConfirmedAIMarkers.fulfilled, (state, action) => {
        state.loading = false;
        state.operations.confirmedAIMarkers = action.payload;
      })
      .addCase(findConfirmedAIMarkers.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to find confirmed AI markers";
      })

      // Handle duplicate marker
      .addCase(duplicateMarker.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(duplicateMarker.fulfilled, (state) => {
        state.loading = false;
        // Markers are refreshed by the thunk
      })
      .addCase(duplicateMarker.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to duplicate marker";
      })

      // Handle merge markers
      .addCase(mergeMarkers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(mergeMarkers.fulfilled, (state, action) => {
        state.loading = false;
        // Clear selection if any of the merged markers was selected
        if (action.payload.includes(state.ui.selectedMarkerId || "")) {
          state.ui.selectedMarkerId = null;
        }
      })
      .addCase(mergeMarkers.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to merge markers";
      })

      // Handle split marker
      .addCase(splitMarker.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(splitMarker.fulfilled, (state, action) => {
        state.loading = false;
        // Clear selection if the split marker was selected
        if (state.ui.selectedMarkerId === action.payload.sourceMarkerId) {
          state.ui.selectedMarkerId = null;
        }
      })
      .addCase(splitMarker.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to split marker";
      })

      // Handle export markers
      .addCase(exportMarkers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(exportMarkers.fulfilled, (state) => {
        state.loading = false;
        // No state changes for export
      })
      .addCase(exportMarkers.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to export markers";
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
  setCollectingModalOpen,
  setGeneratingMarkers,
  setDeletingRejected,
  setMarkerStartTime,
  setMarkerEndTime,
  setNewTagSearch,
  setSelectedNewTag,
  setSelectedDuplicateTag,
  setNewMarkerStartTime,
  setNewMarkerEndTime,
  setDuplicateStartTime,
  setDuplicateEndTime,
  setGenerationJobId,
  setRejectedMarkers,
  setConfirmedAIMarkers,
  setCopiedMarkerTimes,
  setIncorrectMarkers,
  setVideoDuration,
  setCurrentVideoTime,
  setVideoPlaying,
  setVideoVolume,
  setVideoPlaybackRate,
  seekToTime,
  playVideo,
  pauseVideo,
  togglePlayPause,
  clearPendingSeek,
  clearPendingPlayPause,
  setFilteredSwimlane,
  clearError,
  setError,
  resetState,
} = markerSlice.actions;

// Export selectors following search slice patterns
export const selectMarkerState = (state: { marker: MarkerState }) =>
  state.marker;

// Core data selectors
export const selectMarkers = (state: { marker: MarkerState }) =>
  state.marker.markers;
export const selectScene = (state: { marker: MarkerState }) =>
  state.marker.scene;
export const selectSceneId = (state: { marker: MarkerState }) =>
  state.marker.sceneId;
export const selectSceneTitle = (state: { marker: MarkerState }) =>
  state.marker.sceneTitle;
export const selectAvailableTags = (state: { marker: MarkerState }) =>
  state.marker.availableTags;

// UI selectors
export const selectSelectedMarkerId = (state: { marker: MarkerState }) =>
  state.marker.ui.selectedMarkerId;

// Modal selectors
export const selectIsEditingMarker = (state: { marker: MarkerState }) =>
  state.marker.ui.modals.isEditingMarker;
export const selectIsCreatingMarker = (state: { marker: MarkerState }) =>
  state.marker.ui.modals.isCreatingMarker;
export const selectIsDuplicatingMarker = (state: { marker: MarkerState }) =>
  state.marker.ui.modals.isDuplicatingMarker;
export const selectIsDeletingRejected = (state: { marker: MarkerState }) =>
  state.marker.ui.modals.isDeletingRejected;
export const selectIsGeneratingMarkers = (state: { marker: MarkerState }) =>
  state.marker.ui.modals.isGeneratingMarkers;
export const selectIsAIConversionModalOpen = (state: { marker: MarkerState }) =>
  state.marker.ui.modals.isAIConversionModalOpen;
export const selectIsKeyboardShortcutsModalOpen = (state: {
  marker: MarkerState;
}) => state.marker.ui.modals.isKeyboardShortcutsModalOpen;
export const selectIsCollectingModalOpen = (state: { marker: MarkerState }) =>
  state.marker.ui.modals.isCollectingModalOpen;

// Editing selectors
export const selectMarkerStartTime = (state: { marker: MarkerState }) =>
  state.marker.ui.editing.markerStartTime;
export const selectMarkerEndTime = (state: { marker: MarkerState }) =>
  state.marker.ui.editing.markerEndTime;
export const selectNewTagSearch = (state: { marker: MarkerState }) =>
  state.marker.ui.editing.newTagSearch;
export const selectSelectedNewTag = (state: { marker: MarkerState }) =>
  state.marker.ui.editing.selectedNewTag;
export const selectSelectedDuplicateTag = (state: { marker: MarkerState }) =>
  state.marker.ui.editing.selectedDuplicateTag;
export const selectNewMarkerStartTime = (state: { marker: MarkerState }) =>
  state.marker.ui.editing.newMarkerStartTime;
export const selectNewMarkerEndTime = (state: { marker: MarkerState }) =>
  state.marker.ui.editing.newMarkerEndTime;
export const selectDuplicateStartTime = (state: { marker: MarkerState }) =>
  state.marker.ui.editing.duplicateStartTime;
export const selectDuplicateEndTime = (state: { marker: MarkerState }) =>
  state.marker.ui.editing.duplicateEndTime;

// Video selectors - metadata only
export const selectVideoDuration = (state: { marker: MarkerState }) =>
  state.marker.video.duration;
export const selectCurrentVideoTime = (state: { marker: MarkerState }) =>
  state.marker.video.currentTime;
export const selectVideoIsPlaying = (state: { marker: MarkerState }) =>
  state.marker.video.isPlaying;
export const selectVideoVolume = (state: { marker: MarkerState }) =>
  state.marker.video.volume;
export const selectVideoPlaybackRate = (state: { marker: MarkerState }) =>
  state.marker.video.playbackRate;

// Video command selectors (for VideoPlayer to listen to)
export const selectPendingSeek = (state: { marker: MarkerState }) =>
  state.marker.video.pendingSeek;
export const selectPendingPlayPause = (state: { marker: MarkerState }) =>
  state.marker.video.pendingPlayPause;

// Operations selectors
export const selectGenerationJobId = (state: { marker: MarkerState }) =>
  state.marker.operations.generationJobId;
export const selectRejectedMarkers = (state: { marker: MarkerState }) =>
  state.marker.operations.rejectedMarkers;
export const selectConfirmedAIMarkers = (state: { marker: MarkerState }) =>
  state.marker.operations.confirmedAIMarkers;
export const selectCopiedMarkerTimes = (state: { marker: MarkerState }) =>
  state.marker.operations.copiedMarkerTimes;

// Filter selectors
export const selectFilteredSwimlane = (state: { marker: MarkerState }) =>
  state.marker.filters.filteredSwimlane;
export const selectIncorrectMarkers = (state: { marker: MarkerState }) =>
  state.marker.filters.incorrectMarkers;

// Async state selectors
export const selectMarkerLoading = (state: { marker: MarkerState }) =>
  state.marker.loading;
export const selectMarkerError = (state: { marker: MarkerState }) =>
  state.marker.error;
export const selectMarkerInitialized = (state: { marker: MarkerState }) =>
  state.marker.initialized;
export const selectMarkerInitializing = (state: { marker: MarkerState }) =>
  state.marker.initializing;
export const selectInitializationError = (state: { marker: MarkerState }) =>
  state.marker.initializationError;

export default markerSlice.reducer;
