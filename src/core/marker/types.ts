import { Tag, SceneMarker, Scene } from "../../services/StashappService";
import type { IncorrectMarker } from "@/utils/incorrectMarkerStorage";

export type MarkerSummary = {
  confirmed: number;
  rejected: number;
  unknown: number;
};

export type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

export type MarkerWithTrack = SceneMarker & {
  track: number;
  swimlane: number;
  tagGroup: string;
};

export type TagGroup = {
  name: string;
  tags: Tag[];
  markers: SceneMarker[];
  isRejected: boolean;
};

export type MarkerState = {
  // Raw data
  markers: SceneMarker[];
  availableTags: Tag[];
  sceneId: string | null;
  sceneTitle: string | null;
  scene: Scene | null;

  // UI state
  selectedMarkerIndex: number;
  isEditingMarker: boolean;
  isCreatingMarker: boolean;
  isDuplicatingMarker: boolean;
  isDeletingRejected: boolean;
  isGeneratingMarkers: boolean;
  isAIConversionModalOpen: boolean;

  // Temporary state for operations
  markerStartTime: number | null;
  markerEndTime: number | null;
  newTagSearch: string;
  selectedNewTag: string;
  selectedDuplicateTag: string;
  newMarkerStartTime: number | null;
  newMarkerEndTime: number | null;
  duplicateStartTime: number | null;
  duplicateEndTime: number | null;
  generationJobId: string | null;
  rejectedMarkers: SceneMarker[];
  confirmedAIMarkers: { aiMarker: SceneMarker; correspondingTag: Tag }[];

  // Marker time copying
  copiedMarkerTimes: { start: number; end: number | undefined } | null;

  // Video state
  videoDuration: number;
  currentVideoTime: number;
  videoElement: HTMLVideoElement | null;

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Swimlane filter state
  filteredSwimlane: string | null; // null means show all, string is the tag group name
  incorrectMarkers: IncorrectMarker[];
  isCollectingModalOpen: boolean;
};

export type MarkerAction =
  | { type: "SET_SCENE"; payload: Scene | null }
  | { type: "SET_SCENE_DATA"; payload: Scene | null }
  | { type: "SET_MARKERS"; payload: SceneMarker[] }
  | { type: "SET_AVAILABLE_TAGS"; payload: Tag[] }
  | { type: "SET_SELECTED_MARKER_INDEX"; payload: number }
  | { type: "SET_EDITING_MARKER"; payload: boolean }
  | { type: "SET_CREATING_MARKER"; payload: boolean }
  | { type: "SET_DUPLICATING_MARKER"; payload: boolean }
  | { type: "SET_DELETING_REJECTED"; payload: boolean }
  | { type: "SET_GENERATING_MARKERS"; payload: boolean }
  | { type: "SET_AI_CONVERSION_MODAL_OPEN"; payload: boolean }
  | {
      type: "SET_MARKER_TIMES";
      payload: { start: number | null; end: number | null };
    }
  | { type: "SET_NEW_TAG_SEARCH"; payload: string }
  | { type: "SET_SELECTED_NEW_TAG"; payload: string }
  | { type: "SET_SELECTED_DUPLICATE_TAG"; payload: string }
  | {
      type: "SET_NEW_MARKER_TIMES";
      payload: { start: number | null; end: number | null };
    }
  | {
      type: "SET_DUPLICATE_TIMES";
      payload: { start: number | null; end: number | null };
    }
  | { type: "SET_GENERATION_JOB_ID"; payload: string | null }
  | { type: "SET_REJECTED_MARKERS"; payload: SceneMarker[] }
  | {
      type: "SET_CONFIRMED_AI_MARKERS";
      payload: { aiMarker: SceneMarker; correspondingTag: Tag }[];
    }
  | {
      type: "SET_COPIED_MARKER_TIMES";
      payload: { start: number; end: number | undefined } | null;
    }
  | { type: "SET_VIDEO_DURATION"; payload: number }
  | { type: "SET_CURRENT_VIDEO_TIME"; payload: number }
  | { type: "SET_VIDEO_ELEMENT"; payload: HTMLVideoElement | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_FILTERED_SWIMLANE"; payload: string | null }
  | { type: "SET_INCORRECT_MARKERS"; payload: IncorrectMarker[] }
  | { type: "SET_COLLECTING_MODAL_OPEN"; payload: boolean }
  | { type: "RESET_STATE" };

export interface MarkerContextType {
  state: MarkerState;
  dispatch: React.Dispatch<MarkerAction>;
}

export type MarkerFormProps = {
  marker: SceneMarker;
  availableTags: Tag[];
  videoElement: HTMLVideoElement | null;
  onSave: (start: number, end: number | null, tagId: string) => void;
  onCancel: () => void;
  isDuplicate?: boolean;
};

export type TagAutocompleteProps = {
  value: string;
  onChange: (tagId: string) => void;
  availableTags: Tag[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onSave?: (tagId?: string) => void;
  onCancel?: () => void;
};
