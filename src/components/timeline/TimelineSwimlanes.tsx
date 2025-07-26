"use client";

import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { type SceneMarker, stashappService } from "../../services/StashappService";
import { TagGroup } from "../../core/marker/types";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { selectMarkerGroupParentId, selectMarkerStatusConfirmed, selectMarkerStatusRejected } from "../../store/slices/configSlice";
import { loadAvailableTags, loadMarkers, selectSceneId } from "../../store/slices/markerSlice";
import { selectAllTags, loadAllTags } from "../../store/slices/searchSlice";
import {
  isMarkerConfirmed,
  isMarkerRejected,
} from "../../core/marker/markerLogic";
import { getMarkerGroupName, getTrackCountsByGroup, createMarkersWithTracks } from "../../core/marker/markerGrouping";
import { MarkerGroupAutocomplete } from "../marker/MarkerGroupAutocomplete";

type TimelineSwimlanesProps = {
  markerGroups: TagGroup[];
  videoDuration: number;
  currentTime: number;
  selectedMarkerId: string | null;
  timelineWidth: { width: number; pixelsPerSecond: number };
  onMarkerClick: (marker: SceneMarker) => void;
  labelWidth: number;
};

const TimelineSwimlanes: React.FC<TimelineSwimlanesProps> = ({
  markerGroups,
  videoDuration,
  currentTime,
  selectedMarkerId,
  timelineWidth,
  onMarkerClick,
  labelWidth,
}) => {
  const dispatch = useAppDispatch();
  const markerGroupParentId = useAppSelector(selectMarkerGroupParentId);
  const markerStatusConfirmed = useAppSelector(selectMarkerStatusConfirmed);
  const markerStatusRejected = useAppSelector(selectMarkerStatusRejected);
  const allTags = useAppSelector(selectAllTags);
  const sceneId = useAppSelector(selectSceneId);
  const [markerTooltip, setMarkerTooltip] = useState<{
    marker: SceneMarker;
    x: number;
    y: number;
  } | null>(null);
  const [reassignmentUI, setReassignmentUI] = useState<{
    tagName: string;
    currentTagId: string;
    x: number;
    y: number;
  } | null>(null);

  // Ref to track swimlane elements for scrolling
  const swimlaneRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Ensure tags are loaded for the autocomplete
  useEffect(() => {
    if (allTags.length === 0) {
      dispatch(loadAllTags());
    }
  }, [allTags.length, dispatch]);

  // Find which swimlane contains the selected marker
  const selectedMarkerSwimlane = useMemo(() => {
    if (!selectedMarkerId) return null;
    
    for (const group of markerGroups) {
      if (group.markers.some(marker => marker.id === selectedMarkerId)) {
        return group.name;
      }
    }
    return null;
  }, [selectedMarkerId, markerGroups]);

  // Auto-scroll to the swimlane containing the selected marker
  useEffect(() => {
    if (selectedMarkerSwimlane) {
      const swimlaneElement = swimlaneRefs.current.get(selectedMarkerSwimlane);
      if (swimlaneElement) {
        swimlaneElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [selectedMarkerSwimlane]);

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

  // Handle tag reassignment to different marker group
  const handleReassignMarkerGroup = useCallback(async (tagId: string, newMarkerGroupId: string) => {
    try {
      // Get the current tag to understand its current parents
      const currentTag = allTags.find(tag => tag.id === tagId);
      if (!currentTag) {
        console.error('Tag not found:', tagId);
        return;
      }

      // Filter out any existing marker group parents and add the new one
      const newParentIds = [
        // Keep all non-marker-group parents
        ...(currentTag.parents || [])
          .filter(parent => !parent.parents?.some(grandparent => grandparent.id === markerGroupParentId))
          .map(parent => parent.id),
        // Add the new marker group
        newMarkerGroupId
      ];

      await stashappService.updateTagParents(tagId, newParentIds);
      
      // Refresh tags to reflect the change
      dispatch(loadAvailableTags());
      dispatch(loadAllTags());
      
      // Refresh markers to sync embedded tag data
      if (sceneId) {
        dispatch(loadMarkers(sceneId));
      }
      
      // Close the reassignment UI
      setReassignmentUI(null);
    } catch (error) {
      console.error('Failed to reassign marker group:', error);
    }
  }, [allTags, markerGroupParentId, dispatch, sceneId]);

  // Handle clicking the reassignment icon
  const handleReassignmentIconClick = useCallback((e: React.MouseEvent, tagName: string, groupMarkers: SceneMarker[]) => {
    e.stopPropagation();
    
    // Find the primary tag from the first marker in the group
    const primaryTag = groupMarkers[0]?.primary_tag;
    if (!primaryTag) return;


    setReassignmentUI({
      tagName: tagName,
      currentTagId: primaryTag.id,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  if (videoDuration <= 0) {
    return null;
  }

  // Calculate track counts for each group to determine swimlane heights
  const trackCountsByGroup = getTrackCountsByGroup(markerGroups);
  
  // Create markers with track assignments for proper positioning
  const markersWithTracks = createMarkersWithTracks(markerGroups);
  
  // Define track height constants
  const TRACK_HEIGHT = 24; // Height per track in pixels
  const TRACK_SPACING = 2; // Spacing between tracks
  const SWIMLANE_PADDING = 4; // Padding at top and bottom of swimlane

  // Track which marker groups we've already shown to determine when to make text transparent
  const shownMarkerGroups = new Set<string>();

  return (
    <div>
      {markerGroups.map((group, index) => {
        const markerGroup = getMarkerGroupName(group.markers[0], markerGroupParentId);
        const trackCount = trackCountsByGroup[group.name] || 1;
        const swimlaneHeight = (trackCount * TRACK_HEIGHT) + ((trackCount - 1) * TRACK_SPACING) + SWIMLANE_PADDING;
        
        // Determine if this is the first swimlane for this marker group
        const markerGroupKey = markerGroup?.fullName || '';
        const isFirstInMarkerGroup = !shownMarkerGroups.has(markerGroupKey);
        if (markerGroupKey) {
          shownMarkerGroups.add(markerGroupKey);
        }
        
        // Get markers with track assignments for this group
        const groupMarkersWithTracks = markersWithTracks.filter(m => m.tagGroup === group.name);
        
        // Check if this swimlane contains the selected marker
        const isSelectedMarkerInThisGroup = selectedMarkerSwimlane === group.name;
        
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
            className="flex"
            ref={(el) => {
              if (el) {
                swimlaneRefs.current.set(group.name, el);
              } else {
                swimlaneRefs.current.delete(group.name);
              }
            }}
          >
            {/* Left: Tag label - render multiple rows for multi-track swimlanes */}
            <div 
              className="flex-shrink-0 bg-gray-900 border-r border-gray-600 flex flex-col"
              style={{ width: `${labelWidth}px` }}
            >
              {Array.from({ length: trackCount }).map((_, trackIndex) => (
                <div
                  key={trackIndex}
                  className={`
                    flex items-center px-3 text-sm transition-colors
                    ${group.isRejected ? 'bg-red-900/40' : 
                      isSelectedMarkerInThisGroup ? 'bg-gray-700' : 
                      index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}
                    ${trackIndex === trackCount - 1 ? 'border-b border-gray-600' : ''}
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
                          <span className={`text-xs ${isFirstInMarkerGroup ? 'text-blue-300' : 'text-transparent'}`}>
                            {markerGroup.displayName}:
                          </span>
                        )}
                        <span className={`flex items-center gap-1 text-gray-200 ${isSelectedMarkerInThisGroup ? 'font-bold' : ''}`}>
                          {group.name}
                          {group.isRejected && " (R)"}
                          {trackCount > 1 && ` (${trackCount})`}
                          {/* Reassignment icon - only show on hover */}
                          <button
                            className="opacity-0 group-hover/swimlane:opacity-100 transition-opacity text-blue-400 hover:text-blue-300 text-xs"
                            onClick={(e) => handleReassignmentIconClick(e, group.name, group.markers)}
                            title="Reassign to different marker group"
                          >
                            ⚙️
                          </button>
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
            
            {/* Right: Timeline swimlane */}
            <div className="flex-1">
              <div style={{ width: `${timelineWidth.width}px` }}>
                <div
                  className={`
                    border-b border-gray-600 relative
                    ${isSelectedMarkerInThisGroup ? 'bg-gray-700' : index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}
                  `}
                  style={{ height: `${swimlaneHeight}px` }}
                >
                  {/* Current time indicator for this swimlane */}
                  <div
                    className="absolute top-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                    style={{ 
                      left: `${currentTime * timelineWidth.pixelsPerSecond}px`,
                      height: `${swimlaneHeight}px`
                    }}
                  />
                  
                  {/* Markers in this swimlane */}
                  {groupMarkersWithTracks.map((marker) => {
                    const markerStart = marker.seconds * timelineWidth.pixelsPerSecond;
                    const markerDuration = (marker.end_seconds || marker.seconds + 1) - marker.seconds;
                    const markerWidth = markerDuration * timelineWidth.pixelsPerSecond;
                    const isSelected = marker.id === selectedMarkerId;
                    
                    // Calculate track container position
                    const trackTop = SWIMLANE_PADDING / 2 + (marker.track * (TRACK_HEIGHT + TRACK_SPACING));
                    const markerHeight = TRACK_HEIGHT - 6;
                    
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
                          absolute flex items-center justify-center
                        `}
                        style={{
                          left: `${markerStart}px`,
                          top: `${trackTop}px`,
                          width: `${Math.max(markerWidth, 4)}px`,
                          height: `${TRACK_HEIGHT}px`,
                        }}
                      >
                        <div
                          className={`
                            rounded cursor-pointer transition-all w-full
                            ${isSelected 
                              ? `${markerColorClass} ring-2 ring-white z-20 brightness-110` 
                              : `${markerColorClass} hover:brightness-110 z-10 opacity-80`
                            }
                          `}
                          style={{
                            height: `${markerHeight}px`,
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
                          } - Track ${marker.track + 1}`}
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

      {/* Marker Group Reassignment UI */}
      {reassignmentUI && (
        <div
          className="fixed z-[9001] bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-gray-600 w-64"
          style={{
            left: `${Math.max(16, Math.min(reassignmentUI.x, window.innerWidth - 256 - 16))}px`,
            top: `${Math.max(16, reassignmentUI.y - 120)}px`,
          }}
        >
          <div className="space-y-2">
            <div className="font-bold text-sm">
              Reassign &ldquo;{reassignmentUI.tagName}&rdquo;
            </div>
            <div className="text-xs text-gray-400">
              Select new marker group:
            </div>
            <MarkerGroupAutocomplete
              value=""
              onChange={(newMarkerGroupId) => {
                handleReassignMarkerGroup(reassignmentUI.currentTagId, newMarkerGroupId);
              }}
              availableTags={allTags}
              placeholder="Search marker groups..."
              autoFocus={true}
              onCancel={() => setReassignmentUI(null)}
            />
          </div>

          {/* Click outside to close */}
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setReassignmentUI(null)}
          />
        </div>
      )}
    </div>
  );
};

export default TimelineSwimlanes;