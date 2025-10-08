import { useCallback } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setSelectedMarkerId } from '../store/slices/markerSlice';
import { isMarkerConfirmed, isMarkerRejected } from '../core/marker/markerLogic';
import { type SceneMarker } from '../services/StashappService';
import { MarkerWithTrack } from '../core/marker/types';

interface UseMarkerNavigationParams {
  markers: SceneMarker[];
  markersWithTracks: MarkerWithTrack[];
  tagGroups: { name: string; [key: string]: unknown }[];
  selectedMarkerId: string | null;
  currentVideoTime: number;
}

export const useMarkerNavigation = (params: UseMarkerNavigationParams) => {
  const dispatch = useAppDispatch();
  const {
    markers,
    markersWithTracks,
    tagGroups,
    selectedMarkerId,
    currentVideoTime,
  } = params;

  // Helper function to check if a marker is unprocessed
  const isUnprocessed = useCallback((marker: SceneMarker): boolean => {
    // Check if marker has confirmation or rejection status tags
    const isConfirmed = isMarkerConfirmed(marker);
    const isRejected = isMarkerRejected(marker);
    const result = !isConfirmed && !isRejected;
    
    // Always log for debugging marker selection issues
    console.log("isUnprocessed check", {
      markerId: marker.id,
      tag: marker.primary_tag.name,
      seconds: marker.seconds,
      tags: marker.tags?.map(tag => tag.name) || [],
      isConfirmed,
      isRejected,
      result
    });
    
    return result;
  }, []);

  // Helper function to find next unprocessed marker globally
  const findNextUnprocessedMarker = useCallback((): string | null => {
    const currentMarker = markers.find(
      (m) => m.id === selectedMarkerId
    );
    const currentIndex = currentMarker
      ? markers.indexOf(currentMarker)
      : -1;

    // Look for next unprocessed marker starting from current position
    for (let i = currentIndex + 1; i < markers.length; i++) {
      if (isUnprocessed(markers[i])) {
        return markers[i].id;
      }
    }

    // If no unprocessed found after current, search from beginning
    for (let i = 0; i < currentIndex; i++) {
      if (isUnprocessed(markers[i])) {
        return markers[i].id;
      }
    }

    return null; // No unprocessed markers found
  }, [markers, selectedMarkerId, isUnprocessed]);

  // Helper function to find previous unprocessed marker globally (cross-swimlane without rollover)
  const findPreviousUnprocessedGlobal = useCallback((): string | null => {
    console.log("findPreviousUnprocessedGlobal called", {
      hasSwilaneData: markersWithTracks.length > 0 && tagGroups.length > 0,
      markersWithTracksCount: markersWithTracks.length,
      tagGroupsCount: tagGroups.length,
      selectedMarkerId,
      markersCount: markers.length
    });

    if (markersWithTracks.length === 0 || tagGroups.length === 0) {
      console.log("No swimlane data available - should not call findPreviousUnprocessedGlobal without swimlane data");
      return null;
    }

    const currentMarker = markers.find(
      (m) => m.id === selectedMarkerId
    );
    
    console.log("Swimlane search starting", {
      currentMarker: currentMarker ? {
        id: currentMarker.id,
        tag: currentMarker.primary_tag.name,
        seconds: currentMarker.seconds
      } : null,
      swimlaneStructure: {
        tagGroups: tagGroups.map((group, index) => ({
          index,
          name: group.name,
          markerCount: markersWithTracks.filter(m => m.swimlane === index).length
        })),
        markersWithTracks: markersWithTracks.map(m => ({
          id: m.id,
          swimlane: m.swimlane,
          seconds: m.seconds,
          isUnprocessed: markers.find(am => am.id === m.id) ? isUnprocessed(markers.find(am => am.id === m.id)!) : false
        }))
      }
    });
    
    if (!currentMarker) {
      // No marker selected, start from last swimlane (reverse order)
      console.log("No current marker, searching from end");
      for (let swimlaneIndex = tagGroups.length - 1; swimlaneIndex >= 0; swimlaneIndex--) {
        const swimlaneMarkers = markersWithTracks
          .filter(m => m.swimlane === swimlaneIndex)
          .sort((a, b) => b.seconds - a.seconds); // Sort descending for reverse search

        console.log(`Checking swimlane ${swimlaneIndex}`, {
          swimlaneName: tagGroups[swimlaneIndex].name,
          markersInSwimlane: swimlaneMarkers.length
        });

        for (let i = 0; i < swimlaneMarkers.length; i++) {
          const marker = swimlaneMarkers[i];
          const foundMarker = markers.find(m => m.id === marker.id);
          if (foundMarker && isUnprocessed(foundMarker)) {
            console.log("Found last unprocessed marker", {
              swimlaneIndex,
              markerId: foundMarker.id,
              tag: foundMarker.primary_tag.name
            });
            return foundMarker.id;
          }
        }
      }
      console.log("No unprocessed markers found in any swimlane");
      return null;
    }
    
    const currentSwimlaneIndex = markersWithTracks.find(m => m.id === currentMarker.id)?.swimlane ?? 0;
    console.log("Current marker swimlane", { currentSwimlaneIndex });
    
    // Search from current swimlane backwards to beginning (no wrapping)
    for (let swimlaneIndex = currentSwimlaneIndex; swimlaneIndex >= 0; swimlaneIndex--) {
      // Get all markers in this swimlane, sorted by time (descending for reverse search)
      const swimlaneMarkers = markersWithTracks
        .filter(m => m.swimlane === swimlaneIndex)
        .sort((a, b) => b.seconds - a.seconds);

      if (swimlaneMarkers.length === 0) continue;

      // For current swimlane, start searching before current marker
      const startIndex = (swimlaneIndex === currentSwimlaneIndex) 
        ? swimlaneMarkers.findIndex(m => m.seconds < currentMarker.seconds) 
        : 0;

      console.log(`Searching swimlane ${swimlaneIndex}`, {
        swimlaneName: tagGroups[swimlaneIndex].name,
        markersInSwimlane: swimlaneMarkers.length,
        startIndex,
        isCurrentSwimlane: swimlaneIndex === currentSwimlaneIndex
      });

      // Skip current swimlane if no markers found before current marker
      if (swimlaneIndex === currentSwimlaneIndex && startIndex === -1) {
        console.log(`No markers before current marker in current swimlane, skipping to previous swimlane`);
        continue;
      }

      // Search for unprocessed marker in this swimlane
      for (let i = Math.max(0, startIndex); i < swimlaneMarkers.length; i++) {
        const marker = swimlaneMarkers[i];
        const actionMarker = markers.find(m => m.id === marker.id);
        if (actionMarker && isUnprocessed(actionMarker)) {
          console.log("Found previous unprocessed marker", {
            swimlaneIndex,
            markerIndex: i,
            markerId: actionMarker.id,
            tag: actionMarker.primary_tag.name
          });
          return actionMarker.id;
        }
      }
    }

    console.log("No previous unprocessed markers found in swimlane search");
    return null; // No unprocessed markers found
  }, [markersWithTracks, tagGroups, markers, selectedMarkerId, isUnprocessed]);

  // Helper function to find next unprocessed marker in current swimlane
  const findNextUnprocessedMarkerInSwimlane = useCallback((): string | null => {
    if (markersWithTracks.length === 0) {
      // If no swimlane data, stay on current marker
      return selectedMarkerId;
    }

    const currentMarker = markers.find(
      (m) => m.id === selectedMarkerId
    );
    if (!currentMarker) return null;

    // Find current marker in markersWithTracks
    const currentMarkerWithTrack = markersWithTracks.find(
      (m) => m.id === currentMarker.id
    );
    if (!currentMarkerWithTrack) return selectedMarkerId;

    // Get all markers in the same swimlane, sorted by time
    const swimlaneMarkers = markersWithTracks
      .filter((m) => m.swimlane === currentMarkerWithTrack.swimlane)
      .sort((a, b) => a.seconds - b.seconds);

    const currentIndex = swimlaneMarkers.findIndex(
      (m) => m.id === currentMarker.id
    );
    if (currentIndex === -1) return selectedMarkerId;

    // Look for next unprocessed marker in swimlane starting from current position
    for (let i = currentIndex + 1; i < swimlaneMarkers.length; i++) {
      const marker = swimlaneMarkers[i];
      // Find this marker in markers to check its status
      const foundMarker = markers.find((m) => m.id === marker.id);
      if (foundMarker && isUnprocessed(foundMarker)) {
        return foundMarker.id;
      }
    }

    // If no later unprocessed markers found in swimlane, stay on current marker
    return selectedMarkerId;
  }, [markersWithTracks, markers, selectedMarkerId, isUnprocessed]);

  // Helper function to find previous unprocessed marker in current swimlane
  const findPreviousUnprocessedMarkerInSwimlane = useCallback(():
    | string
    | null => {
    if (markersWithTracks.length === 0) {
      // If no swimlane data, stay on current marker
      return selectedMarkerId;
    }

    const currentMarker = markers.find(
      (m) => m.id === selectedMarkerId
    );
    if (!currentMarker) return null;

    // Find current marker in markersWithTracks
    const currentMarkerWithTrack = markersWithTracks.find(
      (m) => m.id === currentMarker.id
    );
    if (!currentMarkerWithTrack) return selectedMarkerId;

    // Get all markers in the same swimlane, sorted by time
    const swimlaneMarkers = markersWithTracks
      .filter((m) => m.swimlane === currentMarkerWithTrack.swimlane)
      .sort((a, b) => a.seconds - b.seconds);

    const currentIndex = swimlaneMarkers.findIndex(
      (m) => m.id === currentMarker.id
    );
    if (currentIndex === -1) return selectedMarkerId;

    // Look for previous unprocessed marker in swimlane starting from current position
    for (let i = currentIndex - 1; i >= 0; i--) {
      const marker = swimlaneMarkers[i];
      // Find this marker in markers to check its status
      const foundMarker = markers.find((m) => m.id === marker.id);
      if (foundMarker && isUnprocessed(foundMarker)) {
        return foundMarker.id;
      }
    }

    // If no unprocessed found before current, search from end of swimlane
    for (let i = swimlaneMarkers.length - 1; i > currentIndex; i--) {
      const marker = swimlaneMarkers[i];
      // Find this marker in markers to check its status
      const foundMarker = markers.find((m) => m.id === marker.id);
      if (foundMarker && isUnprocessed(foundMarker)) {
        return foundMarker.id;
      }
    }

    return null; // No unprocessed markers found in swimlane
  }, [markersWithTracks, markers, selectedMarkerId, isUnprocessed]);

  // Helper function to find next unprocessed marker globally (cross-swimlane without rollover)
  const findNextUnprocessedGlobal = useCallback((): string | null => {
    console.log("findNextUnprocessedGlobal called", {
      hasSwilaneData: markersWithTracks.length > 0 && tagGroups.length > 0,
      markersWithTracksCount: markersWithTracks.length,
      tagGroupsCount: tagGroups.length,
      selectedMarkerId,
      markersCount: markers.length
    });

    if (markersWithTracks.length === 0 || tagGroups.length === 0) {
      console.log("No swimlane data available - should not call findNextUnprocessedGlobal without swimlane data");
      return null;
    }

    const currentMarker = markers.find(
      (m) => m.id === selectedMarkerId
    );
    
    console.log("Swimlane search starting", {
      currentMarker: currentMarker ? {
        id: currentMarker.id,
        tag: currentMarker.primary_tag.name,
        seconds: currentMarker.seconds
      } : null,
      swimlaneStructure: {
        tagGroups: tagGroups.map((group, index) => ({
          index,
          name: group.name,
          markerCount: markersWithTracks.filter(m => m.swimlane === index).length
        })),
        markersWithTracks: markersWithTracks.map(m => ({
          id: m.id,
          swimlane: m.swimlane,
          seconds: m.seconds,
          isUnprocessed: markers.find(am => am.id === m.id) ? isUnprocessed(markers.find(am => am.id === m.id)!) : false
        }))
      }
    });
    
    if (!currentMarker) {
      // No marker selected, start from first swimlane
      console.log("No current marker, searching from beginning");
      for (let swimlaneIndex = 0; swimlaneIndex < tagGroups.length; swimlaneIndex++) {
        const swimlaneMarkers = markersWithTracks
          .filter(m => m.swimlane === swimlaneIndex)
          .sort((a, b) => a.seconds - b.seconds);

        console.log(`Checking swimlane ${swimlaneIndex}`, {
          swimlaneName: tagGroups[swimlaneIndex].name,
          markersInSwimlane: swimlaneMarkers.length
        });

        for (let i = 0; i < swimlaneMarkers.length; i++) {
          const marker = swimlaneMarkers[i];
          const foundMarker = markers.find(m => m.id === marker.id);
          if (foundMarker && isUnprocessed(foundMarker)) {
            console.log("Found first unprocessed marker", {
              swimlaneIndex,
              markerId: foundMarker.id,
              tag: foundMarker.primary_tag.name
            });
            return foundMarker.id;
          }
        }
      }
      console.log("No unprocessed markers found in any swimlane");
      return null;
    }
    
    const currentSwimlaneIndex = markersWithTracks.find(m => m.id === currentMarker.id)?.swimlane ?? 0;
    console.log("Current marker swimlane", { currentSwimlaneIndex });
    
    // Search from current swimlane to end (no wrapping)
    for (let swimlaneIndex = currentSwimlaneIndex; swimlaneIndex < tagGroups.length; swimlaneIndex++) {
      // Get all markers in this swimlane, sorted by time
      const swimlaneMarkers = markersWithTracks
        .filter(m => m.swimlane === swimlaneIndex)
        .sort((a, b) => a.seconds - b.seconds);

      if (swimlaneMarkers.length === 0) continue;

      // For current swimlane, start searching after current marker
      const startIndex = (swimlaneIndex === currentSwimlaneIndex) 
        ? swimlaneMarkers.findIndex(m => m.seconds > currentMarker.seconds) 
        : 0;

      console.log(`Searching swimlane ${swimlaneIndex}`, {
        swimlaneName: tagGroups[swimlaneIndex].name,
        markersInSwimlane: swimlaneMarkers.length,
        startIndex,
        isCurrentSwimlane: swimlaneIndex === currentSwimlaneIndex
      });

      // Skip current swimlane if no markers found after current marker
      if (swimlaneIndex === currentSwimlaneIndex && startIndex === -1) {
        console.log(`No markers after current marker in current swimlane, skipping to next swimlane`);
        continue;
      }

      // Search for unprocessed marker in this swimlane
      for (let i = Math.max(0, startIndex); i < swimlaneMarkers.length; i++) {
        const marker = swimlaneMarkers[i];
        const actionMarker = markers.find(m => m.id === marker.id);
        if (actionMarker && isUnprocessed(actionMarker)) {
          console.log("Found next unprocessed marker", {
            swimlaneIndex,
            markerIndex: i,
            markerId: actionMarker.id,
            tag: actionMarker.primary_tag.name
          });
          return actionMarker.id;
        }
      }
    }

    console.log("No next unprocessed markers found in swimlane search");
    return null; // No unprocessed markers found
  }, [markersWithTracks, tagGroups, markers, selectedMarkerId, isUnprocessed]);

  // Helper function to find next unprocessed swimlane (top-to-bottom, left-to-right)
  const findNextUnprocessedSwimlane = useCallback((forceFromBeginning: boolean = false): string | null => {
    if (markersWithTracks.length === 0 || tagGroups.length === 0) {
      throw new Error(`findNextUnprocessedSwimlane called without swimlane data! markersWithTracks: ${markersWithTracks.length}, tagGroups: ${tagGroups.length}. This indicates a timing issue where marker selection is happening before Timeline component provides swimlane data.`);
    }

    const currentMarker = markers.find(
      (m) => m.id === selectedMarkerId
    );
    
    // If no marker is selected or forcing from beginning, start from the very beginning
    if (selectedMarkerId === null || !currentMarker || forceFromBeginning) {
      // Search from first swimlane, first marker
      for (let swimlaneIndex = 0; swimlaneIndex < tagGroups.length; swimlaneIndex++) {
        const swimlaneMarkers = markersWithTracks
          .filter(m => m.swimlane === swimlaneIndex)
          .sort((a, b) => a.seconds - b.seconds);

        for (let i = 0; i < swimlaneMarkers.length; i++) {
          const marker = swimlaneMarkers[i];
          const foundMarker = markers.find(m => m.id === marker.id);
          if (foundMarker && isUnprocessed(foundMarker)) {
            return foundMarker.id;
          }
        }
      }
      return null;
    }
    
    const currentSwimlaneIndex = markersWithTracks.find(m => m.id === currentMarker.id)?.swimlane ?? 0;
    const currentTime = currentMarker.seconds;

    // Search from current swimlane to end, then from beginning
    for (let swimlanePass = 0; swimlanePass < 2; swimlanePass++) {
      const startSwimlane = swimlanePass === 0 ? currentSwimlaneIndex : 0;
      const endSwimlane = swimlanePass === 0 ? tagGroups.length : currentSwimlaneIndex;

      for (let swimlaneIndex = startSwimlane; swimlaneIndex < endSwimlane; swimlaneIndex++) {
        // Get all markers in this swimlane, sorted by time
        const swimlaneMarkers = markersWithTracks
          .filter(m => m.swimlane === swimlaneIndex)
          .sort((a, b) => a.seconds - b.seconds);

        if (swimlaneMarkers.length === 0) continue;

        // For current swimlane on first pass, start searching after current marker
        const startIndex = (swimlanePass === 0 && swimlaneIndex === currentSwimlaneIndex) 
          ? swimlaneMarkers.findIndex(m => m.seconds > currentTime) 
          : 0;

        // Search for unprocessed marker in this swimlane
        for (let i = Math.max(0, startIndex); i < swimlaneMarkers.length; i++) {
          const marker = swimlaneMarkers[i];
          const foundMarker = markers.find(m => m.id === marker.id);
          if (foundMarker && isUnprocessed(foundMarker)) {
            return foundMarker.id;
          }
        }
      }
    }

    return null; // No unprocessed markers found
  }, [markersWithTracks, tagGroups, markers, selectedMarkerId, isUnprocessed]);

  // Helper function for swimlane navigation
  const navigateBetweenSwimlanes = useCallback(
    (direction: "up" | "down", useTemporalLocality: boolean = true) => {
      // Find current marker
      const currentMarker = markers.find(
        (m) => m.id === selectedMarkerId
      );
      if (!currentMarker) {
        // If no marker is selected, select the first one
        if (markers.length > 0) {
          dispatch(setSelectedMarkerId(markers[0].id));
        }
        return;
      }

      // Find current marker in markersWithTracks
      const currentMarkerWithTrack = markersWithTracks.find(
        (m) => m.id === currentMarker.id
      );
      if (!currentMarkerWithTrack) return;

      const currentSwimlane = currentMarkerWithTrack.swimlane;
      let targetSwimlane;

      if (direction === "up") {
        targetSwimlane =
          currentSwimlane > 0 ? currentSwimlane - 1 : currentSwimlane;
      } else {
        targetSwimlane =
          currentSwimlane < tagGroups.length - 1
            ? currentSwimlane + 1
            : currentSwimlane;
      }

      if (targetSwimlane === currentSwimlane) return;

      // Find all markers in target swimlane
      const swimlaneMarkers = markersWithTracks.filter(
        (m) => m.swimlane === targetSwimlane
      );

      if (swimlaneMarkers.length === 0) return;

      let bestMatch;
      if (useTemporalLocality) {
        // Find the marker closest in time to the playhead position
        bestMatch = swimlaneMarkers.reduce((closest, marker) => {
          if (!closest) return marker;
          const currentDiff = Math.abs(marker.seconds - currentVideoTime);
          const closestDiff = Math.abs(closest.seconds - currentVideoTime);
          return currentDiff < closestDiff ? marker : closest;
        }, null as MarkerWithTrack | null);
      } else {
        // Just take the first marker in the swimlane
        bestMatch = swimlaneMarkers[0];
      }

      if (bestMatch) {
        dispatch(setSelectedMarkerId(bestMatch.id));
      }
    },
    [
      markersWithTracks,
      tagGroups,
      markers,
      selectedMarkerId,
      currentVideoTime,
      dispatch
    ]
  );

  // Helper function for same-swimlane navigation
  const navigateWithinSwimlane = useCallback(
    (direction: "left" | "right") => {
      // Find current marker
      const currentMarker = markers.find(
        (m) => m.id === selectedMarkerId
      );
      if (!currentMarker) {
        // If no marker is selected, select the first one
        if (markers.length > 0) {
          dispatch(setSelectedMarkerId(markers[0].id));
        }
        return;
      }

      // Find current marker in markersWithTracks
      const currentMarkerWithTrack = markersWithTracks.find(
        (m) => m.id === currentMarker.id
      );
      if (!currentMarkerWithTrack) return;

      // Find all markers in the same swimlane, sorted by time
      const swimlaneMarkers = markersWithTracks
        .filter((m) => m.swimlane === currentMarkerWithTrack.swimlane)
        .sort((a, b) => a.seconds - b.seconds);

      const currentIndex = swimlaneMarkers.findIndex(
        (m) => m.id === currentMarker.id
      );
      if (currentIndex === -1) return;

      let targetIndex;
      if (direction === "left") {
        targetIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
      } else {
        targetIndex =
          currentIndex < swimlaneMarkers.length - 1
            ? currentIndex + 1
            : currentIndex;
      }

      if (targetIndex === currentIndex) return;

      const targetMarker = swimlaneMarkers[targetIndex];
      dispatch(setSelectedMarkerId(targetMarker.id));
    },
    [
      markersWithTracks,
      markers,
      selectedMarkerId,
      dispatch
    ]
  );

  // Helper function to find markers that touch the playhead
  const findMarkersAtPlayhead = useCallback((currentTime: number): SceneMarker[] => {
    const WINDOW_SIZE = 15; // seconds
    return markers.filter(marker => {
      const startTime = marker.seconds;
      const endTime = marker.end_seconds || marker.seconds + 30; // Default duration if no end time
      return (currentTime + WINDOW_SIZE >= startTime) && (currentTime - WINDOW_SIZE <= endTime);
    });
  }, [markers]);

  // Helper function to navigate through markers at playhead, skipping current swimlane
  const findMarkerAtPlayheadInDirection = useCallback((currentTime: number, direction: 'next' | 'previous'): string | null => {
    const markersAtPlayhead = findMarkersAtPlayhead(currentTime);
    if (markersAtPlayhead.length === 0) return null;

    // Determine current swimlane
    const currentMarker = markers.find(m => m.id === selectedMarkerId);
    const currentSwimlaneIndex = currentMarker
      ? markersWithTracks.find(m => m.id === currentMarker.id)?.swimlane ?? -1
      : -1;

    // Sort by swimlane (if available) or by tag name for consistent ordering
    const sortedMarkers = markersAtPlayhead.sort((a, b) => {
      // Try to use swimlane data if available
      const aTrack = markersWithTracks.find(m => m.id === a.id);
      const bTrack = markersWithTracks.find(m => m.id === b.id);

      if (aTrack && bTrack) {
        // Primary: sort by swimlane
        if (aTrack.swimlane !== bTrack.swimlane) {
          return aTrack.swimlane - bTrack.swimlane;
        }
        // Secondary: within same swimlane, sort by temporal proximity to playhead
        const aDistance = Math.abs(a.seconds - currentTime);
        const bDistance = Math.abs(b.seconds - currentTime);
        return aDistance - bDistance;
      }

      // Fallback to tag name sorting
      return a.primary_tag.name.localeCompare(b.primary_tag.name);
    });

    // Filter out markers from the current swimlane
    const markersExcludingCurrent = sortedMarkers.filter(m => {
      const track = markersWithTracks.find(t => t.id === m.id);
      return !track || track.swimlane !== currentSwimlaneIndex;
    });

    if (markersExcludingCurrent.length === 0) {
      // All markers are in current swimlane, wrap to first/last marker
      return direction === 'next'
        ? sortedMarkers[0].id
        : sortedMarkers[sortedMarkers.length - 1].id;
    }

    if (direction === 'next') {
      // Find first marker in a swimlane after the current one
      for (const marker of markersExcludingCurrent) {
        const track = markersWithTracks.find(t => t.id === marker.id);
        if (track && track.swimlane > currentSwimlaneIndex) {
          return marker.id;
        }
      }
      // No marker found after current swimlane, wrap to first marker from excluded list
      return markersExcludingCurrent[0].id;
    } else {
      // Find last marker in a swimlane before the current one (iterate backwards)
      for (let i = markersExcludingCurrent.length - 1; i >= 0; i--) {
        const marker = markersExcludingCurrent[i];
        const track = markersWithTracks.find(t => t.id === marker.id);
        if (track && track.swimlane < currentSwimlaneIndex) {
          return marker.id;
        }
      }
      // No marker found before current swimlane, wrap to last marker from excluded list
      return markersExcludingCurrent[markersExcludingCurrent.length - 1].id;
    }
  }, [findMarkersAtPlayhead, markersWithTracks, selectedMarkerId, markers]);

  // Helper function to cycle through markers at playhead (top-to-bottom)
  const findNextMarkerAtPlayhead = useCallback((currentTime: number): string | null => {
    return findMarkerAtPlayheadInDirection(currentTime, 'next');
  }, [findMarkerAtPlayheadInDirection]);

  // Helper function to cycle through markers at playhead (bottom-to-top)
  const findPreviousMarkerAtPlayhead = useCallback((currentTime: number): string | null => {
    return findMarkerAtPlayheadInDirection(currentTime, 'previous');
  }, [findMarkerAtPlayheadInDirection]);

  return {
    findNextUnprocessedMarker,
    findPreviousUnprocessedGlobal,
    findNextUnprocessedMarkerInSwimlane,
    findPreviousUnprocessedMarkerInSwimlane,
    findNextUnprocessedGlobal,
    findNextUnprocessedSwimlane,
    navigateBetweenSwimlanes,
    navigateWithinSwimlane,
    findMarkersAtPlayhead,
    findNextMarkerAtPlayhead,
    findPreviousMarkerAtPlayhead,
  };
};