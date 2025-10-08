import {
  type SceneMarker,
  stashappService,
} from "../../services/StashappService";
import { MarkerSummary, MarkerWithTrack, MarkerStatus } from "./types";

export const isMarkerRejected = (marker: SceneMarker): boolean => {
  return (
    marker.tags?.some(
      (tag) => tag.id === stashappService.markerStatusRejected
    ) ?? false
  );
};

export const isMarkerConfirmed = (marker: SceneMarker): boolean => {
  return (
    marker.tags?.some(
      (tag) => tag.id === stashappService.markerStatusConfirmed
    ) ?? false
  );
};

export const isUnprocessed = (marker: SceneMarker): boolean => {
  return !isMarkerConfirmed(marker) && !isMarkerRejected(marker);
};

/**
 * Returns true if a marker has been processed (confirmed, rejected, or manual)
 */
export const isProcessed = (marker: SceneMarker): boolean => {
  return isMarkerConfirmed(marker) || isMarkerRejected(marker);
};

/**
 * Returns the current status of a marker
 * Priority order: REJECTED > MANUAL > CONFIRMED > UNPROCESSED
 */
export const getMarkerStatus = (marker: SceneMarker): MarkerStatus => {
  if (isMarkerRejected(marker)) return MarkerStatus.REJECTED;
  if (isMarkerConfirmed(marker)) return MarkerStatus.CONFIRMED;
  return MarkerStatus.UNPROCESSED;
};

/**
 * Filters an array of markers to return only unprocessed markers
 */
export const filterUnprocessedMarkers = (
  markers: SceneMarker[]
): SceneMarker[] => {
  return markers.filter(isUnprocessed);
};

export const calculateMarkerSummary = (
  markers: SceneMarker[]
): MarkerSummary => {
  if (!markers.length) return { confirmed: 0, rejected: 0, unknown: 0 };

  return markers.reduce(
    (acc: MarkerSummary, marker: SceneMarker) => {
      const status = getMarkerStatus(marker);
      switch (status) {
        case MarkerStatus.REJECTED:
          acc.rejected++;
          break;
        case MarkerStatus.CONFIRMED:
          acc.confirmed++;
          break;
        default:
          acc.unknown++;
      }
      return acc;
    },
    { confirmed: 0, rejected: 0, unknown: 0 }
  );
};

export const formatSeconds = (
  seconds: number,
  showMilliseconds: boolean = false
): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  let result = "";
  if (hours > 0) {
    result += `${hours}:`;
  }
  result += `${minutes.toString().padStart(2, "0")}:`;
  if (showMilliseconds) {
    result += remainingSeconds.toFixed(3).padStart(6, "0");
  } else {
    result += Math.floor(remainingSeconds).toString().padStart(2, "0");
  }
  return result;
};

export const formatTimeColonDot = (seconds: number): string => {
  return seconds.toFixed(3);
};

export const parseTimeColonDot = (str: string): number => {
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const findNearestMarker = (
  markers: MarkerWithTrack[],
  currentTime: number,
  direction: "prev" | "next"
): number => {
  if (!markers.length) return -1;

  let nearestIndex = -1;
  let nearestDistance = Infinity;

  markers.forEach((marker, index) => {
    const distance =
      direction === "prev"
        ? currentTime - marker.seconds
        : marker.seconds - currentTime;

    if (distance > 0 && distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
};

export const checkAllMarkersApproved = (markers: SceneMarker[]): boolean => {
  return markers.every(
    (marker) =>
      isMarkerConfirmed(marker) ||
      isMarkerRejected(marker)
  );
};
