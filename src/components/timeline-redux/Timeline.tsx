/**
 * Timeline - Main timeline component
 *
 * This component integrates all timeline sub-components (TimelineAxis, TimelineLabels,
 * TimelineGrid) and provides a comprehensive timeline visualization.
 *
 * Key features:
 * - TimelineProps interface
 * - TimelineRef interface for programmatic control
 * - Scroll synchronization between header and swimlanes
 * - Redux integration
 * - Swimlane resize support
 * - Keyboard shortcuts
 * - Playhead rendered in swimlanes only (not in header)
 */

"use client";

import React, {
  useMemo,
  useEffect,
  useState,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { type SceneMarker, type Scene, stashappService } from "../../services/StashappService";
import { TagGroup, MarkerWithTrack } from "../../core/marker/types";
import type { ShotBoundary } from "../../core/shotBoundary/types";
import TimelineAxis from "./TimelineAxis";
import TimelineLabels from "./TimelineLabels";
import TimelineGrid from "./TimelineGrid";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import {
  selectMarkerGroupParentId,
  selectMarkerGroups,
  selectMarkerGroupTagSorting,
  selectCorrespondingTagMappings,
} from "../../store/slices/configSlice";
import { loadAvailableTags, loadMarkers, seekToTime, selectSceneId } from "../../store/slices/markerSlice";
import { selectAllTags, loadAllTags } from "../../store/slices/searchSlice";
import {
  groupMarkersByTags,
  createMarkersWithTracks,
  getMarkerGroupName,
  getTrackCountsByGroup,
} from "../../core/marker/markerGrouping";
import { calculateTimelineWidth } from "../../core/timeline/calculations";
import { isPlatformModifierPressed } from "../../utils/platform";
import { useThrottledResize } from "../../hooks/useThrottledResize";
import { MarkerGroupReassignDialog } from "../marker/MarkerGroupReassignDialog";

export type TimelineProps = {
  markers: SceneMarker[];
  shotBoundaries: ShotBoundary[];
  videoDuration: number;
  currentTime: number;
  onMarkerClick: (marker: SceneMarker) => void;
  selectedMarkerId: string | null;
  showShotBoundaries?: boolean;
  scene?: Scene;
  zoom?: number;
  onSwimlaneDataUpdate?: (
    tagGroups: TagGroup[],
    markersWithTracks: MarkerWithTrack[]
  ) => void;
  onAvailableWidthUpdate?: (availableWidth: number) => void;
};

export interface TimelineRef {
  centerOnPlayhead: () => void;
}

const Timeline = forwardRef<TimelineRef, TimelineProps>(
  (
    {
      markers,
      shotBoundaries,
      videoDuration,
      currentTime,
      onMarkerClick,
      selectedMarkerId,
      showShotBoundaries = true,
      scene: _scene = undefined, // Reserved for future sprite preview support
      zoom = 1,
      onSwimlaneDataUpdate,
      onAvailableWidthUpdate,
    },
    ref
  ) => {
    const dispatch = useAppDispatch();
    const markerGroupParentId = useAppSelector(selectMarkerGroupParentId);
    const markerGroups = useAppSelector(selectMarkerGroups);
    const tagSorting = useAppSelector(selectMarkerGroupTagSorting);
    const correspondingTagMappings = useAppSelector(selectCorrespondingTagMappings);
    const allTags = useAppSelector(selectAllTags);
    const sceneId = useAppSelector(selectSceneId);

    // Swimlane resize state
    const [swimlaneMaxHeight, setSwimlaneMaxHeight] = useState<number | null>(
      null
    );
    const [swimlaneResizeEnabled, setSwimlaneResizeEnabled] = useState(false);
    const swimlaneContainerRef = useRef<HTMLDivElement>(null);

    // Header scroll synchronization
    const headerScrollRef = useRef<HTMLDivElement>(null);

    // Reassignment UI state
    const [reassignmentUI, setReassignmentUI] = useState<{
      tagName: string;
      currentTagId: string;
      correspondingTagRelationships?: Array<{
        tagId: string;
        tagName: string;
        correspondingTagName: string;
      }>;
    } | null>(null);

    // Window dimensions state
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [windowHeight, setWindowHeight] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track container dimensions with throttled resize
    useThrottledResize(() => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
      setWindowHeight(window.innerHeight);
    });

    // Ensure tags are loaded for the autocomplete
    useEffect(() => {
      if (allTags.length === 0) {
        dispatch(loadAllTags());
      }
    }, [allTags.length, dispatch]);

    // Group markers by tag name with proper marker group ordering
    const tagGroups = useMemo(() => {
      return groupMarkersByTags(
        markers,
        markerGroupParentId,
        markerGroups,
        tagSorting,
        correspondingTagMappings,
        allTags
      );
    }, [markers, markerGroupParentId, markerGroups, tagSorting, correspondingTagMappings, allTags]);

    // Create markers with track data for keyboard navigation
    const markersWithTracks = useMemo(() => {
      return createMarkersWithTracks(tagGroups);
    }, [tagGroups]);

    // Calculate track counts for swimlane heights
    const trackCountsByGroup = useMemo(() => {
      return getTrackCountsByGroup(tagGroups);
    }, [tagGroups]);

    // Calculate uniform width for all tag labels
    const uniformTagLabelWidth = useMemo(() => {
      if (tagGroups.length === 0) return 192;

      let maxWidth = 192; // Minimum width

      tagGroups.forEach((group) => {
        const markerGroup = getMarkerGroupName(
          group.markers[0],
          markerGroupParentId
        );
        const trackCount = trackCountsByGroup[group.name] || 1;

        // Estimate text content length
        let textContent = group.name;
        if (markerGroup) {
          textContent = `${markerGroup.displayName}: ${group.name}`;
        }
        if (group.isRejected) {
          textContent += " (R)";
        }
        if (trackCount > 1) {
          textContent += ` (${trackCount})`;
        }

        // Rough character-to-pixel estimation
        const baseCharWidth = 7;
        const padding = 24;
        const statusIndicators = 40;

        const estimatedWidth =
          textContent.length * baseCharWidth + padding + statusIndicators;
        maxWidth = Math.max(maxWidth, estimatedWidth);
      });

      // Cap at reasonable maximum
      const finalWidth = Math.min(470, maxWidth + 10);
      return finalWidth;
    }, [tagGroups, markerGroupParentId, trackCountsByGroup]);

    // Update parent component with swimlane data for keyboard navigation
    useEffect(() => {
      if (onSwimlaneDataUpdate) {
        onSwimlaneDataUpdate(tagGroups, markersWithTracks);
      }
    }, [tagGroups, markersWithTracks, onSwimlaneDataUpdate]);

    // Update parent component with available timeline width
    useEffect(() => {
      if (onAvailableWidthUpdate && containerWidth > 0) {
        // No need to subtract scrollbar margin - flex layout handles this automatically
        const availableWidth = containerWidth - uniformTagLabelWidth;
        onAvailableWidthUpdate(availableWidth);
      }
    }, [containerWidth, uniformTagLabelWidth, onAvailableWidthUpdate]);

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

    // Handle setting corresponding tag
    const handleSetCorrespondingTag = useCallback(async (tagId: string, correspondingTagId: string | null) => {
      try {
        const currentTag = allTags.find(tag => tag.id === tagId);
        if (!currentTag) {
          console.error('Tag not found:', tagId);
          return;
        }

        // If setting a corresponding tag (not removing), show confirmation with count of affected markers
        if (correspondingTagId) {
          const correspondingTag = allTags.find(tag => tag.id === correspondingTagId);
          if (!correspondingTag) {
            console.error('Corresponding tag not found:', correspondingTagId);
            return;
          }

          // Count how many markers across all scenes would be affected
          const countResponse = await fetch(`/api/markers/count-by-tag?tagId=${tagId}`);
          const countData = await countResponse.json();
          const markerCount = countData.count || 0;

          const confirmMessage = markerCount > 0
            ? `This will set "${currentTag.name}" to convert to "${correspondingTag.name}".\n\nThis will also convert ${markerCount} existing marker${markerCount === 1 ? '' : 's'} across all scenes from "${currentTag.name}" to "${correspondingTag.name}".\n\nDo you want to continue?`
            : `This will set "${currentTag.name}" to convert to "${correspondingTag.name}" during future imports.\n\nNo existing markers will be affected.\n\nDo you want to continue?`;

          if (!confirm(confirmMessage)) {
            return;
          }
        } else {
          // Removing corresponding tag mapping
          if (!confirm(`Remove corresponding tag mapping for "${currentTag.name}"?`)) {
            return;
          }
        }

        let newDescription = currentTag.description || '';

        // Remove existing "Corresponding Tag: " entry if it exists
        newDescription = newDescription.replace(/Corresponding Tag: [^\n]*/g, '').trim();

        // Add new corresponding tag if provided
        if (correspondingTagId) {
          const correspondingTag = allTags.find(tag => tag.id === correspondingTagId);
          if (correspondingTag) {
            if (newDescription) {
              newDescription += '\n';
            }
            newDescription += `Corresponding Tag: ${correspondingTag.name}`;
          }
        }

        await stashappService.updateTag(tagId, undefined, newDescription);

        // Create/update or delete corresponding tag mapping in database
        if (correspondingTagId) {
          // Create or update mapping
          const mappingResponse = await fetch('/api/corresponding-tag-mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceTagId: parseInt(tagId),
              correspondingTagId: parseInt(correspondingTagId),
            }),
          });

          if (!mappingResponse.ok && mappingResponse.status !== 409) {
            // 409 means mapping already exists, which is fine
            const error = await mappingResponse.json();
            throw new Error(error.error || 'Failed to create corresponding tag mapping');
          }

          // If mapping already exists (409), update it
          if (mappingResponse.status === 409) {
            const updateResponse = await fetch(`/api/corresponding-tag-mappings/by-source-tag/${tagId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                correspondingTagId: parseInt(correspondingTagId),
              }),
            });

            if (!updateResponse.ok) {
              const error = await updateResponse.json();
              throw new Error(error.error || 'Failed to update corresponding tag mapping');
            }
          }

          // Batch convert all existing markers with this primary tag
          const convertResponse = await fetch('/api/markers/convert-by-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceTagId: parseInt(tagId),
              correspondingTagId: parseInt(correspondingTagId),
            }),
          });

          if (!convertResponse.ok) {
            console.error('Failed to convert existing markers, but mapping was created');
          }
        } else {
          // Delete mapping if it exists
          const deleteResponse = await fetch(`/api/corresponding-tag-mappings/by-source-tag/${tagId}`, {
            method: 'DELETE',
          });

          if (!deleteResponse.ok && deleteResponse.status !== 404) {
            // 404 means no mapping exists, which is fine
            console.error('Failed to delete corresponding tag mapping');
          }
        }

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
        console.error('Failed to set corresponding tag:', error);
        alert('Failed to set corresponding tag: ' + (error as Error).message);
      }
    }, [allTags, dispatch, sceneId]);

    // Handle clicking the reassignment icon (now opens combined dialog)
    const handleReassignmentIconClick = useCallback((displayName: string, tagGroup: TagGroup) => {
      // Extract base tag name from groupKey (before the "|" separator)
      // groupKey format: "Blowjob" or "Blowjob|123,456"
      const baseTagName = tagGroup.groupKey.split('|')[0];

      // Find the tag that matches the base tag name
      // We need to find this tag in allTags, not in tagGroup.tags
      // because tagGroup.tags contains the actual marker tags (e.g., "Blowjob_AI")
      const baseTag = allTags.find(tag => tag.name === baseTagName);
      if (!baseTag) {
        console.error(`Base tag not found for base tag name: ${baseTagName}`);
        return;
      }

      // Find all tags in the system that point to this base tag as their corresponding tag
      // This determines which state we should show
      const tagsPointingToThisAsCorresponding = allTags.filter(tag => {
        if (!tag.description?.includes("Corresponding Tag: ")) return false;
        const correspondingTagName = tag.description.split("Corresponding Tag: ")[1].trim();
        return correspondingTagName === baseTagName;
      });

      // Determine which state to show based on whether other tags point to this as corresponding
      const correspondingTagRelationships = tagsPointingToThisAsCorresponding.length > 0
        ? tagsPointingToThisAsCorresponding.map(tag => ({
            tagId: tag.id,
            tagName: tag.name,
            correspondingTagName: baseTagName
          }))
        : undefined; // undefined means State 1, defined means State 2

      setReassignmentUI({
        tagName: baseTagName,
        currentTagId: baseTag.id,
        correspondingTagRelationships, // undefined for State 1, array for State 2
      });
    }, [allTags]);


    // Handle swimlane resize keyboard shortcuts
    const handleSwimlaneResize = useCallback(
      (direction: "increase" | "decrease") => {
        const swimlaneHeight = 32;

        const container = swimlaneContainerRef.current;
        if (!container) return;

        const actualContentHeight = container.scrollHeight;

        // Calculate maximum allowed height
        const viewportHeight = windowHeight || window.innerHeight;
        const videoPlayerMinHeight = viewportHeight / 3;
        const timelineHeaderHeight = 60;
        const pageHeaderHeight = 80;
        const maxAllowedHeight =
          viewportHeight -
          videoPlayerMinHeight -
          timelineHeaderHeight -
          pageHeaderHeight;

        let newHeight: number;

        if (direction === "increase") {
          const currentHeight = swimlaneMaxHeight || container.clientHeight;
          newHeight = Math.min(
            currentHeight + swimlaneHeight,
            Math.min(actualContentHeight, maxAllowedHeight)
          );
        } else {
          const currentHeight = swimlaneMaxHeight || container.clientHeight;
          const minHeight = swimlaneHeight * 3;
          newHeight = Math.max(currentHeight - swimlaneHeight, minHeight);
        }

        setSwimlaneMaxHeight(newHeight);
        setSwimlaneResizeEnabled(true);
      },
      [swimlaneMaxHeight, windowHeight]
    );

    // Keyboard event listener for swimlane resize
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const isModifier = isPlatformModifierPressed(e);

        if (isModifier && e.key === "ArrowUp") {
          e.preventDefault();
          handleSwimlaneResize("increase");
        } else if (isModifier && e.key === "ArrowDown") {
          e.preventDefault();
          handleSwimlaneResize("decrease");
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSwimlaneResize]);

    // Scroll synchronization between header and swimlanes
    useEffect(() => {
      const headerContainer = headerScrollRef.current;
      const swimlanesContainer = swimlaneContainerRef.current;

      if (!headerContainer || !swimlanesContainer) return;

      let isHeaderScrolling = false;
      let isSwimlaneScrolling = false;

      const handleHeaderScroll = () => {
        if (isSwimlaneScrolling) return;
        isHeaderScrolling = true;
        swimlanesContainer.scrollLeft = headerContainer.scrollLeft;
        setTimeout(() => {
          isHeaderScrolling = false;
        }, 0);
      };

      const handleSwimlaneScroll = () => {
        if (isHeaderScrolling) return;
        isSwimlaneScrolling = true;
        headerContainer.scrollLeft = swimlanesContainer.scrollLeft;
        setTimeout(() => {
          isSwimlaneScrolling = false;
        }, 0);
      };

      headerContainer.addEventListener("scroll", handleHeaderScroll);
      swimlanesContainer.addEventListener("scroll", handleSwimlaneScroll);

      return () => {
        headerContainer.removeEventListener("scroll", handleHeaderScroll);
        swimlanesContainer.removeEventListener("scroll", handleSwimlaneScroll);
      };
    }, []);

    // Calculate timeline width and pixels per second
    const timelineWidth = useMemo(() => {
      return calculateTimelineWidth(
        videoDuration,
        zoom,
        containerWidth,
        uniformTagLabelWidth
      );
    }, [videoDuration, zoom, containerWidth, uniformTagLabelWidth]);

    // Apply passive height constraint
    const calculatedMaxHeight = useMemo(() => {
      if (!swimlaneResizeEnabled && windowHeight > 0) {
        const videoPlayerMinHeight = windowHeight / 3;
        const timelineHeaderHeight = 60;
        const pageHeaderHeight = 80;
        const maxAllowedHeight =
          windowHeight -
          videoPlayerMinHeight -
          timelineHeaderHeight -
          pageHeaderHeight;
        return maxAllowedHeight;
      }
      return null;
    }, [swimlaneResizeEnabled, windowHeight]);

    // Center timeline on playhead function
    const centerOnPlayhead = useCallback(() => {
      if (!swimlaneContainerRef.current || videoDuration <= 0) return;

      const container = swimlaneContainerRef.current;
      const containerWidth = container.clientWidth;

      const playheadPixelPosition = currentTime * timelineWidth.pixelsPerSecond;
      const labelWidth = uniformTagLabelWidth;
      const playheadAbsolutePosition = labelWidth + playheadPixelPosition;

      const targetScrollLeft = playheadAbsolutePosition - containerWidth / 2;
      const scrollLeft = Math.max(0, targetScrollLeft);

      // Scroll both containers in sync
      container.scrollTo({
        left: scrollLeft,
        behavior: "smooth",
      });

      if (headerScrollRef.current) {
        headerScrollRef.current.scrollTo({
          left: scrollLeft,
          behavior: "smooth",
        });
      }
    }, [currentTime, timelineWidth, uniformTagLabelWidth, videoDuration]);

    // Expose center playhead function to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        centerOnPlayhead,
      }),
      [centerOnPlayhead]
    );

    // Scroll selected marker into view when selection changes or zoom changes
    useEffect(() => {
      if (!selectedMarkerId || !swimlaneContainerRef.current) return;

      const selectedMarker = markersWithTracks.find(
        (m) => m.id === selectedMarkerId
      );
      if (!selectedMarker) return;

      const container = swimlaneContainerRef.current;
      const containerWidth = container.clientWidth;
      const scrollLeft = container.scrollLeft;

      const markerStartTime = selectedMarker.seconds || 0;
      const markerEndTime =
        selectedMarker.end_seconds || markerStartTime + 1;
      const markerCenterTime = (markerStartTime + markerEndTime) / 2;

      const markerPixelPosition =
        markerCenterTime * timelineWidth.pixelsPerSecond;
      const markerAbsolutePosition =
        uniformTagLabelWidth + markerPixelPosition;

      const viewportStart = scrollLeft + uniformTagLabelWidth;
      const viewportEnd = scrollLeft + containerWidth;

      const isVisible =
        markerAbsolutePosition >= viewportStart &&
        markerAbsolutePosition <= viewportEnd;

      if (!isVisible) {
        const targetScrollLeft = markerAbsolutePosition - containerWidth / 2;
        const newScrollLeft = Math.max(0, targetScrollLeft);

        container.scrollTo({
          left: newScrollLeft,
          behavior: "smooth",
        });

        if (headerScrollRef.current) {
          headerScrollRef.current.scrollTo({
            left: newScrollLeft,
            behavior: "smooth",
          });
        }
      }
    }, [
      selectedMarkerId,
      markersWithTracks,
      timelineWidth,
      uniformTagLabelWidth,
      zoom,
    ]);

    // Handle seek callback from TimelineAxis
    const handleSeek = useCallback(
      (time: number) => {
        dispatch(seekToTime(time));
      },
      [dispatch]
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
      <div
        className="bg-gray-800 rounded-lg overflow-hidden flex flex-col"
        ref={(el) => {
          containerRef.current = el;
          if (el && containerWidth === 0) {
            setContainerWidth(el.clientWidth);
          }
          if (windowHeight === 0) {
            setWindowHeight(window.innerHeight);
          }
        }}
      >
        {/* Header row - fixed position with hidden scrollbar */}
        <div
          className="overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          ref={headerScrollRef}
        >
          <div className="flex">
            {/* Left header label */}
            <div
              className="flex-shrink-0 bg-gray-700 border-r border-gray-600 border-b border-gray-600"
              style={{ width: `${uniformTagLabelWidth}px` }}
            >
              <div className="h-8 flex items-center px-3">
                <span className="text-xs text-gray-400">Tags</span>
              </div>
            </div>

            {/* Right header - timeline axis */}
            <div className="flex-1">
              <TimelineAxis
                videoDuration={videoDuration}
                pixelsPerSecond={timelineWidth.pixelsPerSecond}
                timelineWidth={timelineWidth.width}
                showShotBoundaries={showShotBoundaries}
                shotBoundaries={shotBoundaries}
                onSeek={handleSeek}
              />
            </div>
          </div>
        </div>

        {/* Swimlanes container - vertical scrolling */}
        <div
          className={
            swimlaneResizeEnabled
              ? "overflow-x-auto overflow-y-auto"
              : "flex-1 overflow-x-auto overflow-y-auto"
          }
          style={
            swimlaneResizeEnabled
              ? { maxHeight: `${swimlaneMaxHeight}px` }
              : calculatedMaxHeight
                ? { maxHeight: `${calculatedMaxHeight}px` }
                : undefined
          }
          ref={swimlaneContainerRef}
        >
          <div className="flex">
            {/* Labels column */}
            <TimelineLabels
              tagGroups={tagGroups}
              trackCountsByGroup={trackCountsByGroup}
              labelWidth={uniformTagLabelWidth}
              selectedMarkerId={selectedMarkerId}
              markerGroupParentId={markerGroupParentId}
              onReassignClick={handleReassignmentIconClick}
            />

            {/* Grid column */}
            <div className="flex-1">
              <TimelineGrid
                tagGroups={tagGroups}
                markersWithTracks={markersWithTracks}
                trackCountsByGroup={trackCountsByGroup}
                pixelsPerSecond={timelineWidth.pixelsPerSecond}
                timelineWidth={timelineWidth.width}
                currentTime={currentTime}
                selectedMarkerId={selectedMarkerId}
                onMarkerClick={onMarkerClick}
              />
            </div>
          </div>
        </div>

        {/* Combined Marker Group Reassignment and Slot Definition Dialog */}
        {reassignmentUI && (
          <MarkerGroupReassignDialog
            tagId={reassignmentUI.currentTagId}
            tagName={reassignmentUI.tagName}
            correspondingTagRelationships={reassignmentUI.correspondingTagRelationships}
            availableTags={allTags}
            onReassignMarkerGroup={handleReassignMarkerGroup}
            onSetCorrespondingTag={handleSetCorrespondingTag}
            onClose={() => setReassignmentUI(null)}
            onSlotsSaved={async () => {
              // Reload markers to refresh slot data
              if (sceneId) {
                await dispatch(loadMarkers(sceneId));
              }
            }}
          />
        )}
      </div>
    );
  }
);

Timeline.displayName = "Timeline";

export default Timeline;
