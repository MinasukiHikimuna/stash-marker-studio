/**
 * TimelineGrid - Renders the swimlane grid with positioned markers
 *
 * This component:
 * - Renders swimlane rows based on tag groups
 * - Positions markers within their assigned tracks using TimelineMarkerBar
 * - Renders playhead indicator for each swimlane
 * - Handles marker selection and click events
 * - Displays marker tooltips on hover
 * - Shows multi-track swimlanes when markers overlap
 */

"use client";

import React, { useCallback, useState } from "react";
import { SceneMarker } from "../../services/StashappService";
import { TagGroup, MarkerWithTrack } from "../../core/marker/types";
import { TimelineMarkerBar } from "../timeline/TimelineMarkerBar";
import TimelinePlayhead from "./TimelinePlayhead";
import { calculateMarkerPosition } from "../../core/timeline/calculations";

export interface TimelineGridProps {
  /** Tag groups with markers organized by primary tag */
  tagGroups: TagGroup[];
  /** Markers with track assignments for proper vertical positioning */
  markersWithTracks: MarkerWithTrack[];
  /** Track count per tag group for calculating swimlane heights */
  trackCountsByGroup: Record<string, number>;
  /** Pixels per second for positioning calculations */
  pixelsPerSecond: number;
  /** Total timeline width in pixels */
  timelineWidth: number;
  /** Current video playback time in seconds */
  currentTime: number;
  /** Currently selected marker ID */
  selectedMarkerId: string | null;
  /** Callback when a marker is clicked */
  onMarkerClick: (marker: SceneMarker) => void;
}

// Track layout constants
const TRACK_HEIGHT = 24; // Height per track in pixels
const TRACK_SPACING = 2; // Spacing between tracks
const SWIMLANE_PADDING = 4; // Padding at top and bottom of swimlane

/**
 * Format time in seconds to MM:SS format
 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  tagGroups,
  markersWithTracks,
  trackCountsByGroup,
  pixelsPerSecond,
  timelineWidth,
  currentTime,
  selectedMarkerId,
  onMarkerClick,
}) => {
  const [markerTooltip, setMarkerTooltip] = useState<{
    marker: SceneMarker;
    x: number;
    y: number;
  } | null>(null);

  // Marker tooltip handlers
  const handleMarkerMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, marker: SceneMarker) => {
      setMarkerTooltip({
        marker: marker,
        x: e.clientX,
        y: e.clientY,
      });
    },
    []
  );

  const handleMarkerMouseLeave = useCallback(() => {
    setMarkerTooltip(null);
  }, []);

  const handleMarkerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, marker: SceneMarker) => {
      if (markerTooltip && markerTooltip.marker.id === marker.id) {
        setMarkerTooltip({
          marker: marker,
          x: e.clientX,
          y: e.clientY,
        });
      }
    },
    [markerTooltip]
  );

  return (
    <>
      <div className="relative overflow-hidden" style={{ width: `${timelineWidth}px` }}>
        {tagGroups.map((group, index) => {
          const trackCount = trackCountsByGroup[group.name] || 1;
          const swimlaneHeight =
            trackCount * TRACK_HEIGHT +
            (trackCount - 1) * TRACK_SPACING +
            SWIMLANE_PADDING;

          // Get markers with track assignments for this group
          const groupMarkersWithTracks = markersWithTracks.filter(
            (m) => m.tagGroup === group.name
          );

          // Check if this swimlane contains the selected marker
          const isSelectedMarkerInThisGroup = groupMarkersWithTracks.some(
            (m) => m.id === selectedMarkerId
          );

          return (
            <div
              key={group.name}
              className={`
                border-b border-gray-600 relative
                ${
                  isSelectedMarkerInThisGroup
                    ? "bg-gray-700"
                    : index % 2 === 0
                      ? "bg-gray-800"
                      : "bg-gray-900"
                }
              `}
              style={{ height: `${swimlaneHeight}px` }}
            >
              {/* Playhead for this swimlane */}
              <TimelinePlayhead
                currentTime={currentTime}
                pixelsPerSecond={pixelsPerSecond}
                swimlaneHeight={swimlaneHeight}
              />

              {/* Markers in this swimlane */}
              {groupMarkersWithTracks.map((marker) => {
                const { left, width } = calculateMarkerPosition(
                  marker,
                  pixelsPerSecond
                );
                const isSelected = marker.id === selectedMarkerId;

                // Calculate track position
                const trackTop =
                  SWIMLANE_PADDING / 2 +
                  marker.track * (TRACK_HEIGHT + TRACK_SPACING);

                return (
                  <div
                    key={marker.id}
                    className="absolute"
                    style={{
                      left: `${left}px`,
                      top: `${trackTop}px`,
                      width: `${width}px`,
                      height: `${TRACK_HEIGHT}px`,
                    }}
                    onMouseEnter={(e) => handleMarkerMouseEnter(e, marker)}
                    onMouseLeave={handleMarkerMouseLeave}
                    onMouseMove={(e) => handleMarkerMouseMove(e, marker)}
                  >
                    <TimelineMarkerBar
                      marker={marker}
                      left={0}
                      width={width}
                      isSelected={isSelected}
                      onClick={onMarkerClick}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Marker tooltip */}
      {markerTooltip && (
        <div
          className="fixed z-[9000] bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-gray-600 max-w-md"
          style={{
            left: `${markerTooltip.x}px`,
            top: `${markerTooltip.y}px`,
            transform: "translate(-100%, -100%)",
            pointerEvents: "none",
          }}
        >
          <div className="space-y-2">
            <div className="font-bold text-lg">
              {markerTooltip.marker.primary_tag.name}
            </div>
            <div className="text-sm text-gray-400">
              ID: {markerTooltip.marker.id}
            </div>

            {markerTooltip.marker.primary_tag.description && (
              <div className="text-sm text-gray-300 border-t border-gray-600 pt-2">
                <div className="font-semibold mb-1">Description:</div>
                <div>{markerTooltip.marker.primary_tag.description}</div>
              </div>
            )}

            <div className="text-sm text-gray-400">
              <div className="font-semibold mb-1">Time:</div>
              <div>
                {markerTooltip.marker.end_seconds
                  ? `${formatTime(markerTooltip.marker.seconds)} - ${formatTime(
                      markerTooltip.marker.end_seconds
                    )}`
                  : formatTime(markerTooltip.marker.seconds)}
              </div>
            </div>

            {markerTooltip.marker.tags.length > 0 && (
              <div className="text-sm text-gray-400">
                <div className="font-semibold mb-1">Other Tags:</div>
                <div className="flex flex-wrap gap-1">
                  {markerTooltip.marker.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="bg-gray-700 px-2 py-1 rounded text-xs"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TimelineGrid;
