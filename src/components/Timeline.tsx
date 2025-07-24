"use client";

import React, { useMemo } from "react";
import { type SceneMarker } from "../services/StashappService";

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
  scene?: any;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
};

// Group markers by tag name
function groupMarkersByTag(markers: SceneMarker[]) {
  console.log("=== MARKER GROUPING ===");
  console.log("Input markers count:", markers.length);
  
  const groups = new Map<string, SceneMarker[]>();
  
  markers.forEach(marker => {
    const tagName = marker.primary_tag.name;
    console.log(`Processing marker ${marker.id}: tag="${tagName}"`);
    
    if (!groups.has(tagName)) {
      groups.set(tagName, []);
    }
    groups.get(tagName)!.push(marker);
  });
  
  const result = Array.from(groups.entries()).map(([tagName, markers]) => ({
    tagName,
    markers: markers.sort((a, b) => a.seconds - b.seconds)
  }));
  
  console.log("Created groups:", result.map(g => `${g.tagName} (${g.markers.length})`));
  console.log("=== END MARKER GROUPING ===");
  
  return result;
}

export default function Timeline({
  markers,
  actionMarkers,
  selectedMarker,
  videoDuration,
  currentTime,
  onMarkerClick,
  selectedMarkerId,
  isCreatingMarker = false,
  newMarkerStartTime = null,
  newMarkerEndTime = null,
  isEditingMarker = false,
  showShotBoundaries = true,
  filteredSwimlane = null,
  onSwimlaneFilter,
  scene = null,
  zoom = 1,
}: TimelineProps) {
  
  // Group markers by tag name
  const markerGroups = useMemo(() => {
    return groupMarkersByTag(actionMarkers);
  }, [actionMarkers]);
  
  // Calculate timeline dimensions
  const timelineWidth = useMemo(() => {
    const basePixelsPerMinute = 300;
    const pixelsPerSecond = (basePixelsPerMinute / 60) * zoom;
    const width = videoDuration * pixelsPerSecond;
    
    console.log("=== TIMELINE DIMENSIONS ===");
    console.log("Video duration:", videoDuration, "seconds");
    console.log("Zoom level:", zoom);
    console.log("Pixels per second:", pixelsPerSecond);
    console.log("Total timeline width:", width, "pixels");
    console.log("=== END TIMELINE DIMENSIONS ===");
    
    return { width, pixelsPerSecond };
  }, [videoDuration, zoom]);
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };
  
  // Don't render if video duration is not available yet
  if (videoDuration <= 0) {
    return (
      <div className="flex items-center justify-center h-24 bg-gray-800 rounded-lg">
        <span className="text-gray-400">Loading video...</span>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Debug info */}
      <div className="p-2 bg-gray-900 text-xs text-gray-400 border-b border-gray-700">
        Groups: {markerGroups.length} | Video: {formatTime(videoDuration)} | Zoom: {zoom}x | Width: {Math.round(timelineWidth.width)}px
      </div>
      
      {/* Main timeline layout */}
      <div className="flex">
        {/* Left sidebar with tag labels */}
        <div className="flex-shrink-0 w-48 bg-gray-900 border-r border-gray-600">
          {/* Header spacer */}
          <div className="h-8 bg-gray-700 border-b border-gray-600 flex items-center px-3">
            <span className="text-xs text-gray-400">Tags</span>
          </div>
          
          {/* Tag labels */}
          <div className="space-y-0">
            {markerGroups.map((group, index) => (
              <div
                key={group.tagName}
                className={`
                  h-8 flex items-center px-3 text-sm cursor-pointer transition-colors
                  ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}
                  ${filteredSwimlane === group.tagName ? 'bg-blue-600' : ''}
                  hover:bg-gray-700
                `}
                onClick={() => {
                  if (onSwimlaneFilter) {
                    const newFilter = filteredSwimlane === group.tagName ? null : group.tagName;
                    onSwimlaneFilter(newFilter);
                  }
                }}
              >
                <span className="text-gray-200 truncate">
                  {group.tagName} ({group.markers.length})
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Right side with timeline */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ width: `${timelineWidth.width}px` }}>
            {/* Time header */}
            <div className="h-8 bg-gray-700 border-b border-gray-600 relative">
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
              {markerGroups.map((group, swimlaneIndex) => (
                <div
                  key={group.tagName}
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
                    
                    console.log(`=== MARKER ${marker.id} ===`);
                    console.log("Tag:", marker.primary_tag.name);
                    console.log("Start time:", marker.seconds, "seconds");
                    console.log("Duration:", markerDuration, "seconds");
                    console.log("Start position:", markerStart, "pixels");
                    console.log("Width:", markerWidth, "pixels");
                    console.log("=== END MARKER ===");
                    
                    return (
                      <div
                        key={marker.id}
                        className={`
                          absolute top-1 h-6 rounded cursor-pointer transition-all
                          ${isSelected 
                            ? 'bg-yellow-400 ring-2 ring-white z-20' 
                            : 'bg-blue-500 hover:bg-blue-400 z-10'
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
                        title={`${marker.primary_tag.name} - ${formatTime(marker.seconds)}`}
                      >
                        {/* Marker content indicator */}
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-1 h-1 bg-white rounded-full opacity-80" />
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
    </div>
  );
}