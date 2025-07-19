import { MarkerState, MarkerAction } from "./types";

export const initialMarkerState: MarkerState = {
  // Raw data
  markers: [],
  availableTags: [],
  sceneId: null,
  sceneTitle: null,
  scene: null,

  // UI state
  selectedMarkerIndex: -1,
  isEditingMarker: false,
  isCreatingMarker: false,
  isDuplicatingMarker: false,
  isDeletingRejected: false,
  isGeneratingMarkers: false,
  isAIConversionModalOpen: false,

  // Temporary state for operations
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

  // Marker time copying
  copiedMarkerTimes: null,

  // Video state
  videoDuration: 0,
  currentVideoTime: 0,
  videoElement: null,

  // Loading and error states
  isLoading: false,
  error: null,

  // Swimlane filter state
  filteredSwimlane: null,
  incorrectMarkers: [],
  isCollectingModalOpen: false,
};

export const markerReducer = (
  state: MarkerState,
  action: MarkerAction
): MarkerState => {
  switch (action.type) {
    case "SET_SCENE":
      return {
        ...state,
        scene: action.payload,
        sceneId: action.payload?.id || null,
        sceneTitle: action.payload?.title || null,
      };
    case "SET_SCENE_DATA":
      return {
        ...state,
        scene: action.payload,
      };
    case "SET_MARKERS":
      return {
        ...state,
        markers: action.payload,
      };
    case "SET_SELECTED_MARKER_INDEX":
      return {
        ...state,
        selectedMarkerIndex: action.payload,
      };
    case "SET_VIDEO_ELEMENT":
      return {
        ...state,
        videoElement: action.payload,
      };
    case "SET_VIDEO_DURATION":
      return {
        ...state,
        videoDuration: action.payload,
      };
    case "SET_CURRENT_VIDEO_TIME":
      return {
        ...state,
        currentVideoTime: action.payload,
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };
    case "SET_EDITING_MARKER":
      return {
        ...state,
        isEditingMarker: action.payload,
      };
    case "SET_COPIED_MARKER_TIMES":
      return {
        ...state,
        copiedMarkerTimes: action.payload,
      };
    case "SET_INCORRECT_MARKERS":
      return {
        ...state,
        incorrectMarkers: action.payload,
      };
    case "SET_FILTERED_SWIMLANE":
      return {
        ...state,
        filteredSwimlane: action.payload,
      };
    case "SET_AVAILABLE_TAGS":
      return {
        ...state,
        availableTags: action.payload,
      };
    case "SET_COLLECTING_MODAL_OPEN":
      return {
        ...state,
        isCollectingModalOpen: action.payload,
      };
    default:
      return state;
  }
};
