import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  SceneMarker,
  Scene,
  Tag,
  Performer,
  stashappService,
} from "@/services/StashappService";
import type { IncorrectMarker } from "@/utils/incorrectMarkerStorage";
import type { ShotBoundary, ShotBoundaryFromAPI } from "@/core/shotBoundary/types";
import { ShotBoundarySource } from "@/core/shotBoundary/types";
import { shotBoundaryFromAPI } from "@/core/shotBoundary/types";
import { loadMarkerGroups } from "./configSlice";

// Modal state types
export type CompletionModalData = {
  warnings: string[];
  hasAiReviewedTag: boolean;
  primaryTagsToAdd: Tag[];
  tagsToRemove: Tag[];
};

export type CorrespondingTagConversionModalData = {
  markers: { sourceMarker: SceneMarker; correspondingTag: Tag }[];
};

export type DeleteRejectedModalData = {
  rejectedMarkers: SceneMarker[];
};

export type SlotAssignmentModalData = {
  marker: SceneMarker;
};

export type ModalState =
  | { type: 'none' }
  | { type: 'completion'; data: CompletionModalData }
  | { type: 'correspondingTagConversion'; data: CorrespondingTagConversionModalData }
  | { type: 'keyboardShortcuts' }
  | { type: 'collecting' }
  | { type: 'deleteRejected'; data: DeleteRejectedModalData }
  | { type: 'slotAssignment'; data: SlotAssignmentModalData };

// Extended Scene type with markers
export type SceneWithMarkers = Scene & {
  scene_markers?: SceneMarker[];
};

// Core state interface matching the existing MarkerState but organized for Redux
export interface MarkerState {
  // Core data
  markers: SceneMarker[];
  shotBoundaries: ShotBoundary[];  // Stored separately from markers
  scene: Scene | null;
  sceneId: string | null;
  sceneTitle: string | null;
  availableTags: Tag[];
  availablePerformers: Performer[];

  // UI state - organized into logical groups
  ui: {
    // Selection state
    selectedMarkerId: string | null;

    // Modal state - single modal at a time
    modal: ModalState;
    
    // Other UI states (not modals)
    isEditingMarker: boolean;
    isCreatingMarker: boolean;
    isDuplicatingMarker: boolean;
    isGeneratingMarkers: boolean;

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
    confirmedAIMarkers: { sourceMarker: SceneMarker; correspondingTag: Tag }[];
    copiedMarkerTimes: { start: number; end: number | undefined } | null;
  };

