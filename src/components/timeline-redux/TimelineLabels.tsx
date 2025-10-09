/**
 * TimelineLabels - Left sidebar showing tag names and marker status counts
 *
 * This component:
 * - Renders label rows matching swimlane heights
 * - Displays tag names with marker group prefixes
 * - Shows status counts (confirmed/rejected/pending)
 * - Handles multi-track swimlanes
 * - Provides visual feedback for selection
 * - Supports scrolling to selected markers via refs
 */

"use client";

import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { TagGroup } from "../../core/marker/types";
import {
  isMarkerConfirmed,
  isMarkerRejected,
} from "../../core/marker/markerLogic";
import { getMarkerGroupName } from "../../core/marker/markerGrouping";

export interface TimelineLabelsProps {
  /** Tag groups with markers organized by primary tag */
  tagGroups: TagGroup[];
  /** Track count per tag group for calculating row heights */
  trackCountsByGroup: Record<string, number>;
  /** Width of the label column in pixels */
  labelWidth: number;
  /** Currently selected marker ID */
  selectedMarkerId: string | null;
  /** Marker group parent tag ID for grouping display */
  markerGroupParentId: string | null;
  /** Optional callback when reassignment icon is clicked */
  onReassignClick?: (tagName: string, tagGroupMarkers: TagGroup) => void;
}

// Track layout constants (must match TimelineGrid)
const TRACK_HEIGHT = 24;
const TRACK_SPACING = 2;
const SWIMLANE_PADDING = 4;

/**
 * Calculate status counts for a tag group
 */
function calculateStatusCounts(tagGroup: TagGroup) {
  return {
    confirmed: tagGroup.markers.filter(isMarkerConfirmed).length,
    rejected: tagGroup.markers.filter(isMarkerRejected).length,
    pending: tagGroup.markers.filter(
      (marker) => !isMarkerConfirmed(marker) && !isMarkerRejected(marker)
    ).length,
  };
}

