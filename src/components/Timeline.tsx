"use client";

import React, { useMemo, useEffect, useState, useCallback } from "react";
import { type SceneMarker } from "../services/StashappService";
import { TagGroup, MarkerWithTrack } from "../core/marker/types";
import TimelineHeader from "./timeline/TimelineHeader";
import TimelineSwimlanes from "./timeline/TimelineSwimlanes";
import { useAppSelector } from "../store/hooks";
import { selectMarkerGroupParentId } from "../store/slices/configSlice";
import {
  groupMarkersByTags,
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
  markers,
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
  showShotBoundaries = true,
  filteredSwimlane = null,
  onSwimlaneFilter,
  scene = null,
  zoom = 1,
  onZoomChange: _onZoomChange,
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
      
      // Handle Alt++ and Alt+- for swimlane resizing
      if (event.altKey && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        handleSwimlaneResize('increase');
      } else if (event.altKey && event.key === '-') {
        event.preventDefault();
        handleSwimlaneResize('decrease');
      } else if (event.altKey && event.key === '0') {
        event.preventDefault();
        // Reset to normal state - disable resizing
        setSwimlaneResizeEnabled(false);
        setSwimlaneMaxHeight(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwimlaneResize]);
  
  
  // Calculate timeline dimensions
  const timelineWidth = useMemo(() => {
    const basePixelsPerMinute = 300;
    const pixelsPerSecond = (basePixelsPerMinute / 60) * zoom;
    const width = videoDuration * pixelsPerSecond;
    
    return { width, pixelsPerSecond };
  }, [videoDuration, zoom]);
  

  
  // Don't render if video duration is not available yet
  if (videoDuration <= 0) {
    return (
      <div className="flex items-center justify-center h-24 bg-gray-800 rounded-lg">
        <span className="text-gray-400">Loading video...</span>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden flex flex-col">
      {/* Header row */}
      <TimelineHeader
        markers={markers}
        videoDuration={videoDuration}
        currentTime={currentTime}
        showShotBoundaries={showShotBoundaries}
        timelineWidth={timelineWidth}
        scene={scene}
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
        />
      </div>
    </div>
  );
}