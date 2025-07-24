"use client";

import React, { useMemo, useEffect, useState, useCallback } from "react";
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
    console.log('=== LABEL WIDTH CALCULATION ===');
    console.log('Calculated label width:', finalWidth);
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
    
    if (!swimlaneResizeEnabled) {
      // Enable resizing on first use - set initial height to current number of swimlanes
      let initialHeight = markerGroups.length * swimlaneHeight;
      
      // If first action is decrease, start one swimlane smaller
      if (direction === 'decrease') {
        initialHeight = Math.max(swimlaneHeight, initialHeight - swimlaneHeight);
      }
      
      setSwimlaneMaxHeight(initialHeight);
      setSwimlaneResizeEnabled(true);
      return;
    }
    
    // Calculate current height
    const currentHeight = swimlaneMaxHeight || (markerGroups.length * swimlaneHeight);
    
    if (direction === 'increase') {
      setSwimlaneMaxHeight(currentHeight + swimlaneHeight);
    } else {
      // Don't go below one swimlane height
      setSwimlaneMaxHeight(Math.max(swimlaneHeight, currentHeight - swimlaneHeight));
    }
  }, [swimlaneResizeEnabled, swimlaneMaxHeight, markerGroups.length]);
  
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
  
  
  // Calculate timeline dimensions with container width constraint
  const [containerWidth, setContainerWidth] = useState<number>(0);
  
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
    
    console.log('=== TIMELINE WIDTH CALCULATION ===');
    console.log('Video duration:', videoDuration, 'seconds');
    console.log('Pixels per second:', pixelsPerSecond);
    console.log('Ideal timeline width:', idealWidth);
    console.log('Available width:', containerWidth - uniformTagLabelWidth);
    console.log('Actual timeline width:', actualWidth);
    
    return { width: actualWidth, pixelsPerSecond: actualWidth / videoDuration };
  }, [videoDuration, zoom, containerWidth, uniformTagLabelWidth]);
  

  
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
        if (el && el.clientWidth !== containerWidth) {
          setContainerWidth(el.clientWidth);
          console.log('=== TIMELINE CONTAINER DIMENSIONS ===');
          console.log('Container width:', el.clientWidth);
          console.log('Label width:', uniformTagLabelWidth);
          console.log('Timeline width:', timelineWidth.width);
          console.log('Total needed width:', uniformTagLabelWidth + timelineWidth.width);
          console.log('Available space for timeline:', el.clientWidth - uniformTagLabelWidth);
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
        className={swimlaneResizeEnabled ? "overflow-y-auto" : "flex-1"}
        style={swimlaneResizeEnabled ? { maxHeight: `${swimlaneMaxHeight}px` } : undefined}
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