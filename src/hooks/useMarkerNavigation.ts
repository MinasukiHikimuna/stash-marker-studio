import { useCallback } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setSelectedMarkerId } from '../store/slices/markerSlice';
import { isMarkerConfirmed, isMarkerRejected } from '../core/marker/markerLogic';
import { type SceneMarker } from '../services/StashappService';
import { MarkerWithTrack } from '../core/marker/types';

interface UseMarkerNavigationParams {
  actionMarkers: SceneMarker[];
  markersWithTracks: MarkerWithTrack[];
  tagGroups: { name: string; [key: string]: unknown }[];
  selectedMarkerId: string | null;
  getActionMarkers: () => SceneMarker[];
}

export const useMarkerNavigation = (params: UseMarkerNavigationParams) => {
  const dispatch = useAppDispatch();
  const {
    actionMarkers,
    markersWithTracks,
    tagGroups,
    selectedMarkerId,
    getActionMarkers,
  } = params;

  // Helper function to check if a marker is unprocessed
  const isUnprocessed = useCallback((marker: SceneMarker): boolean => {
    // Check if marker has confirmation or rejection status tags
    const isConfirmed = isMarkerConfirmed(marker);
    const isRejected = isMarkerRejected(marker);
    
    return !isConfirmed && !isRejected;
  }, []);

  // Helper function to find next unprocessed marker globally
  const findNextUnprocessedMarker = useCallback((): string | null => {
    const actionMarkers = getActionMarkers();
    const currentMarker = actionMarkers.find(
      (m) => m.id === selectedMarkerId
    );
    const currentIndex = currentMarker
      ? actionMarkers.indexOf(currentMarker)
      : -1;

    // Look for next unprocessed marker starting from current position
    for (let i = currentIndex + 1; i < actionMarkers.length; i++) {
      if (isUnprocessed(actionMarkers[i])) {
        return actionMarkers[i].id;
      }
    }

    // If no unprocessed found after current, search from beginning
    for (let i = 0; i < currentIndex; i++) {
      if (isUnprocessed(actionMarkers[i])) {
        return actionMarkers[i].id;
      }
    }

    return null; // No unprocessed markers found
  }, [getActionMarkers, selectedMarkerId, isUnprocessed]);

  // Helper function to find previous unprocessed marker globally
  const findPreviousUnprocessedMarker = useCallback((): string | null => {
    const actionMarkers = getActionMarkers();
    const currentMarker = actionMarkers.find(
      (m) => m.id === selectedMarkerId
    );
    const currentIndex = currentMarker
      ? actionMarkers.indexOf(currentMarker)
      : -1;

    // Look for previous unprocessed marker starting from current position
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (isUnprocessed(actionMarkers[i])) {
        return actionMarkers[i].id;
      }
    }

    // If no unprocessed found before current, search from end
    for (let i = actionMarkers.length - 1; i > currentIndex; i--) {
      if (isUnprocessed(actionMarkers[i])) {
        return actionMarkers[i].id;
      }
    }

    return null; // No unprocessed markers found
  }, [getActionMarkers, selectedMarkerId, isUnprocessed]);

  // Helper function to find next unprocessed marker in current swimlane
  const findNextUnprocessedMarkerInSwimlane = useCallback((): string | null => {
    if (markersWithTracks.length === 0) {
      // If no swimlane data, stay on current marker
      return selectedMarkerId;
    }

    const currentMarker = actionMarkers.find(
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
      // Find this marker in actionMarkers to check its status
      const actionMarker = actionMarkers.find((m) => m.id === marker.id);
      if (actionMarker && isUnprocessed(actionMarker)) {
        return actionMarker.id;
      }
    }

    // If no later unprocessed markers found in swimlane, stay on current marker
    return selectedMarkerId;
  }, [markersWithTracks, actionMarkers, selectedMarkerId, isUnprocessed]);

  // Helper function to find previous unprocessed marker in current swimlane
  const findPreviousUnprocessedMarkerInSwimlane = useCallback(():
    | string
    | null => {
    if (markersWithTracks.length === 0) {
      // If no swimlane data, stay on current marker
      return selectedMarkerId;
    }

    const currentMarker = actionMarkers.find(
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
      // Find this marker in actionMarkers to check its status
      const actionMarker = actionMarkers.find((m) => m.id === marker.id);
      if (actionMarker && isUnprocessed(actionMarker)) {
        return actionMarker.id;
      }
    }

    // If no unprocessed found before current, search from end of swimlane
    for (let i = swimlaneMarkers.length - 1; i > currentIndex; i--) {
      const marker = swimlaneMarkers[i];
      // Find this marker in actionMarkers to check its status
      const actionMarker = actionMarkers.find((m) => m.id === marker.id);
      if (actionMarker && isUnprocessed(actionMarker)) {
        return actionMarker.id;
      }
    }

    return null; // No unprocessed markers found in swimlane
  }, [markersWithTracks, actionMarkers, selectedMarkerId, isUnprocessed]);

  // Helper function for chronological navigation
  const navigateChronologically = useCallback(
    (direction: "next" | "prev") => {
      if (!actionMarkers.length) return;

      // Find current marker
      const currentMarker = actionMarkers.find(
        (m) => m.id === selectedMarkerId
      );
      if (!currentMarker) {
        // If no marker is selected, select the first one
        if (actionMarkers.length > 0) {
          dispatch(setSelectedMarkerId(actionMarkers[0].id));
        }
        return;
      }

      // Markers are now pre-sorted in Redux, no need to sort again
      const currentIndex = actionMarkers.findIndex(
        (m) => m.id === currentMarker.id
      );

      let newIndex;
      if (direction === "next") {
        newIndex =
          currentIndex < actionMarkers.length - 1
            ? currentIndex + 1
            : currentIndex;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
      }

      // Select the new marker by ID
      const newMarker = actionMarkers[newIndex];
      dispatch(setSelectedMarkerId(newMarker.id));
    },
    [actionMarkers, selectedMarkerId, dispatch]
  );

  // Helper function for swimlane navigation
  const navigateBetweenSwimlanes = useCallback(
    (direction: "up" | "down", useTemporalLocality: boolean = true) => {
      if (markersWithTracks.length === 0 || tagGroups.length === 0) {
        // Fallback to chronological navigation if no swimlane data
        navigateChronologically(direction === "up" ? "prev" : "next");
        return;
      }

      // Find current marker
      const currentMarker = actionMarkers.find(
        (m) => m.id === selectedMarkerId
      );
      if (!currentMarker) {
        // If no marker is selected, select the first one
        if (actionMarkers.length > 0) {
          dispatch(setSelectedMarkerId(actionMarkers[0].id));
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
        // Find the marker closest in time to the current marker
        bestMatch = swimlaneMarkers.reduce((closest, marker) => {
          if (!closest) return marker;
          const currentDiff = Math.abs(marker.seconds - currentMarker.seconds);
          const closestDiff = Math.abs(closest.seconds - currentMarker.seconds);
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
      actionMarkers,
      selectedMarkerId,
      dispatch,
      navigateChronologically,
    ]
  );

  // Helper function for same-swimlane navigation
  const navigateWithinSwimlane = useCallback(
    (direction: "left" | "right") => {
      if (markersWithTracks.length === 0) {
        // Fallback to chronological navigation if no swimlane data
        navigateChronologically(direction === "left" ? "prev" : "next");
        return;
      }

      // Find current marker
      const currentMarker = actionMarkers.find(
        (m) => m.id === selectedMarkerId
      );
      if (!currentMarker) {
        // If no marker is selected, select the first one
        if (actionMarkers.length > 0) {
          dispatch(setSelectedMarkerId(actionMarkers[0].id));
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
      actionMarkers,
      selectedMarkerId,
      dispatch,
      navigateChronologically,
    ]
  );

  return {
    findNextUnprocessedMarker,
    findPreviousUnprocessedMarker,
    findNextUnprocessedMarkerInSwimlane,
    findPreviousUnprocessedMarkerInSwimlane,
    navigateChronologically,
    navigateBetweenSwimlanes,
    navigateWithinSwimlane,
  };
};