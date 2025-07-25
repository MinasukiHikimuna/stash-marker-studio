"use client";

import React, { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { type SceneMarker, type Scene } from "../services/StashappService";
import { TagGroup, MarkerWithTrack } from "../core/marker/types";
import TimelineHeader from "./timeline/TimelineHeader";
import TimelineSwimlanes from "./timeline/TimelineSwimlanes";
import { useAppSelector } from "../store/hooks";
import { selectMarkerGroupParentId } from "../store/slices/configSlice";
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
  filteredSwimlane?: string | null;
  onSwimlaneFilter?: (swimlaneName: string | null) => void;
  scene?: Scene;
  zoom?: number;
  onSwimlaneDataUpdate?: (tagGroups: TagGroup[], markersWithTracks: MarkerWithTrack[]) => void;
};

export default function Timeline({
  markers,
  actionMarkers,
  videoDuration,
  currentTime,
  onMarkerClick,
  selectedMarkerId,
  showShotBoundaries = true,
  filteredSwimlane = null,
  onSwimlaneFilter,
  scene = undefined,
  zoom = 1,
  onSwimlaneDataUpdate,
}: TimelineProps) {
  const markerGroupParentId = useAppSelector(selectMarkerGroupParentId);
  
  // Swimlane resize state
  const [swimlaneMaxHeight, setSwimlaneMaxHeight] = useState<number | null>(null);
  const [swimlaneResizeEnabled, setSwimlaneResizeEnabled] = useState(false);
  const swimlaneContainerRef = useRef<HTMLDivElement>(null);
  
  // Window dimensions state
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Group markers by tag name with proper marker group ordering using shared algorithm
  const markerGroups = useMemo(() => {
    return groupMarkersByTags(actionMarkers, markerGroupParentId);
  }, [actionMarkers, markerGroupParentId]);
  
  // Create markers with track data for keyboard navigation
  const markersWithTracks = useMemo(() => {
    return createMarkersWithTracks(markerGroups);
  }, [markerGroups]);

  // Calculate uniform width for all tag labels based on the longest content
  const uniformTagLabelWidth = useMemo(() => {
    if (markerGroups.length === 0) return 192; // Default minimum width
    
    const trackCountsByGroup = getTrackCountsByGroup(markerGroups);
    let maxWidth = 192; // Minimum width (original w-48)
    
    markerGroups.forEach(group => {
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
  }, [markerGroups, markerGroupParentId]);
  
  // Update parent component with swimlane data for keyboard navigation
  useEffect(() => {
    if (onSwimlaneDataUpdate) {
      onSwimlaneDataUpdate(markerGroups, markersWithTracks);
    }
  }, [markerGroups, markersWithTracks, onSwimlaneDataUpdate]);
  
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
  }, [swimlaneResizeEnabled, swimlaneMaxHeight, markerGroups.length, windowHeight]);
  
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
  
  const timelineWidth = useMemo(() => {
    const basePixelsPerMinute = 300;
    const pixelsPerSecond = (basePixelsPerMinute / 60) * zoom;
    const idealWidth = videoDuration * pixelsPerSecond;
    
    // If we have container width, constrain timeline to fit without overflow
    let actualWidth = idealWidth;
    if (containerWidth > 0) {
      const scrollbarMargin = 20; // Account for potential vertical scrollbar
      const availableWidth = containerWidth - uniformTagLabelWidth - scrollbarMargin;
      if (idealWidth > availableWidth) {
        actualWidth = availableWidth;
      }
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
      {/* Header row */}
      <TimelineHeader
        markers={markers}
        videoDuration={videoDuration}
        currentTime={currentTime}
        showShotBoundaries={showShotBoundaries}
        timelineWidth={timelineWidth}
        scene={scene}
        labelWidth={uniformTagLabelWidth}
      />

      {/* Swimlanes container */}
      <div 
        className={swimlaneResizeEnabled ? "overflow-y-auto" : "flex-1 overflow-y-auto"}
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
          markerGroups={markerGroups}
          videoDuration={videoDuration}
          currentTime={currentTime}
          selectedMarkerId={selectedMarkerId}
          filteredSwimlane={filteredSwimlane}
          timelineWidth={timelineWidth}
          onMarkerClick={onMarkerClick}
          onSwimlaneFilter={onSwimlaneFilter}
          labelWidth={uniformTagLabelWidth}
        />
      </div>
    </div>
  );
}