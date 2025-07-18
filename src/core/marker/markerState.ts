import { MarkerState, MarkerAction } from "./types";

export const initialMarkerState: MarkerState = {
  scene: null,
  markers: null,
  selectedMarkerIndex: -1,
  videoElement: null,
  videoDuration: 0,
  currentVideoTime: 0,
  isLoading: false,
  error: null,
  isEditingMarker: false,
  copiedMarkerTimes: null,
  incorrectMarkers: [],
  filteredSwimlane: null,
  availableTags: [],
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
      };
    case "SET_SCENE_DATA":
      return {
        ...state,
        scene: {
          ...state.scene!,
          ...action.payload,
        },
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
