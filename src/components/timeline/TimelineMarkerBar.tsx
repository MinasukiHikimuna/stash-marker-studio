/**
 * TimelineMarkerBar - Visual representation of a single marker on the timeline
 *
 * This is a pure presentational component that renders a marker bar with:
 * - Position and width based on time
 * - Color based on confirmation status
 * - Visual feedback for selection and hover states
 * - Click handling
 */

import React from "react";
import { SceneMarker } from "../../services/StashappService";
import { MarkerStatus } from "../../core/marker/types";
import { getMarkerStatus } from "../../core/marker/markerLogic";
import { useAppSelector } from "../../store/hooks";
import { selectDerivedMarkerIds, selectSourceMarkerIds } from "../../store/slices/markerSlice";

export interface TimelineMarkerBarProps {
  marker: SceneMarker;
  left: number;
  width: number;
  isSelected: boolean;
  onClick: (marker: SceneMarker) => void;
}

/**
 * Get marker color classes based on status and derivation relationship
 */
function getMarkerColorClasses(
  status: MarkerStatus,
  isSelected: boolean,
  isDerivedRelationship: boolean
): string {
  let baseClasses = "transition-colors duration-150";

  if (isSelected) {
    baseClasses = `${baseClasses} ring-2 ring-white`;
  }

  // If this marker has a derivation relationship with the selected marker, use darker colors
  if (isDerivedRelationship) {
    switch (status) {
      case MarkerStatus.CONFIRMED:
        return `${baseClasses} bg-green-800 hover:bg-green-700`;
      case MarkerStatus.REJECTED:
        return `${baseClasses} bg-red-800 hover:bg-red-700`;
      case MarkerStatus.UNPROCESSED:
        return `${baseClasses} bg-yellow-800 hover:bg-yellow-600`;
      default:
        return `${baseClasses} bg-gray-700 hover:bg-gray-600`;
    }
  }

  // Normal colors for non-derived markers
  switch (status) {
    case MarkerStatus.CONFIRMED:
      return `${baseClasses} bg-green-600 hover:bg-green-700`;
    case MarkerStatus.REJECTED:
      return `${baseClasses} bg-red-600 hover:bg-red-700`;
    case MarkerStatus.UNPROCESSED:
      return `${baseClasses} bg-yellow-500 hover:bg-yellow-600`;
    default:
      return `${baseClasses} bg-gray-500 hover:bg-gray-600`;
  }
}

export const TimelineMarkerBar: React.FC<TimelineMarkerBarProps> = ({
  marker,
  left,
  width,
  isSelected,
  onClick,
}) => {
  const derivedMarkerIds = useAppSelector(selectDerivedMarkerIds);
  const sourceMarkerIds = useAppSelector(selectSourceMarkerIds);

  const status = getMarkerStatus(marker);

  // Check if this marker is related to the selected marker through derivation
  const isDerivedFromSelected = sourceMarkerIds.has(marker.id);
  const isSourceForSelected = derivedMarkerIds.has(marker.id);
  const isDerivedRelationship = isDerivedFromSelected || isSourceForSelected;

  const colorClasses = getMarkerColorClasses(status, isSelected, isDerivedRelationship);

  // Marker height is reduced from track height for visual clarity
  const MARKER_HEIGHT = 18; // TRACK_HEIGHT (24) - 6

  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        height: '24px', // TRACK_HEIGHT
      }}
    >
      <div
        className={`cursor-pointer rounded w-full ${colorClasses}`}
        style={{
          height: `${MARKER_HEIGHT}px`,
        }}
        onClick={() => onClick(marker)}
        title={`${marker.primary_tag.name} - ${marker.seconds}s`}
        data-marker-id={marker.id}
        data-testid="timeline-marker-bar"
      />
    </div>
  );
};

export default TimelineMarkerBar;