const TimelineLabelsComponent: React.FC<TimelineLabelsProps> = ({
  tagGroups,
  trackCountsByGroup,
  labelWidth,
  selectedMarkerId,
  markerGroupParentId,
  onReassignClick,
}) => {
  // Ref to track swimlane elements for scrolling
  const swimlaneRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Find which swimlane contains the selected marker
  const selectedMarkerSwimlane = useMemo(() => {
    if (!selectedMarkerId) return null;

    for (const group of tagGroups) {
      if (group.markers.some((marker) => marker.id === selectedMarkerId)) {
        return group.name;
      }
    }
    return null;
  }, [selectedMarkerId, tagGroups]);

  // Auto-scroll to the swimlane containing the selected marker
  useEffect(() => {
    if (selectedMarkerSwimlane) {
      const swimlaneElement = swimlaneRefs.current.get(selectedMarkerSwimlane);
      if (swimlaneElement) {
        swimlaneElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [selectedMarkerSwimlane]);

  // Track which marker groups we've already shown to determine when to make text transparent
  const shownMarkerGroups = new Set<string>();

  const handleReassignClick = useCallback(
    (e: React.MouseEvent, tagGroup: TagGroup) => {
      e.stopPropagation();
      if (onReassignClick) {
        onReassignClick(tagGroup.name, tagGroup);
      }
    },
    [onReassignClick]
  );

  return (
    <div>
      {tagGroups.map((group, index) => {
        const trackCount = trackCountsByGroup[group.name] || 1;

        // Get marker group info if available
        const markerGroup =
          markerGroupParentId && group.markers[0]
            ? getMarkerGroupName(group.markers[0], markerGroupParentId)
            : null;

        // Determine if this is the first swimlane for this marker group
        const markerGroupKey = markerGroup?.fullName || "";
        const isFirstInMarkerGroup = !shownMarkerGroups.has(markerGroupKey);
        if (markerGroupKey) {
          shownMarkerGroups.add(markerGroupKey);
        }

        // Check if this swimlane contains the selected marker
        const isSelectedMarkerInThisGroup = selectedMarkerSwimlane === group.name;

        // Calculate status counts
        const counts = calculateStatusCounts(group);

        return (
          <div
            key={group.name}
            className="flex-shrink-0 bg-gray-900 border-r border-gray-600 flex flex-col"
            style={{ width: `${labelWidth}px` }}
            ref={(el) => {
              if (el) {
                swimlaneRefs.current.set(group.name, el);
              } else {
                swimlaneRefs.current.delete(group.name);
              }
            }}
          >
            {Array.from({ length: trackCount }).map((_, trackIndex) => (
              <div
                key={trackIndex}
                className={`
                  flex items-center px-3 text-sm transition-colors
                  ${
                    group.isRejected
                      ? "bg-red-900/40"
                      : isSelectedMarkerInThisGroup
                        ? "bg-gray-700"
                        : index % 2 === 0
                          ? "bg-gray-800"
                          : "bg-gray-900"
                  }
                  ${trackIndex === trackCount - 1 ? "border-b border-gray-600" : ""}
                `}
                style={{
                  height: `${TRACK_HEIGHT + (trackIndex === trackCount - 1 ? SWIMLANE_PADDING : TRACK_SPACING)}px`,
                }}
              >
                {/* Only show label and counts on the first track */}
                {trackIndex === 0 ? (
                  <div className="flex items-center justify-between w-full group/swimlane">
                    <div className="flex items-center gap-2 truncate">
                      {markerGroup && (
                        <span
                          className={`text-xs ${
                            isFirstInMarkerGroup
                              ? "text-blue-300"
                              : "text-transparent"
                          }`}
                        >
                          {markerGroup.displayName}:
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1 text-gray-200 ${
                          isSelectedMarkerInThisGroup ? "font-bold" : ""
                        }`}
                      >
                        {group.name}
                        {group.isRejected && " (R)"}
                        {trackCount > 1 && ` (${trackCount})`}
                        {/* Settings icon - opens combined dialog for marker group, corresponding tag, and slot definitions */}
                        {onReassignClick && (
                          <button
                            className="opacity-0 group-hover/swimlane:opacity-100 transition-opacity text-blue-400 hover:text-blue-300 text-xs"
                            onClick={(e) => handleReassignClick(e, group)}
                            title="Reassign marker group, set corresponding tag, and edit slot definitions"
                          >
                            ⚙️
                          </button>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs">
                      {counts.confirmed > 0 && (
                        <span className="text-green-400">✓{counts.confirmed}</span>
                      )}
                      {counts.rejected > 0 && (
                        <span className="text-red-400">✗{counts.rejected}</span>
                      )}
                      {counts.pending > 0 && (
                        <span className="text-yellow-400">?{counts.pending}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  // For additional tracks, hide the label to draw attention to the special state
                  <div></div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// Memoize component to prevent re-renders during video playback
// Only re-render when marker data actually changes
export const TimelineLabels = React.memo(
  TimelineLabelsComponent,
  (prevProps, nextProps) => {
    // Re-render if tagGroups changed (markers added/removed/reassigned)
    if (prevProps.tagGroups !== nextProps.tagGroups) return false;

    // Re-render if track layout changed
    if (prevProps.trackCountsByGroup !== nextProps.trackCountsByGroup) return false;

    // Re-render if label width changed
    if (prevProps.labelWidth !== nextProps.labelWidth) return false;

    // Re-render if marker grouping config changed
    if (prevProps.markerGroupParentId !== nextProps.markerGroupParentId) return false;

    // Re-render if reassign callback changed
    if (prevProps.onReassignClick !== nextProps.onReassignClick) return false;

    // Only re-render if selected marker moved to a different swimlane
    // Find which swimlane contains the previous selected marker
    const prevSwimlane = prevProps.selectedMarkerId
      ? prevProps.tagGroups.find((g) =>
          g.markers.some((m) => m.id === prevProps.selectedMarkerId)
        )?.name
      : null;

    // Find which swimlane contains the next selected marker
    const nextSwimlane = nextProps.selectedMarkerId
      ? nextProps.tagGroups.find((g) =>
          g.markers.some((m) => m.id === nextProps.selectedMarkerId)
        )?.name
      : null;

    // Re-render if swimlane changed (selection moved to different tag)
    if (prevSwimlane !== nextSwimlane) return false;

    // Props are equal, skip re-render
    return true;
  }
);

export default TimelineLabels;
