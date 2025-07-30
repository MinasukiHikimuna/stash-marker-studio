"use client";

import React, { useMemo, useEffect, useState, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import { type SceneMarker, type Scene } from "../services/StashappService";
import { TagGroup, MarkerWithTrack } from "../core/marker/types";
import TimelineHeader from "./timeline/TimelineHeader";
import TimelineSwimlanes from "./timeline/TimelineSwimlanes";
import { useAppSelector } from "../store/hooks";
import { selectMarkerGroupParentId, selectMarkerGroups, selectMarkerGroupTagSorting } from "../store/slices/configSlice";
import {
  groupMarkersByTags,
  createMarkersWithTracks,
  getMarkerGroupName,
  getTrackCountsByGroup,
} from "../core/marker/markerGrouping";
import { isPlatformModifierPressed } from "../utils/platform";
import { useThrottledResize } from "../hooks/useThrottledResize";

type TimelineProps = {
  markers: SceneMarker[];
  actionMarkers: SceneMarker[];
  videoDuration: number;
  currentTime: number;
  onMarkerClick: (marker: SceneMarker) => void;
  selectedMarkerId: string | null;
  showShotBoundaries?: boolean;
  scene?: Scene;
  zoom?: number;
  onSwimlaneDataUpdate?: (tagGroups: TagGroup[], markersWithTracks: MarkerWithTrack[]) => void;
  onAvailableWidthUpdate?: (availableWidth: number) => void;
};

export interface TimelineRef {
  centerOnPlayhead: () => void;
}

const Timeline = forwardRef<TimelineRef, TimelineProps>(({
  markers,
  actionMarkers,
  videoDuration,
  currentTime,
  onMarkerClick,
  selectedMarkerId,
  showShotBoundaries = true,
  scene = undefined,
  zoom = 1,
  onSwimlaneDataUpdate,
  onAvailableWidthUpdate,
}, ref) => {
  const markerGroupParentId = useAppSelector(selectMarkerGroupParentId);
  const markerGroups = useAppSelector(selectMarkerGroups);
  const tagSorting = useAppSelector(selectMarkerGroupTagSorting);
  
  // Swimlane resize state
  const [swimlaneMaxHeight, setSwimlaneMaxHeight] = useState<number | null>(null);
  const [swimlaneResizeEnabled, setSwimlaneResizeEnabled] = useState(false);
  const swimlaneContainerRef = useRef<HTMLDivElement>(null);
  
  // Header scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null);
  
  // Window dimensions state
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  
  // Group markers by tag name with proper marker group ordering using shared algorithm
  const tagGroups = useMemo(() => {
    console.log("🎬 [TIMELINE] Grouping markers with data:", {
      actionMarkersCount: actionMarkers.length,
      markerGroupParentId,
      markerGroupsCount: markerGroups.length,
      markerGroups: markerGroups.map(mg => ({ id: mg.id, name: mg.name, hasDescription: !!mg.description }))
    });
    return groupMarkersByTags(actionMarkers, markerGroupParentId, markerGroups, tagSorting);
  }, [actionMarkers, markerGroupParentId, markerGroups, tagSorting]);
  
  // Create markers with track data for keyboard navigation
  const markersWithTracks = useMemo(() => {
    return createMarkersWithTracks(tagGroups);
  }, [tagGroups]);

  // Calculate uniform width for all tag labels based on the longest content
  const uniformTagLabelWidth = useMemo(() => {
    if (tagGroups.length === 0) return 192; // Default minimum width
    
    const trackCountsByGroup = getTrackCountsByGroup(tagGroups);
    let maxWidth = 192; // Minimum width (original w-48)
    
    tagGroups.forEach(group => {
      const markerGroup = getMarkerGroupName(group.markers[0], markerGroupParentId);
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
      
      // Rough character-to-pixel estimation (assuming ~7px per character for this font size)
      const baseCharWidth = 7;
      const padding = 24; // Account for padding and status indicators
      const statusIndicators = 40; // Space for confirmation/rejection counts
      
      const estimatedWidth = textContent.length * baseCharWidth + padding + statusIndicators;
      maxWidth = Math.max(maxWidth, estimatedWidth);
    });
    
    // Cap at reasonable maximum (480px = w-120) and add small buffer to prevent overflow
    const finalWidth = Math.min(470, maxWidth + 10); // Reduced max by 10px and add 10px buffer
    return finalWidth;
  }, [tagGroups, markerGroupParentId]);
  
  // Update parent component with swimlane data for keyboard navigation
  useEffect(() => {
    if (onSwimlaneDataUpdate) {
      onSwimlaneDataUpdate(tagGroups, markersWithTracks);
    }
  }, [tagGroups, markersWithTracks, onSwimlaneDataUpdate]);
  
  // Update parent component with available timeline width
  useEffect(() => {
    if (onAvailableWidthUpdate && containerWidth > 0) {
      const scrollbarMargin = 20;
      const availableWidth = containerWidth - uniformTagLabelWidth - scrollbarMargin;
      onAvailableWidthUpdate(availableWidth);
    }
  }, [containerWidth, uniformTagLabelWidth, onAvailableWidthUpdate]);
  
  // Handle swimlane resize keyboard shortcuts
  const handleSwimlaneResize = useCallback((direction: 'increase' | 'decrease') => {
    const swimlaneHeight = 32; // 32px per swimlane (h-8)
    
    // Get actual container dimensions
    const container = swimlaneContainerRef.current;
    if (!container) return;
    
    const actualContentHeight = container.scrollHeight;
    
    // Calculate maximum allowed height to ensure video player gets at least 1/3 of viewport
    const viewportHeight = windowHeight || window.innerHeight;
    const videoPlayerMinHeight = viewportHeight / 3;
    const timelineHeaderHeight = 60; // Approximate height of timeline header
    const pageHeaderHeight = 80; // Approximate height of page header
    const maxAllowedSwimlaneHeight = viewportHeight - videoPlayerMinHeight - timelineHeaderHeight - pageHeaderHeight;
    
    if (!swimlaneResizeEnabled) {
      // Enable resizing on first use and set initial height based on actual content
      let initialHeight = actualContentHeight;
      
      // Apply the first action immediately for visible feedback
      if (direction === 'decrease') {
        initialHeight = Math.max(swimlaneHeight, initialHeight - (swimlaneHeight * 2)); // Decrease by 2 to make it visually obvious
      } else {
        initialHeight = initialHeight + swimlaneHeight; // Increase by 1
      }
      
      // Constrain to maximum allowed height
      initialHeight = Math.min(initialHeight, maxAllowedSwimlaneHeight);
      
      setSwimlaneMaxHeight(initialHeight);
      setSwimlaneResizeEnabled(true);
      return;
    }
    
    // Calculate current height - use actual content height if no max height is set
    const currentHeight = swimlaneMaxHeight || actualContentHeight;
    let newHeight;
    
    if (direction === 'increase') {
      newHeight = currentHeight + swimlaneHeight;
      // Constrain to maximum allowed height
      newHeight = Math.min(newHeight, maxAllowedSwimlaneHeight);
    } else {
      // Don't go below one swimlane height
      newHeight = Math.max(swimlaneHeight, currentHeight - swimlaneHeight);
    }
    
    setSwimlaneMaxHeight(newHeight);
  }, [swimlaneResizeEnabled, swimlaneMaxHeight, windowHeight]);
  
  // Keyboard event handler for timeline-specific shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keyboard shortcuts if we're typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      
      // Handle Alt++/Option++ and Alt+-/Option+- for swimlane resizing
      if (isPlatformModifierPressed(event) && (event.key === '=' || event.key === '+' || event.key === '±')) {
        // Handle regular plus/equals and Mac plus-minus (±) from Option++
        event.preventDefault();
        handleSwimlaneResize('increase');
      } else if (isPlatformModifierPressed(event) && (event.key === '-' || event.key === '–')) {
        // Handle both regular hyphen (-) and Mac en dash (–) from Option+-
        event.preventDefault();
        handleSwimlaneResize('decrease');
      } else if (isPlatformModifierPressed(event) && (event.key === '0' || event.key === 'º' || event.key === '≈')) {
        // Handle regular 0, Mac degree symbol (º), and approximately equal (≈) from Option combinations
        event.preventDefault();
        // Reset to normal state - disable resizing
        setSwimlaneResizeEnabled(false);
        setSwimlaneMaxHeight(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwimlaneResize]);
  
  
  // Update container width and window height on throttled resize
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const newWidth = containerRef.current.clientWidth;
      if (newWidth !== containerWidth) {
        setContainerWidth(newWidth);
      }
    }
    
    const newHeight = window.innerHeight;
    if (newHeight !== windowHeight) {
      setWindowHeight(newHeight);
    }
  }, [containerWidth, windowHeight]);
  
  // Use throttled resize hook to handle window resize events
  useThrottledResize(updateDimensions, 250);
  
  // Initialize window height on mount
  useEffect(() => {
    setWindowHeight(window.innerHeight);
  }, []);
  
  // Synchronize horizontal scrolling between header and swimlanes
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
      setTimeout(() => { isHeaderScrolling = false; }, 0);
    };
    
    const handleSwimlaneScroll = () => {
      if (isHeaderScrolling) return;
      isSwimlaneScrolling = true;
      headerContainer.scrollLeft = swimlanesContainer.scrollLeft;
      setTimeout(() => { isSwimlaneScrolling = false; }, 0);
    };
    
    headerContainer.addEventListener('scroll', handleHeaderScroll);
    swimlanesContainer.addEventListener('scroll', handleSwimlaneScroll);
    
    return () => {
      headerContainer.removeEventListener('scroll', handleHeaderScroll);
      swimlanesContainer.removeEventListener('scroll', handleSwimlaneScroll);
    };
  }, []);
  
  const timelineWidth = useMemo(() => {
    const basePixelsPerMinute = 300;
    const pixelsPerSecond = (basePixelsPerMinute / 60) * zoom;
    const idealWidth = videoDuration * pixelsPerSecond;
    
    
    // Smart width constraint: allow timeline to exceed container when zoomed, 
    // but constrain to fit when timeline would naturally fit
    let actualWidth = idealWidth;
    if (containerWidth > 0) {
      const scrollbarMargin = 20; // Account for potential vertical scrollbar
      const availableWidth = containerWidth - uniformTagLabelWidth - scrollbarMargin;
      
      console.log("WIDTH DEBUG:", {
        zoom,
        idealWidth,
        containerWidth,
        uniformTagLabelWidth,
        availableWidth,
        fitsNaturally: idealWidth <= availableWidth
      });
      
      // Only constrain if timeline would fit naturally (not intentionally zoomed beyond container)
      // Add some tolerance for small calculation differences between fit-zoom and actual layout
      const tolerance = 50; // Allow up to 50px difference
      if (idealWidth <= availableWidth + tolerance) {
        actualWidth = Math.min(idealWidth, availableWidth);
        console.log("CONSTRAINING width from", idealWidth, "to", actualWidth);
      } else {
        console.log("ALLOWING scroll - idealWidth", idealWidth, "> availableWidth + tolerance", availableWidth + tolerance);
      }
      // If idealWidth > availableWidth, user is intentionally zoomed in, so allow scrolling
    }
    
    return { width: actualWidth, pixelsPerSecond: actualWidth / videoDuration };
  }, [videoDuration, zoom, containerWidth, uniformTagLabelWidth]);
  
  // Apply passive height constraint to prevent timeline from covering video player
  const calculatedMaxHeight = useMemo(() => {
    if (!swimlaneResizeEnabled && windowHeight > 0) {
      // When not in resize mode, apply passive constraint
      const videoPlayerMinHeight = windowHeight / 3;
      const timelineHeaderHeight = 60;
      const pageHeaderHeight = 80;
      const maxAllowedHeight = windowHeight - videoPlayerMinHeight - timelineHeaderHeight - pageHeaderHeight;
      return maxAllowedHeight;
    }
    return null;
  }, [swimlaneResizeEnabled, windowHeight]);

  // Center timeline on playhead function
  const centerOnPlayhead = useCallback(() => {
    if (!swimlaneContainerRef.current || videoDuration <= 0) return;
    
    const container = swimlaneContainerRef.current;
    const containerWidth = container.clientWidth;
    
    // Calculate playhead position in pixels using the same logic as marker positioning
    const playheadPixelPosition = currentTime * timelineWidth.pixelsPerSecond;
    const labelWidth = uniformTagLabelWidth;
    const playheadAbsolutePosition = labelWidth + playheadPixelPosition;
    
    // Center the playhead in the viewport
    const targetScrollLeft = playheadAbsolutePosition - containerWidth / 2;
    const scrollLeft = Math.max(0, targetScrollLeft);
    
    // Scroll both containers in sync
    container.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
    
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    }
  }, [currentTime, timelineWidth, uniformTagLabelWidth, videoDuration]);
  
  // Expose center playhead function to parent via ref
  useImperativeHandle(ref, () => ({
    centerOnPlayhead
  }), [centerOnPlayhead]);

  // Scroll selected marker into view when selection changes or zoom changes
  useEffect(() => {
    if (!selectedMarkerId || !swimlaneContainerRef.current) return;

    const selectedMarker = actionMarkers.find(m => m.id === selectedMarkerId);
    if (!selectedMarker) return;

    const container = swimlaneContainerRef.current;
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;

    // Calculate marker position in pixels
    const markerStartTime = selectedMarker.seconds || 0;
    const markerEndTime = selectedMarker.end_seconds || markerStartTime + 1;
    const markerCenterTime = (markerStartTime + markerEndTime) / 2;
    
    const markerPixelPosition = markerCenterTime * timelineWidth.pixelsPerSecond;
    const labelWidth = uniformTagLabelWidth;
    const markerAbsolutePosition = labelWidth + markerPixelPosition;

    // Check if marker is visible in current viewport
    const viewportStart = scrollLeft + labelWidth;
    const viewportEnd = scrollLeft + containerWidth;
    const isVisible = markerAbsolutePosition >= viewportStart && markerAbsolutePosition <= viewportEnd;

    if (!isVisible) {
      // Scroll to center the marker in the viewport
      const targetScrollLeft = markerAbsolutePosition - containerWidth / 2;
      const scrollLeft = Math.max(0, targetScrollLeft);
      
      // Scroll both containers in sync
      container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
      
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }
  }, [selectedMarkerId, zoom, actionMarkers, timelineWidth, uniformTagLabelWidth]);
  
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
        // Set initial dimensions on mount
        if (el && containerWidth === 0) {
          setContainerWidth(el.clientWidth);
        }
        if (windowHeight === 0) {
          setWindowHeight(window.innerHeight);
        }
      }}
    >
      {/* Header row - fixed position */}
      <div 
        className="[&::-webkit-scrollbar]:hidden" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        ref={headerScrollRef}
      >
        <TimelineHeader
          markers={markers}
          videoDuration={videoDuration}
          currentTime={currentTime}
          showShotBoundaries={showShotBoundaries}
          timelineWidth={timelineWidth}
          scene={scene}
          labelWidth={uniformTagLabelWidth}
        />
      </div>

      {/* Swimlanes container - vertical scrolling */}
      <div 
        className={swimlaneResizeEnabled ? "overflow-x-auto overflow-y-auto" : "flex-1 overflow-x-auto overflow-y-auto"}
        style={
          swimlaneResizeEnabled 
            ? { maxHeight: `${swimlaneMaxHeight}px` }
            : calculatedMaxHeight 
              ? { maxHeight: `${calculatedMaxHeight}px` }
              : undefined
        }
        ref={swimlaneContainerRef}
      >
        <TimelineSwimlanes
          markerGroups={tagGroups}
          videoDuration={videoDuration}
          currentTime={currentTime}
          selectedMarkerId={selectedMarkerId}
          timelineWidth={timelineWidth}
          onMarkerClick={onMarkerClick}
          labelWidth={uniformTagLabelWidth}
        />
      </div>
    </div>
  );
});

Timeline.displayName = 'Timeline';

export default Timeline;