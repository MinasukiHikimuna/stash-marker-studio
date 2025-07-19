import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { MarkerState, MarkerAction } from "../core/marker/types";
import { stashappService } from "../services/StashappService";

// Initial state
const initialState: MarkerState = {
  // Raw data
  markers: [],
  availableTags: [],
  sceneId: null,
  sceneTitle: null,
  scene: null,
  selectedMarkerId: null,
  selectedMarkerIndex: 0, // Keep for backwards compatibility
  isEditingMarker: false,
  isCreatingMarker: false,
  isDuplicatingMarker: false,
  isDeletingRejected: false,
  isGeneratingMarkers: false,
  isAIConversionModalOpen: false,
  markerStartTime: null,
  markerEndTime: null,
  newTagSearch: "",
  selectedNewTag: "",
  selectedDuplicateTag: "",
  newMarkerStartTime: null,
  newMarkerEndTime: null,
  duplicateStartTime: null,
  duplicateEndTime: null,
  generationJobId: null,
  rejectedMarkers: [],
  confirmedAIMarkers: [],
  copiedMarkerTimes: null,
  videoDuration: 0,
  currentVideoTime: 0,
  videoElement: null,
  isLoading: false,
  error: null,
  filteredSwimlane: null,
  incorrectMarkers: [],
  isCollectingModalOpen: false,
};

// Helper function to find marker index by ID
const findMarkerIndex = (markers: any[], markerId: string | null) => {
  if (!markerId || !markers.length) return -1;
  return markers.findIndex((m) => m.id === markerId);
};

// Reducer function
function markerReducer(state: MarkerState, action: MarkerAction): MarkerState {
  switch (action.type) {
    case "SET_MARKERS":
      console.log("Updating markers in state:", {
        oldCount: state.markers.length,
        newCount: action.payload.length,
        oldSelectedId: state.selectedMarkerId,
      });

      // Keep the same marker selected if it still exists
      const selectedMarkerStillExists = action.payload.some(
        (m) => m.id === state.selectedMarkerId
      );
      const newSelectedId = selectedMarkerStillExists
        ? state.selectedMarkerId
        : null;
      const newSelectedIndex = findMarkerIndex(action.payload, newSelectedId);

      return {
        ...state,
        markers: action.payload,
        selectedMarkerId: newSelectedId,
        selectedMarkerIndex: newSelectedIndex >= 0 ? newSelectedIndex : 0,
      };

    case "SET_AVAILABLE_TAGS":
      return { ...state, availableTags: action.payload };

    case "SET_SCENE":
      return {
        ...state,
        scene: action.payload,
        sceneId: action.payload?.id ?? null,
        sceneTitle: action.payload?.title ?? null,
      };

    case "SET_SCENE_DATA":
      return {
        ...state,
        scene: action.payload,
      };

    case "SET_SELECTED_MARKER_ID": {
      console.log("Changing selected marker by ID:", {
        oldId: state.selectedMarkerId,
        newId: action.payload,
      });

      // Find the marker in the list
      const marker = state.markers.find((m) => m.id === action.payload);

      // Ensure we don't select a shot boundary marker
      if (marker?.primary_tag.id === stashappService.MARKER_SHOT_BOUNDARY) {
        console.log("Prevented selection of shot boundary marker");
        return state;
      }

      // Find the index for backwards compatibility
      const markerIndex = findMarkerIndex(state.markers, action.payload);

      return {
        ...state,
        selectedMarkerId: action.payload,
        selectedMarkerIndex:
          markerIndex >= 0 ? markerIndex : state.selectedMarkerIndex,
      };
    }

    case "SET_EDITING_MARKER":
      return { ...state, isEditingMarker: action.payload };
    case "SET_CREATING_MARKER":
      return { ...state, isCreatingMarker: action.payload };
    case "SET_DUPLICATING_MARKER":
      return { ...state, isDuplicatingMarker: action.payload };
    case "SET_DELETING_REJECTED":
      return { ...state, isDeletingRejected: action.payload };
    case "SET_GENERATING_MARKERS":
      return { ...state, isGeneratingMarkers: action.payload };
    case "SET_AI_CONVERSION_MODAL_OPEN":
      return { ...state, isAIConversionModalOpen: action.payload };
    case "SET_MARKER_TIMES":
      return {
        ...state,
        markerStartTime: action.payload.start,
        markerEndTime: action.payload.end,
      };
    case "SET_NEW_TAG_SEARCH":
      return { ...state, newTagSearch: action.payload };
    case "SET_SELECTED_NEW_TAG":
      return { ...state, selectedNewTag: action.payload };
    case "SET_SELECTED_DUPLICATE_TAG":
      return { ...state, selectedDuplicateTag: action.payload };
    case "SET_NEW_MARKER_TIMES":
      return {
        ...state,
        newMarkerStartTime: action.payload.start,
        newMarkerEndTime: action.payload.end,
      };
    case "SET_DUPLICATE_TIMES":
      return {
        ...state,
        duplicateStartTime: action.payload.start,
        duplicateEndTime: action.payload.end,
      };
    case "SET_GENERATION_JOB_ID":
      return { ...state, generationJobId: action.payload };
    case "SET_REJECTED_MARKERS":
      return { ...state, rejectedMarkers: action.payload };
    case "SET_CONFIRMED_AI_MARKERS":
      return { ...state, confirmedAIMarkers: action.payload };
    case "SET_COPIED_MARKER_TIMES":
      return { ...state, copiedMarkerTimes: action.payload };
    case "SET_VIDEO_DURATION":
      return { ...state, videoDuration: action.payload };
    case "SET_CURRENT_VIDEO_TIME":
      return { ...state, currentVideoTime: action.payload };
    case "SET_VIDEO_ELEMENT":
      return { ...state, videoElement: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_FILTERED_SWIMLANE":
      return { ...state, filteredSwimlane: action.payload };
    case "SET_INCORRECT_MARKERS":
      return { ...state, incorrectMarkers: action.payload };
    case "SET_COLLECTING_MODAL_OPEN":
      return { ...state, isCollectingModalOpen: action.payload };
    case "RESET_STATE":
      return initialState;
    default:
      return state;
  }
}

// Create context
const MarkerContext = createContext<
  | {
      state: MarkerState;
      dispatch: React.Dispatch<MarkerAction>;
    }
  | undefined
>(undefined);

// Provider component
export function MarkerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(markerReducer, initialState);

  return (
    <MarkerContext.Provider value={{ state, dispatch }}>
      {children}
    </MarkerContext.Provider>
  );
}

// Custom hook for using the marker context
export function useMarker() {
  const context = useContext(MarkerContext);
  if (context === undefined) {
    throw new Error("useMarker must be used within a MarkerProvider");
  }
  return context;
}
