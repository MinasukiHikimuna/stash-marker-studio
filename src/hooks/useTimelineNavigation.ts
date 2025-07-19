import { useCallback } from "react";
import { MarkerContextType, MarkerWithTrack } from "../core/marker/types";

import {
  getActionMarkers,
  findNearestMarker,
} from "../core/marker/markerLogic";

export const useTimelineNavigation = (
  { state, dispatch }: MarkerContextType,
  markersWithTracks: MarkerWithTrack[]
) => {
  const navigateWithinSwimlane = useCallback(
    (direction: "left" | "right") => {
      const actionMarkers = getActionMarkers(
        state.markers || [],
        state.filteredSwimlane
      );
      if (!actionMarkers.length || !state.selectedMarkerId) return;

      const currentMarker = actionMarkers.find(
        (m) => m.id === state.selectedMarkerId
      );
      if (!currentMarker) return;

      const currentTrack = markersWithTracks.find(
        (m) => m.id === currentMarker.id
      )?.track;

      if (currentTrack === undefined) return;

      // Find markers in the same swimlane
      const swimlaneMarkers = markersWithTracks.filter(
        (m) => m.track === currentTrack
      );

      // Find the current marker's index in the swimlane
      const currentIndexInSwimlane = swimlaneMarkers.findIndex(
        (m) => m.id === currentMarker.id
      );

      if (currentIndexInSwimlane === -1) return;

      // Calculate the next index
      const nextIndex =
        direction === "left"
          ? currentIndexInSwimlane - 1
          : currentIndexInSwimlane + 1;

      // Check if the next index is valid
      if (nextIndex >= 0 && nextIndex < swimlaneMarkers.length) {
        // Get the next marker
        const nextMarker = swimlaneMarkers[nextIndex];
        dispatch({
          type: "SET_SELECTED_MARKER_ID",
          payload: nextMarker.id,
        });
      }
    },
    [
      state.markers,
      state.selectedMarkerId,
      state.filteredSwimlane,
      markersWithTracks,
      dispatch,
    ]
  );

  const navigateBetweenSwimlanes = useCallback(
    (direction: "up" | "down", maintainTime: boolean = true) => {
      const actionMarkers = getActionMarkers(
        state.markers || [],
        state.filteredSwimlane
      );
      if (!actionMarkers.length || !state.selectedMarkerId) return;

      const currentMarker = actionMarkers.find(
        (m) => m.id === state.selectedMarkerId
      );
      if (!currentMarker) return;

      const currentTrack = markersWithTracks.find(
        (m) => m.id === currentMarker.id
      )?.track;

      if (currentTrack === undefined) return;

      // Get all unique tracks
      const tracks = Array.from(
        new Set(markersWithTracks.map((m) => m.track))
      ).sort((a, b) => a - b);

      // Find current track index
      const currentTrackIndex = tracks.indexOf(currentTrack);
      if (currentTrackIndex === -1) return;

      // Calculate target track
      const targetTrackIndex =
        direction === "up" ? currentTrackIndex - 1 : currentTrackIndex + 1;

      // Check if target track exists
      if (targetTrackIndex >= 0 && targetTrackIndex < tracks.length) {
        const targetTrack = tracks[targetTrackIndex];

        // Find markers in target track
        const targetTrackMarkers = markersWithTracks.filter(
          (m) => m.track === targetTrack
        );

        if (!targetTrackMarkers.length) return;

        let targetMarker: MarkerWithTrack;

        if (maintainTime) {
          // Find nearest marker to current time in target track
          const nearestIndex = findNearestMarker(
            targetTrackMarkers,
            currentMarker.seconds,
            "next"
          );
          targetMarker =
            nearestIndex >= 0
              ? targetTrackMarkers[nearestIndex]
              : targetTrackMarkers[0];
        } else {
          // Just take the first marker in the track
          targetMarker = targetTrackMarkers[0];
        }

        dispatch({
          type: "SET_SELECTED_MARKER_ID",
          payload: targetMarker.id,
        });
      }
    },
    [
      state.markers,
      state.selectedMarkerId,
      state.filteredSwimlane,
      markersWithTracks,
      dispatch,
    ]
  );

  const navigateChronologically = useCallback(
    (direction: "prev" | "next") => {
      const actionMarkers = getActionMarkers(
        state.markers || [],
        state.filteredSwimlane
      );
      if (!actionMarkers.length || !state.selectedMarkerId) return;

      const currentMarker = actionMarkers.find(
        (m) => m.id === state.selectedMarkerId
      );
      if (!currentMarker) return;

      const currentIndex = actionMarkers.indexOf(currentMarker);
      const nextIndex =
        direction === "prev" ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex >= 0 && nextIndex < actionMarkers.length) {
        const nextMarker = actionMarkers[nextIndex];
        dispatch({
          type: "SET_SELECTED_MARKER_ID",
          payload: nextMarker.id,
        });
      }
    },
    [state.markers, state.selectedMarkerId, state.filteredSwimlane, dispatch]
  );

  return {
    navigateWithinSwimlane,
    navigateBetweenSwimlanes,
    navigateChronologically,
  };
};
