"use client";

import React, { useMemo } from "react";
import { type SceneMarker } from "../services/StashappService";
import { TagGroup } from "../core/marker/types";
import {
  getMarkerStatus,
  isMarkerConfirmed,
  isMarkerRejected,
} from "../core/marker/markerLogic";
import { MarkerStatus } from "../core/marker/types";
import { useAppSelector } from "../store/hooks";
import { selectMarkerGroupParentId } from "../store/slices/configSlice";

// Type for marker group info
type MarkerGroupInfo = {
  fullName: string;
  displayName: string;
} | null;

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

// Helper function to extract marker group name from tag parents
function getMarkerGroupName(marker: SceneMarker, markerGroupParentId: string): MarkerGroupInfo {
  const parents = marker.primary_tag.parents;
  if (!parents || parents.length === 0) {
    return null;
  }

  // Look for a parent that starts with "Marker Group: " and has the correct grandparent
  for (const parent of parents) {
    if (
      parent.name.startsWith("Marker Group: ") &&
      parent.parents?.some(
        (grandparent) =>
          grandparent.id === markerGroupParentId
      )
    ) {
      // Return an object containing both the full name and display name
      return {
        fullName: parent.name,
        displayName: parent.name
          .replace("Marker Group: ", "")
          .replace(/^\d+\.\s*/, ""),
      };
    }
  }

  return null;
}

// Group markers by tags with proper marker group ordering
function groupMarkersByTags(markers: SceneMarker[], markerGroupParentId: string): TagGroup[] {
  console.log("=== MARKER GROUPING ===");
  console.log("Input markers count:", markers.length);

  // Group all markers by tag name (with AI tag correspondence)
  const tagGroupMap = new Map<string, SceneMarker[]>();

  for (const marker of markers) {
    const groupName = marker.primary_tag.name.endsWith("_AI")
      ? marker.primary_tag.name.replace("_AI", "") // Simple AI tag grouping
      : marker.primary_tag.name;

    console.log(`Processing marker ${marker.id}: tag="${marker.primary_tag.name}" -> group="${groupName}"`);

    if (!tagGroupMap.has(groupName)) {
      tagGroupMap.set(groupName, []);
    }
    tagGroupMap.get(groupName)!.push(marker);
  }

  // Convert to array of tag groups
  const tagGroups: TagGroup[] = Array.from(tagGroupMap.entries())
    .map(([name, markers]) => {
      // A group is considered rejected only if ALL markers in it are rejected
      const isRejected = markers.every(
        (marker) => getMarkerStatus(marker) === MarkerStatus.REJECTED
      );

      // Get unique tags from markers
      const uniqueTags = Array.from(
        new Set(markers.map((m) => m.primary_tag.id))
      )
        .map((tagId) => {
          const marker = markers.find((m) => m.primary_tag.id === tagId);
          if (!marker) return null;
          return {
            id: marker.primary_tag.id,
            name: marker.primary_tag.name,
            description: marker.primary_tag.description,
            parents: marker.primary_tag.parents,
          };
        })
        .filter((tag): tag is NonNullable<typeof tag> => tag !== null);

      return {
        name,
        markers: markers.sort((a, b) => a.seconds - b.seconds),
        tags: uniqueTags,
        isRejected,
      };
    })
    .sort((a, b) => {
      // Get marker group names for sorting
      const aMarkerGroup = getMarkerGroupName(a.markers[0], markerGroupParentId);
      const bMarkerGroup = getMarkerGroupName(b.markers[0], markerGroupParentId);

      console.log(`Sorting: ${a.name} (group: ${aMarkerGroup?.fullName}) vs ${b.name} (group: ${bMarkerGroup?.fullName})`);

      // If both have marker groups, sort by the full name to preserve numbering
      if (aMarkerGroup && bMarkerGroup) {
        if (aMarkerGroup.fullName !== bMarkerGroup.fullName) {
          return aMarkerGroup.fullName.localeCompare(bMarkerGroup.fullName);
        }
        return a.name.localeCompare(b.name);
      }

      // If only one has a marker group, put the one with marker group first
      if (aMarkerGroup && !bMarkerGroup) {
        return -1;
      }
      if (!aMarkerGroup && bMarkerGroup) {
        return 1;
      }

      // If neither has a marker group, sort alphabetically by tag name
      return a.name.localeCompare(b.name);
    });

  console.log("Created groups:", tagGroups.map(g => `${g.name} (${g.markers.length}) - group: ${getMarkerGroupName(g.markers[0], markerGroupParentId)?.fullName || 'none'}`));
  console.log("=== END MARKER GROUPING ===");

  return tagGroups;
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
  const markerGroupParentId = useAppSelector(selectMarkerGroupParentId);
  
  // Group markers by tag name with proper marker group ordering
  const markerGroups = useMemo(() => {
    return groupMarkersByTags(actionMarkers, markerGroupParentId);
  }, [actionMarkers, markerGroupParentId]);
  
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
                    
                    // Determine marker color based on status
                    let markerColorClass = 'bg-yellow-500'; // Default: pending
                    if (isMarkerConfirmed(marker)) {
                      markerColorClass = 'bg-green-500';
                    } else if (isMarkerRejected(marker)) {
                      markerColorClass = 'bg-red-500';
                    }
                    
                    console.log(`=== MARKER ${marker.id} ===`);
                    console.log("Tag:", marker.primary_tag.name);
                    console.log("Start time:", marker.seconds, "seconds");
                    console.log("Duration:", markerDuration, "seconds");
                    console.log("Start position:", markerStart, "pixels");
                    console.log("Width:", markerWidth, "pixels");
                    console.log("Status:", isMarkerConfirmed(marker) ? 'confirmed' : isMarkerRejected(marker) ? 'rejected' : 'pending');
                    console.log("=== END MARKER ===");
                    
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
    </div>
  );
}