import { Tag, SceneMarker } from "../../services/StashappService";

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

export enum MarkerStatus {
  CONFIRMED = "confirmed",
  REJECTED = "rejected",
  MANUAL = "manual",
  UNPROCESSED = "unprocessed",
}