  // Filters and display
  filters: {
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
  shotBoundaries: [],
  scene: null,
  sceneId: null,
  sceneTitle: null,
  availableTags: [],
  availablePerformers: [],

  // UI state
  ui: {
    selectedMarkerId: null,
    modal: { type: 'none' },
    isEditingMarker: false,
    isCreatingMarker: false,
    isDuplicatingMarker: false,
    isGeneratingMarkers: false,
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
  async (sceneId: string, { rejectWithValue, dispatch }) => {
    try {
      // Load scene data
      const scene = await stashappService.getScene(sceneId);

      if (!scene) {
        throw new Error("Scene not found");
      }

      // Load markers from local database
      let markers: SceneMarker[] = [];
      try {
        const markersResponse = await fetch(`/api/markers?sceneId=${sceneId}`);
        if (markersResponse.ok) {
          const markersData = await markersResponse.json();
          markers = markersData.markers || [];
        }
      } catch (error) {
        console.warn("Failed to load markers from local database:", error);
        // Continue without markers if database load fails
      }
      const sortedMarkers = [...markers].sort((a, b) => a.seconds - b.seconds);

      // Load shot boundaries from database (separate entity type)
      let shotBoundaries: ShotBoundary[] = [];
      try {
        const response = await fetch(`/api/shot-boundaries?stashappSceneId=${sceneId}`);
        if (response.ok) {
          const data = await response.json();
          shotBoundaries = data.shotBoundaries.map((sb: ShotBoundaryFromAPI) =>
            shotBoundaryFromAPI(sb)
          );
        }
      } catch (error) {
        console.warn("Failed to load shot boundaries from database:", error);
        // Continue without shot boundaries if database load fails
      }

      // Load available tags and performers
      const [tagsResult, performersResult] = await Promise.all([
        stashappService.getAllTags(),
        stashappService.getAllPerformers(),
      ]);
      const availableTags = tagsResult.findTags.tags;
      const availablePerformers = performersResult.findPerformers.performers;

      // Load marker groups (if marker group parent is configured)
      console.log("🎯 [INIT] Loading marker groups during marker page initialization");
      await dispatch(loadMarkerGroups());

      return {
        scene,
        markers: sortedMarkers,
        shotBoundaries,
        availableTags,
        availablePerformers,
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
      // Load markers from local database
      const response = await fetch(`/api/markers?sceneId=${sceneId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch markers from local database");
      }
      const data = await response.json();
      const markers = data.markers || [];
      const sortedMarkers = [...markers].sort((a, b) => a.seconds - b.seconds);
      return sortedMarkers;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load markers"
      );
    }
  }
);

// Load shot boundaries (separate from markers)
export const loadShotBoundaries = createAsyncThunk(
  "marker/loadShotBoundaries",
  async (sceneId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/shot-boundaries?stashappSceneId=${sceneId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shot boundaries");
      }
      const data = await response.json();
      const shotBoundaries = data.shotBoundaries.map((sb: ShotBoundaryFromAPI) =>
        shotBoundaryFromAPI(sb)
      );
      return shotBoundaries;
    } catch (error) {
      console.warn("Failed to load shot boundaries from database:", error);
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load shot boundaries"
      );
    }
  }
);

// Create a new shot boundary
export const createShotBoundary = createAsyncThunk(
  "marker/createShotBoundary",
  async (
    params: {
      sceneId: string;
      startTime: number;
      endTime: number | null;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const response = await fetch('/api/shot-boundaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stashappSceneId: params.sceneId,
          startTime: params.startTime,
          endTime: params.endTime,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create shot boundary');
      }

      const data = await response.json();
      // Refresh shot boundaries after creation
      await dispatch(loadShotBoundaries(params.sceneId));

      return shotBoundaryFromAPI(data.shotBoundary);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to create shot boundary"
      );
    }
  }
);

// Update a shot boundary
export const updateShotBoundary = createAsyncThunk(
  "marker/updateShotBoundary",
  async (
    params: {
      sceneId: string;
      shotBoundaryId: string;
      startTime: number;
      endTime: number | null;
      source?: ShotBoundarySource;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const bodyData: {
        startTime: number;
        endTime: number | null;
        source?: ShotBoundarySource;
      } = {
        startTime: params.startTime,
        endTime: params.endTime,
      };

      // Include source if provided
      if (params.source !== undefined) {
        bodyData.source = params.source;
      }

      const response = await fetch(`/api/shot-boundaries/${params.shotBoundaryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        throw new Error('Failed to update shot boundary');
      }

      // Refresh shot boundaries after update
      await dispatch(loadShotBoundaries(params.sceneId));

      return true;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to update shot boundary"
      );
    }
  }
);

// Delete a shot boundary
export const deleteShotBoundary = createAsyncThunk(
  "marker/deleteShotBoundary",
  async (
    params: {
      sceneId: string;
      shotBoundaryId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/shot-boundaries/${params.shotBoundaryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete shot boundary');
      }

      // Refresh shot boundaries after deletion
      await dispatch(loadShotBoundaries(params.sceneId));

      return true;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to delete shot boundary"
      );
    }
  }
);

// Create a new marker (local DB first, export to Stashapp later)
export const createMarker = createAsyncThunk<
  { id: string; selectAfterRefresh: boolean },
  {
    sceneId: string;
    startTime: number;
    endTime: number | null;
    tagId: string;
    slots?: Array<{ slotDefinitionId: string; performerId: string | null }>;
  }
>(
  "marker/createMarker",
  async (
    params,
    { dispatch, rejectWithValue }
  ) => {
    try {
      // Get tag name for title
      const tagsResult = await stashappService.getAllTags();
      const tag = tagsResult.findTags.tags.find((t) => t.id === params.tagId);
      const title = tag?.name || 'Untitled';

      // Get config for marker source and status tags
      const MARKER_SOURCE_MANUAL = stashappService.markerSourceManual;
      const MARKER_STATUS_CONFIRMED = stashappService.markerStatusConfirmed;

      // Create marker in local database with slots
      // Note: primaryTagId is included automatically via isPrimary flag, don't add to tagIds
      const response = await fetch('/api/markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stashappSceneId: params.sceneId,
          title,
          seconds: params.startTime,
          endSeconds: params.endTime,
          primaryTagId: params.tagId,
          tagIds: [MARKER_SOURCE_MANUAL, MARKER_STATUS_CONFIRMED],
          slots: params.slots || [],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create marker in local database');
      }

      const data = await response.json();
      const newMarkerId = data.marker.id.toString();

      // Refresh markers after creation
      await dispatch(loadMarkers(params.sceneId));

      // Return the ID and a flag to select it after markers are loaded
      return { id: newMarkerId, selectAfterRefresh: true };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to create marker"
      );
    }
  }
);

// Update marker times (local DB first, export to Stashapp later)
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
      // Update marker in local database
      const response = await fetch(`/api/markers/${params.markerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seconds: params.startTime,
          endSeconds: params.endTime,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update marker times in local database');
      }

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

// Update marker tag (local DB first, export to Stashapp later)
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
      // Get tag name for title
      const tagsResult = await stashappService.getAllTags();
      const tag = tagsResult.findTags.tags.find((t) => t.id === params.tagId);
      const title = tag?.name || 'Untitled';

      // Update marker primary tag and title in local database
      const response = await fetch(`/api/markers/${params.markerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryTagId: params.tagId,
          title,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update marker tag in local database');
      }

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

// Delete a single marker (local DB first, export to Stashapp later)
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
      // Delete marker from local database
      const response = await fetch(`/api/markers/${params.markerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete marker from local database');
      }

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

// Bulk delete rejected markers (local DB first, export to Stashapp later)
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

      // Delete markers from local database one by one
      for (const markerId of params.rejectedMarkerIds) {
        const response = await fetch(`/api/markers/${markerId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          console.error(`Failed to delete marker ${markerId}`);
        }
      }

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

// Confirm a marker (add confirmed status tag, local DB first)
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
      // Update marker status in local database
      const response = await fetch(`/api/markers/${params.markerId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm marker in local database');
      }

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

// Reject a marker (add rejected status tag, local DB first)
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
      // Update marker status in local database
      const response = await fetch(`/api/markers/${params.markerId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject marker in local database');
      }

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

// Reset a marker (remove status tags, local DB first)
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
      // Update marker status in local database
      const response = await fetch(`/api/markers/${params.markerId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset marker in local database');
      }

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

// Add tag to marker (local DB first)
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
      // Add tag to marker in local database
      const response = await fetch(`/api/markers/${params.markerId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId: params.tagId }),
      });

