import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { MarkerState, MarkerAction } from "../core/marker/types";

// Initial state
const initialState: MarkerState = {
  // Raw data
  markers: [],
  availableTags: [],
  sceneId: null,
  sceneTitle: null,
  scene: null,
  selectedMarkerIndex: 0,
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

// Reducer function
function markerReducer(state: MarkerState, action: MarkerAction): MarkerState {
  switch (action.type) {
    case "SET_MARKERS":
      return { ...state, markers: action.payload };
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
    case "SET_SELECTED_MARKER_INDEX":
      return { ...state, selectedMarkerIndex: action.payload };
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
