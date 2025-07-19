import { SceneMarker } from "../../services/StashappService";
import { MarkerSummary, MarkerWithTrack } from "./types";
import { stashappService } from "../../services/StashappService";

export const isMarkerRejected = (marker: SceneMarker): boolean => {
  return marker.primary_tag.name.endsWith("_REJECTED");
};

export const isMarkerConfirmed = (marker: SceneMarker): boolean => {
  return marker.primary_tag.name.endsWith("_CONFIRMED");
};

export const isMarkerManual = (marker: SceneMarker): boolean => {
  return (
    marker.tags?.some(
      (tag) => tag.id === stashappService.MARKER_SOURCE_MANUAL
    ) ?? false
  );
};

export const isUnprocessed = (marker: SceneMarker): boolean => {
  return (
    !isMarkerConfirmed(marker) &&
    !isMarkerRejected(marker) &&
    !isMarkerManual(marker)
  );
};

export const isShotBoundaryMarker = (marker: SceneMarker): boolean => {
  // Note: This assumes stashappService.MARKER_SHOT_BOUNDARY is available in the context
  // We'll need to inject this dependency
  return marker.primary_tag.id === "shot-boundary-tag-id"; // TODO: Make this configurable
};

export const calculateMarkerSummary = (
  actionMarkers: SceneMarker[]
): MarkerSummary => {
  if (!actionMarkers.length) return { confirmed: 0, rejected: 0, unknown: 0 };

  return actionMarkers.reduce(
    (acc: MarkerSummary, marker: SceneMarker) => {
      if (isMarkerRejected(marker)) {
        acc.rejected++;
      } else if (isMarkerConfirmed(marker) || isMarkerManual(marker)) {
        acc.confirmed++;
      } else {
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

export const getActionMarkers = (
  markers: SceneMarker[],
  filteredSwimlane: string | null
): SceneMarker[] => {
  if (!markers) {
    return [];
  }

  let filteredMarkers = markers.filter((marker) => {
    // Always include temp markers regardless of their primary tag
    if (marker.id.startsWith("temp-")) {
      return true;
    }
    // Filter out shot boundary markers for non-temp markers
    return !isShotBoundaryMarker(marker);
  });

  // Apply swimlane filter if active
  if (filteredSwimlane) {
    filteredMarkers = filteredMarkers.filter((marker) => {
      // Handle AI tag grouping - if the marker's tag name ends with "_AI",
      // group it with the base tag name for filtering
      const tagGroupName = marker.primary_tag.name.endsWith("_AI")
        ? marker.primary_tag.name.replace("_AI", "")
        : marker.primary_tag.name;
      return tagGroupName === filteredSwimlane;
    });
  }

  return filteredMarkers;
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
      isMarkerRejected(marker) ||
      isMarkerManual(marker) ||
      isShotBoundaryMarker(marker)
  );
};