      if (!response.ok) {
        throw new Error('Failed to add tag to marker in local database');
      }

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

// Convert corresponding tags to their target tags (local DB first)
export const convertAITags = createAsyncThunk(
  "marker/convertAITags",
  async (
    params: {
      sceneId: string;
      aiMarkers: { sourceMarker: SceneMarker; correspondingTag: Tag }[];
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      // Convert each marker to its corresponding target tag
      for (const { sourceMarker, correspondingTag } of params.aiMarkers) {
        // Update marker primary tag and title in local database
        const response = await fetch(`/api/markers/${sourceMarker.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryTagId: correspondingTag.id,
            title: correspondingTag.name,
          }),
        });

        if (!response.ok) {
          console.error(`Failed to convert marker ${sourceMarker.id}`);
        }
      }

      // Refresh markers after conversion
      await dispatch(loadMarkers(params.sceneId));

      return params.aiMarkers;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to convert corresponding tags"
      );
    }
  }
);

// Find confirmed markers with corresponding tags (for tag conversion workflow)
export const findConfirmedAIMarkers = createAsyncThunk(
  "marker/findConfirmedAIMarkers",
  async (markers: SceneMarker[], { rejectWithValue }) => {
    try {
      const result = await stashappService.convertConfirmedMarkersWithCorrespondingTags(markers);
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to find confirmed markers with corresponding tags"
      );
    }
  }
);

// Advanced operations (for future implementation)

// Duplicate a marker (local DB first)
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
      // Get tag name for title
      const tagsResult = await stashappService.getAllTags();
      const tag = tagsResult.findTags.tags.find((t) => t.id === params.tagId);
      const title = tag?.name || 'Untitled';

      // Get config for marker source and status tags
      const MARKER_SOURCE_MANUAL = stashappService.markerSourceManual;
      const MARKER_STATUS_CONFIRMED = stashappService.markerStatusConfirmed;

      // Create a new marker in local database
      const response = await fetch('/api/markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stashappSceneId: params.sceneId,
          title,
          seconds: params.newStartTime,
          endSeconds: params.newEndTime,
          primaryTagId: params.tagId,
          tagIds: [params.tagId, MARKER_SOURCE_MANUAL, MARKER_STATUS_CONFIRMED],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate marker in local database');
      }

      const data = await response.json();

      // Refresh markers after creation
      await dispatch(loadMarkers(params.sceneId));

      return data.marker;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to duplicate marker"
      );
    }
  }
);

// Merge markers (local DB first)
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
      // Delete the source markers from local database
      for (const markerId of params.markerIds) {
        const response = await fetch(`/api/markers/${markerId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          console.error(`Failed to delete marker ${markerId}`);
        }
      }

      // Get tag name for title
      const tagsResult = await stashappService.getAllTags();
      const tag = tagsResult.findTags.tags.find((t) => t.id === params.tagId);
      const title = tag?.name || 'Untitled';

      // Get config for marker source and status tags
      const MARKER_SOURCE_MANUAL = stashappService.markerSourceManual;
      const MARKER_STATUS_CONFIRMED = stashappService.markerStatusConfirmed;

      // Create a new merged marker in local database
      const response = await fetch('/api/markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stashappSceneId: params.sceneId,
          title,
          seconds: params.newStartTime,
          endSeconds: params.newEndTime,
          primaryTagId: params.tagId,
          tagIds: [params.tagId, MARKER_SOURCE_MANUAL, MARKER_STATUS_CONFIRMED],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create merged marker in local database');
      }

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

// Split marker (local DB first)
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
      const updateResponse = await fetch(`/api/markers/${params.sourceMarkerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seconds: params.sourceStartTime,
          endSeconds: params.splitTime,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update first part of split marker');
      }

      // Create second part (split time to end) only if there's remaining time
      if (params.sourceEndTime && params.splitTime < params.sourceEndTime) {
        // Get tag name for title
        const tagsResult = await stashappService.getAllTags();
        const tag = tagsResult.findTags.tags.find((t) => t.id === params.tagId);
        const title = tag?.name || 'Untitled';

        const createResponse = await fetch('/api/markers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stashappSceneId: params.sceneId,
            title,
            seconds: params.splitTime,
            endSeconds: params.sourceEndTime,
            primaryTagId: params.tagId,
            tagIds: params.originalTagIds, // Preserve all original tags
          }),
        });

        if (!createResponse.ok) {
          throw new Error('Failed to create second part of split marker');
        }
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

// Materialize derived markers for a source marker
export const materializeDerivedMarkers = createAsyncThunk(
  "marker/materializeDerivedMarkers",
  async (
    params: {
      markerId: string;
      derivedMarkers: Array<{
        derivedTagId: string;
        tags: string[];
        slots: Array<{ label: string; performerId: string }>;
      }>;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/markers/${params.markerId}/materialize-derived`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ derivedMarkers: params.derivedMarkers }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to materialize derived markers');
      }

      const result = await response.json();
      return result.materializedMarkers;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to materialize derived markers"
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

    setAvailablePerformers: (state, action: PayloadAction<Performer[]>) => {
      state.availablePerformers = action.payload;
    },

    // UI actions - selection
    setSelectedMarkerId: (state, action: PayloadAction<string | null>) => {
      // Note: Shot boundary marker filtering is now done in the component
      // to avoid coupling reducer logic with service constants
      state.ui.selectedMarkerId = action.payload;
    },

    // Modal actions
    setModalState: (state, action: PayloadAction<ModalState>) => {
      state.ui.modal = action.payload;
    },

    closeModal: (state) => {
      state.ui.modal = { type: 'none' };
    },

    openCompletionModal: (state, action: PayloadAction<CompletionModalData>) => {
      state.ui.modal = { type: 'completion', data: action.payload };
    },

    openCorrespondingTagConversionModal: (state, action: PayloadAction<CorrespondingTagConversionModalData>) => {
      state.ui.modal = { type: 'correspondingTagConversion', data: action.payload };
    },

    openKeyboardShortcutsModal: (state) => {
      state.ui.modal = { type: 'keyboardShortcuts' };
    },

    openCollectingModal: (state) => {
      state.ui.modal = { type: 'collecting' };
    },

    openDeleteRejectedModal: (state, action: PayloadAction<DeleteRejectedModalData>) => {
      state.ui.modal = { type: 'deleteRejected', data: action.payload };
    },

    openSlotAssignmentModal: (state, action: PayloadAction<SlotAssignmentModalData>) => {
      state.ui.modal = { type: 'slotAssignment', data: action.payload };
    },

    // UI actions - non-modal states
    setEditingMarker: (state, action: PayloadAction<boolean>) => {
      state.ui.isEditingMarker = action.payload;
    },

    setCreatingMarker: (state, action: PayloadAction<boolean>) => {
      state.ui.isCreatingMarker = action.payload;
    },

    setDuplicatingMarker: (state, action: PayloadAction<boolean>) => {
      state.ui.isDuplicatingMarker = action.payload;
    },

    setGeneratingMarkers: (state, action: PayloadAction<boolean>) => {
      state.ui.isGeneratingMarkers = action.payload;
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
      action: PayloadAction<{ sourceMarker: SceneMarker; correspondingTag: Tag }[]>
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
        // Clear previous scene data immediately to prevent showing stale markers
        state.markers = [];
        state.scene = null;
        state.sceneId = null;
        state.sceneTitle = null;
        state.ui.selectedMarkerId = null;
      })
      .addCase(initializeMarkerPage.fulfilled, (state, action) => {
        state.initializing = false;
        state.initialized = true;
        state.scene = action.payload.scene;
        state.sceneId = action.payload.scene.id;
        state.sceneTitle = action.payload.scene.title;
        state.markers = action.payload.markers;
        state.shotBoundaries = action.payload.shotBoundaries;
        state.availableTags = action.payload.availableTags;
        state.availablePerformers = action.payload.availablePerformers;
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
      .addCase(createMarker.fulfilled, (state, action) => {
        state.loading = false;
        // Select the newly created marker (markers have already been refreshed by the thunk)
        if (action.payload.selectAfterRefresh) {
          state.ui.selectedMarkerId = action.payload.id;
        }
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

      // Handle convert corresponding tags
      .addCase(convertAITags.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(convertAITags.fulfilled, (state) => {
        state.loading = false;
        // Clear the confirmed markers after conversion
        state.operations.confirmedAIMarkers = [];
      })
      .addCase(convertAITags.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to convert corresponding tags";
      })

      // Handle find confirmed markers with corresponding tags
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
          (action.payload as string) || "Failed to find confirmed markers with corresponding tags";
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

      // Handle load shot boundaries
      .addCase(loadShotBoundaries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadShotBoundaries.fulfilled, (state, action) => {
        state.loading = false;
        state.shotBoundaries = action.payload;
      })
      .addCase(loadShotBoundaries.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to load shot boundaries";
      });

  },
});

// Export actions
export const {
  setMarkers,
  setScene,
  setAvailableTags,
  setAvailablePerformers,
  setSelectedMarkerId,
  setEditingMarker,
  setCreatingMarker,
  setDuplicatingMarker,
  setGeneratingMarkers,
  // Modal actions
  setModalState,
  closeModal,
  openCompletionModal,
  openCorrespondingTagConversionModal,
  openKeyboardShortcutsModal,
  openCollectingModal,
  openDeleteRejectedModal,
  openSlotAssignmentModal,
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
export const selectShotBoundaries = (state: { marker: MarkerState }) =>
  state.marker.shotBoundaries;
export const selectScene = (state: { marker: MarkerState }) =>
  state.marker.scene;
export const selectSceneId = (state: { marker: MarkerState }) =>
  state.marker.sceneId;
export const selectSceneTitle = (state: { marker: MarkerState }) =>
  state.marker.sceneTitle;
export const selectAvailableTags = (state: { marker: MarkerState }) =>
  state.marker.availableTags;
export const selectAvailablePerformers = (state: { marker: MarkerState }) =>
  state.marker.availablePerformers;

// UI selectors
export const selectSelectedMarkerId = (state: { marker: MarkerState }) =>
  state.marker.ui.selectedMarkerId;

// UI state selectors (non-modal)
export const selectIsEditingMarker = (state: { marker: MarkerState }) =>
  state.marker.ui.isEditingMarker;
export const selectIsCreatingMarker = (state: { marker: MarkerState }) =>
  state.marker.ui.isCreatingMarker;
export const selectIsDuplicatingMarker = (state: { marker: MarkerState }) =>
  state.marker.ui.isDuplicatingMarker;
export const selectIsGeneratingMarkers = (state: { marker: MarkerState }) =>
  state.marker.ui.isGeneratingMarkers;

// Modal selectors
export const selectModalState = (state: { marker: MarkerState }) =>
  state.marker.ui.modal;

export const selectIsModalOpen = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type !== 'none';

export const selectIsCompletionModalOpen = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'completion';

export const selectIsCorrespondingTagConversionModalOpen = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'correspondingTagConversion';

export const selectIsKeyboardShortcutsModalOpen = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'keyboardShortcuts';

export const selectIsCollectingModalOpen = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'collecting';

export const selectIsDeletingRejected = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'deleteRejected';

export const selectIsSlotAssignmentModalOpen = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'slotAssignment';

// Modal data selectors
export const selectCompletionModalData = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'completion' ? state.marker.ui.modal.data : null;

export const selectCorrespondingTagConversionModalData = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'correspondingTagConversion' ? state.marker.ui.modal.data : null;

export const selectDeleteRejectedModalData = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'deleteRejected' ? state.marker.ui.modal.data : null;

export const selectSlotAssignmentModalData = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'slotAssignment' ? state.marker.ui.modal.data : null;

// Legacy selectors for backward compatibility (will be removed after refactor)
export const selectRejectedMarkers = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'deleteRejected' ? state.marker.ui.modal.data.rejectedMarkers : [];

export const selectConfirmedCorrespondingTagMarkers = (state: { marker: MarkerState }) =>
  state.marker.ui.modal.type === 'correspondingTagConversion' ? state.marker.ui.modal.data.markers : [];

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
export const selectCopiedMarkerTimes = (state: { marker: MarkerState }) =>
  state.marker.operations.copiedMarkerTimes;

// Filter selectors
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
