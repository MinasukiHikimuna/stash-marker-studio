"use client";

import React, { useMemo, useEffect, useState } from "react";
import { type SceneMarker, type SpriteFrame, stashappService } from "../services/StashappService";
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
  const [spriteFrames, setSpriteFrames] = useState<SpriteFrame[]>([]);
  
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
  
  // Fetch sprite frames for the scene using direct Stashapp URLs
  useEffect(() => {
    let isCancelled = false;

    const fetchSpriteFrames = async () => {
      if (scene?.paths?.vtt) {
        try {
          console.log("Fetching sprite frames for VTT:", scene.paths.vtt);
          const frames = await stashappService.fetchSpriteFrames(
            scene.paths.vtt
          );
          if (!isCancelled) {
            setSpriteFrames(frames);
            console.log("Loaded", frames.length, "sprite frames");
          }
        } catch (error) {
          if (!isCancelled) {
            console.error("Error loading sprite frames:", error);
            setSpriteFrames([]);
          }
        }
      } else {
        if (!isCancelled) {
          setSpriteFrames([]);
        }
      }
    };

    fetchSpriteFrames();

    return () => {
      isCancelled = true;
    };
  }, [scene?.paths?.vtt]);
  
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
        spriteFrames={spriteFrames}
      />

      {/* Swimlanes */}
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
  );
}