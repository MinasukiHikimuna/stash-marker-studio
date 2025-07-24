"use client";

import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { type SceneMarker } from "../services/StashappService";
import { TagGroup, MarkerWithTrack } from "../core/marker/types";
import {
  isMarkerConfirmed,
  isMarkerRejected,
} from "../core/marker/markerLogic";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { selectMarkerGroupParentId } from "../store/slices/configSlice";
import { seekToTime } from "../store/slices/markerSlice";
import {
  groupMarkersByTags,
  getMarkerGroupName,
  createMarkersWithTracks,
} from "../core/marker/markerGrouping";

type TimelineProps = {
  markers: SceneMarker[];
  actionMarkers: SceneMarker[];
  selectedMarker: SceneMarker | null;
  videoDuration: number;
  currentTime: number;
  onMarkerClick: (marker: SceneMarker) => void;
  selectedMarkerId: string | null;
  isCreatingMarker?: boolean;
  newMarkerStartTime?: number | null;
  newMarkerEndTime?: number | null;
  isEditingMarker?: boolean;
  showShotBoundaries?: boolean;
  filteredSwimlane?: string | null;
  onSwimlaneFilter?: (swimlaneName: string | null) => void;
  scene?: unknown;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onSwimlaneDataUpdate?: (tagGroups: TagGroup[], markersWithTracks: MarkerWithTrack[]) => void;
};

// TODO: Remove unused parameters once refactoring is complete
export default function Timeline({
  markers: _markers,
  actionMarkers,
  selectedMarker: _selectedMarker,
  videoDuration,
  currentTime,
  onMarkerClick,
  selectedMarkerId,
  isCreatingMarker: _isCreatingMarker = false,
  newMarkerStartTime: _newMarkerStartTime = null,
  newMarkerEndTime: _newMarkerEndTime = null,
  isEditingMarker: _isEditingMarker = false,
  showShotBoundaries: _showShotBoundaries = true,
  filteredSwimlane = null,
  onSwimlaneFilter,
  scene: _scene = null,
  zoom = 1,
  onZoomChange: _onZoomChange,
  onSwimlaneDataUpdate,
}: TimelineProps) {
  const dispatch = useAppDispatch();
  const markerGroupParentId = useAppSelector(selectMarkerGroupParentId);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Group markers by tag name with proper marker group ordering using shared algorithm
  const markerGroups = useMemo(() => {
    return groupMarkersByTags(actionMarkers, markerGroupParentId);
  }, [actionMarkers, markerGroupParentId]);
  
  // Create markers with track data for keyboard navigation
  const markersWithTracks = useMemo(() => {
    return createMarkersWithTracks(markerGroups);
  }, [markerGroups]);
  
  // Update parent component with swimlane data for keyboard navigation
  useEffect(() => {
    if (onSwimlaneDataUpdate) {
      onSwimlaneDataUpdate(markerGroups, markersWithTracks);
    }
  }, [markerGroups, markersWithTracks, onSwimlaneDataUpdate]);
  
  // Calculate timeline dimensions
  const timelineWidth = useMemo(() => {
    const basePixelsPerMinute = 300;
    const pixelsPerSecond = (basePixelsPerMinute / 60) * zoom;
    const width = videoDuration * pixelsPerSecond;
    
    return { width, pixelsPerSecond };
  }, [videoDuration, zoom]);
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };
  
  // Handle click-to-seek on timeline header
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const mouseXInDiv = e.clientX - rect.left;
      const time = (mouseXInDiv + timelineRef.current.scrollLeft) / timelineWidth.pixelsPerSecond;

      // Clamp time to video duration bounds
      const seekTime = Math.max(0, Math.min(time, videoDuration));
      dispatch(seekToTime(seekTime));
    },
    [timelineWidth.pixelsPerSecond, videoDuration, dispatch]
  );
  
  // Don't render if video duration is not available yet
  if (videoDuration <= 0) {
    return (
      <div className="flex items-center justify-center h-24 bg-gray-800 rounded-lg">
        <span className="text-gray-400">Loading video...</span>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden flex">
        {/* Left sidebar with tag labels */}
        <div className="flex-shrink-0 w-48 bg-gray-900 border-r border-gray-600">
          {/* Header spacer */}
          <div className="h-8 bg-gray-700 border-b border-gray-600 flex items-center px-3">
            <span className="text-xs text-gray-400">Tags</span>
          </div>
          
          {/* Tag labels */}
          <div className="space-y-0">
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
                <div
                  key={group.name}
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
              );
            })}
          </div>
        </div>
        
        {/* Right side with timeline */}
        <div 
          ref={timelineRef}
          className="flex-1 overflow-x-auto"
        >
          <div style={{ width: `${timelineWidth.width}px` }}>
            {/* Time header */}
            <div 
              className="h-8 bg-gray-700 border-b border-gray-600 relative cursor-pointer"
              onClick={handleTimelineClick}
              title="Click to seek to time"
            >
              {/* Minute markers */}
              {Array.from({ length: Math.floor(videoDuration / 60) + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-gray-600 flex items-center"
                  style={{ left: `${i * 60 * timelineWidth.pixelsPerSecond}px` }}
                >
                  <span className="text-xs text-gray-400 ml-1">
                    {formatTime(i * 60)}
                  </span>
                </div>
              ))}
              
              {/* Current time indicator */}
              <div
                className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
                style={{ left: `${currentTime * timelineWidth.pixelsPerSecond}px` }}
              />
            </div>
            
            {/* Swimlanes */}
            <div className="relative">
              {/* Current time indicator spanning all swimlanes */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                style={{ left: `${currentTime * timelineWidth.pixelsPerSecond}px` }}
              />
              
              {markerGroups.map((group, swimlaneIndex) => (
                <div
                  key={group.name}
                  className={`
                    h-8 border-b border-gray-600 relative
                    ${swimlaneIndex % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}
                  `}
                >
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
              ))}
            </div>
          </div>
        </div>
    </div>
  );
}