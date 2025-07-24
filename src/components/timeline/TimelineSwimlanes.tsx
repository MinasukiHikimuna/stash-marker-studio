"use client";

import React, { useCallback, useState } from "react";
import { type SceneMarker } from "../../services/StashappService";
import { TagGroup } from "../../core/marker/types";
import { useAppSelector } from "../../store/hooks";
import { selectMarkerGroupParentId, selectMarkerStatusConfirmed, selectMarkerStatusRejected } from "../../store/slices/configSlice";
import {
  isMarkerConfirmed,
  isMarkerRejected,
} from "../../core/marker/markerLogic";
import { getMarkerGroupName } from "../../core/marker/markerGrouping";

type TimelineSwimlanesProps = {
  markerGroups: TagGroup[];
  videoDuration: number;
  currentTime: number;
  selectedMarkerId: string | null;
  filteredSwimlane: string | null;
  timelineWidth: { width: number; pixelsPerSecond: number };
  onMarkerClick: (marker: SceneMarker) => void;
  onSwimlaneFilter?: (swimlaneName: string | null) => void;
};

const TimelineSwimlanes: React.FC<TimelineSwimlanesProps> = ({
  markerGroups,
  videoDuration,
  currentTime,
  selectedMarkerId,
  filteredSwimlane,
  timelineWidth,
  onMarkerClick,
  onSwimlaneFilter,
}) => {
  const markerGroupParentId = useAppSelector(selectMarkerGroupParentId);
  const markerStatusConfirmed = useAppSelector(selectMarkerStatusConfirmed);
  const markerStatusRejected = useAppSelector(selectMarkerStatusRejected);
  const [markerTooltip, setMarkerTooltip] = useState<{
    marker: SceneMarker;
    x: number;
    y: number;
  } | null>(null);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

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

  if (videoDuration <= 0) {
    return null;
  }

  return (
    <div className="flex-1">
      {markerGroups.map((group, index) => {
        const markerGroup = getMarkerGroupName(group.markers[0], markerGroupParentId);
        
        // Calculate status counts
        const counts = {
          confirmed: group.markers.filter(isMarkerConfirmed).length,
          rejected: group.markers.filter(isMarkerRejected).length,
          pending: group.markers.filter(
            (marker) => !isMarkerConfirmed(marker) && !isMarkerRejected(marker)
          ).length,
        };
        
        return (
          <div key={group.name} className="flex">
            {/* Left: Tag label */}
            <div className="flex-shrink-0 w-48 bg-gray-900 border-r border-gray-600">
              <div
                className={`
                  h-8 flex items-center px-3 text-sm cursor-pointer transition-colors
                  ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}
                  ${filteredSwimlane === group.name ? 'bg-blue-600' : ''}
                  ${group.isRejected ? 'bg-red-900/40' : ''}
                  hover:bg-gray-700
                `}
                onClick={() => {
                  if (onSwimlaneFilter) {
                    const newFilter = filteredSwimlane === group.name ? null : group.name;
                    onSwimlaneFilter(newFilter);
                  }
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 truncate">
                    {markerGroup && (
                      <span className="text-blue-300 text-xs">
                        {markerGroup.displayName}:
                      </span>
                    )}
                    <span className="text-gray-200">
                      {group.name}
                      {group.isRejected && " (R)"}
                      {filteredSwimlane === group.name && " 🔍"}
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
              </div>
            </div>
            
            {/* Right: Timeline swimlane */}
            <div className="flex-1 overflow-x-auto">
              <div style={{ width: `${timelineWidth.width}px` }}>
                <div
                  className={`
                    h-8 border-b border-gray-600 relative
                    ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}
                  `}
                >
                  {/* Current time indicator for this swimlane */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-red-500 z-30 pointer-events-none"
                    style={{ left: `${currentTime * timelineWidth.pixelsPerSecond}px` }}
                  />
                  
                  {/* Markers in this swimlane */}
                  {group.markers.map((marker) => {
                    const markerStart = marker.seconds * timelineWidth.pixelsPerSecond;
                    const markerDuration = (marker.end_seconds || marker.seconds + 1) - marker.seconds;
                    const markerWidth = markerDuration * timelineWidth.pixelsPerSecond;
                    const isSelected = marker.id === selectedMarkerId;
                    
                    // Determine marker color based on status
                    let markerColorClass = 'bg-yellow-500'; // Default: pending
                    if (isMarkerConfirmed(marker)) {
                      markerColorClass = 'bg-green-500';
                    } else if (isMarkerRejected(marker)) {
                      markerColorClass = 'bg-red-500';
                    }
                    
                    return (
                      <div
                        key={marker.id}
                        className={`
                          absolute top-1 h-6 rounded cursor-pointer transition-all
                          ${isSelected 
                            ? `${markerColorClass} ring-2 ring-white z-20 brightness-110` 
                            : `${markerColorClass} hover:brightness-110 z-10 opacity-80`
                          }
                        `}
                        style={{
                          left: `${markerStart}px`,
                          width: `${Math.max(markerWidth, 4)}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkerClick(marker);
                        }}
                        onMouseEnter={(e) => handleMarkerMouseEnter(e, marker)}
                        onMouseLeave={handleMarkerMouseLeave}
                        onMouseMove={(e) => handleMarkerMouseMove(e, marker)}
                        title={`${marker.primary_tag.name} - ${formatTime(marker.seconds)} - ${
                          isMarkerConfirmed(marker) ? 'Confirmed' : isMarkerRejected(marker) ? 'Rejected' : 'Pending'
                        }`}
                      >
                        {/* Marker content indicator */}
                        <div className="w-full h-full flex items-center justify-center">
                          {marker.primary_tag.name.endsWith("_AI") ? (
                            <div className="w-2 h-2 bg-purple-300 rounded-full opacity-80" />
                          ) : (
                            <div className="w-1 h-1 bg-white rounded-full opacity-80" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

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
                  {markerTooltip.marker.tags
                    .filter(
                      (tag) =>
                        tag.id !== markerStatusConfirmed &&
                        tag.id !== markerStatusRejected
                    )
                    .map((tag) => (
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
    </div>
  );
};

export default TimelineSwimlanes;