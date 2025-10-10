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
import { selectDerivedMarkerDepths } from "../../store/slices/markerSlice";

export interface TimelineMarkerBarProps {
  marker: SceneMarker;
  left: number;
  width: number;
  isSelected: boolean;
  onClick: (marker: SceneMarker) => void;
}

/**
 * Get marker color and style classes based on status and derivation depth
 *
 * Depth interpretation:
 * - depth = 0: Selected marker (normal styling)
 * - depth < 0: Source/ancestor markers (brighter + thicker border)
 * - depth > 0: Derived/descendant markers (darker + thinner border)
 */
function getMarkerStyleClasses(
  status: MarkerStatus,
  isSelected: boolean,
  depth: number
): string {
  let baseClasses = "transition-colors duration-150";

  if (isSelected) {
    baseClasses = `${baseClasses} ring-2 ring-white`;
  }

  // Determine border thickness based on depth
  // Sources (negative depth): thicker borders
  // Derived (positive depth): thinner borders
  let borderStyle = "";
  if (depth < 0) {
    // Source markers - thicker border
    const borderWidth = Math.min(Math.abs(depth) + 2, 5); // 3px to 5px
    borderStyle = `border-${borderWidth} border-solid`;
  } else if (depth > 0) {
    // Derived markers - thinner or dotted border
    if (depth === 1) {
      borderStyle = "border-2 border-solid";
    } else {
      borderStyle = "border-2 border-dashed";
    }
  }

  // Get base colors based on status
  let colorClasses = baseClasses;

  if (depth === 0) {
    // Normal selected marker
    switch (status) {
      case MarkerStatus.CONFIRMED:
        colorClasses = `${baseClasses} bg-green-600 hover:bg-green-700`;
        break;
      case MarkerStatus.REJECTED:
        colorClasses = `${baseClasses} bg-red-600 hover:bg-red-700`;
        break;
      case MarkerStatus.UNPROCESSED:
        colorClasses = `${baseClasses} bg-yellow-500 hover:bg-yellow-600`;
        break;
      default:
        colorClasses = `${baseClasses} bg-gray-500 hover:bg-gray-600`;
    }
  } else if (depth < 0) {
    // Source markers - BRIGHTER colors (going up the chain)
    const brightnessStep = Math.min(Math.abs(depth), 3);
    switch (status) {
      case MarkerStatus.CONFIRMED:
        colorClasses = brightnessStep === 1
          ? `${baseClasses} bg-green-500 hover:bg-green-600 ${borderStyle} border-green-400`
          : brightnessStep === 2
          ? `${baseClasses} bg-green-400 hover:bg-green-500 ${borderStyle} border-green-300`
          : `${baseClasses} bg-green-300 hover:bg-green-400 ${borderStyle} border-green-200`;
        break;
      case MarkerStatus.REJECTED:
        colorClasses = brightnessStep === 1
          ? `${baseClasses} bg-red-500 hover:bg-red-600 ${borderStyle} border-red-400`
          : brightnessStep === 2
          ? `${baseClasses} bg-red-400 hover:bg-red-500 ${borderStyle} border-red-300`
          : `${baseClasses} bg-red-300 hover:bg-red-400 ${borderStyle} border-red-200`;
        break;
      case MarkerStatus.UNPROCESSED:
        colorClasses = brightnessStep === 1
          ? `${baseClasses} bg-yellow-400 hover:bg-yellow-500 ${borderStyle} border-yellow-300`
          : brightnessStep === 2
          ? `${baseClasses} bg-yellow-300 hover:bg-yellow-400 ${borderStyle} border-yellow-200`
          : `${baseClasses} bg-yellow-200 hover:bg-yellow-300 ${borderStyle} border-yellow-100`;
        break;
      default:
        colorClasses = `${baseClasses} bg-gray-400 hover:bg-gray-500 ${borderStyle} border-gray-300`;
    }
  } else {
    // Derived markers - DARKER colors (going down the chain)
    const darknessStep = Math.min(depth, 3);
    switch (status) {
      case MarkerStatus.CONFIRMED:
        colorClasses = darknessStep === 1
          ? `${baseClasses} bg-green-700 hover:bg-green-600 ${borderStyle} border-green-800`
          : darknessStep === 2
          ? `${baseClasses} bg-green-800 hover:bg-green-700 ${borderStyle} border-green-900`
          : `${baseClasses} bg-green-900 hover:bg-green-800 ${borderStyle} border-green-950`;
        break;
      case MarkerStatus.REJECTED:
        colorClasses = darknessStep === 1
          ? `${baseClasses} bg-red-700 hover:bg-red-600 ${borderStyle} border-red-800`
          : darknessStep === 2
          ? `${baseClasses} bg-red-800 hover:bg-red-700 ${borderStyle} border-red-900`
          : `${baseClasses} bg-red-900 hover:bg-red-800 ${borderStyle} border-red-950`;
        break;
      case MarkerStatus.UNPROCESSED:
        colorClasses = darknessStep === 1
          ? `${baseClasses} bg-yellow-600 hover:bg-yellow-500 ${borderStyle} border-yellow-700`
          : darknessStep === 2
          ? `${baseClasses} bg-yellow-700 hover:bg-yellow-600 ${borderStyle} border-yellow-800`
          : `${baseClasses} bg-yellow-800 hover:bg-yellow-700 ${borderStyle} border-yellow-900`;
        break;
      default:
        colorClasses = `${baseClasses} bg-gray-700 hover:bg-gray-600 ${borderStyle} border-gray-800`;
    }
  }

  return colorClasses;
}

export const TimelineMarkerBar: React.FC<TimelineMarkerBarProps> = ({
  marker,
  left,
  width,
  isSelected,
  onClick,
}) => {
  const depthMap = useAppSelector(selectDerivedMarkerDepths);

  const status = getMarkerStatus(marker);

  // Get the depth of this marker relative to the selected marker
  // depth < 0 = source/ancestor, depth > 0 = derived/descendant, undefined = not related
  const depth = depthMap.get(marker.id) ?? 0;
  const hasDerivationRelationship = depthMap.has(marker.id);

  const colorClasses = hasDerivationRelationship
    ? getMarkerStyleClasses(status, isSelected, depth)
    : getMarkerStyleClasses(status, isSelected, 0);

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
        title={`${marker.primary_tag.name} - ${marker.seconds}s${hasDerivationRelationship ? ` (depth: ${depth})` : ''}`}
        data-marker-id={marker.id}
        data-testid="timeline-marker-bar"
      />
    </div>
  );
};

export default TimelineMarkerBar;
