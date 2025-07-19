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
      if (!actionMarkers.length || state.selectedMarkerIndex < 0) return;

      const currentMarker = actionMarkers[state.selectedMarkerIndex];
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
        // Find the marker in the main markers array
        const nextMarker = swimlaneMarkers[nextIndex];
        const mainIndex = actionMarkers.findIndex(
          (m) => m.id === nextMarker.id
        );

        if (mainIndex >= 0) {
          dispatch({
            type: "SET_SELECTED_MARKER_INDEX",
            payload: mainIndex,
          });
        }
      }
    },
    [
      state.markers,
      state.selectedMarkerIndex,
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
      if (!actionMarkers.length || state.selectedMarkerIndex < 0) return;

      const currentMarker = actionMarkers[state.selectedMarkerIndex];
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

        // Find the marker in the main markers array
        const mainIndex = actionMarkers.findIndex(
          (m) => m.id === targetMarker.id
        );

        if (mainIndex >= 0) {
          dispatch({
            type: "SET_SELECTED_MARKER_INDEX",
            payload: mainIndex,
          });
        }
      }
    },
    [
      state.markers,
      state.selectedMarkerIndex,
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
      if (!actionMarkers.length || state.selectedMarkerIndex < 0) return;

      const currentIndex = state.selectedMarkerIndex;
      const nextIndex =
        direction === "prev" ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex >= 0 && nextIndex < actionMarkers.length) {
        dispatch({
          type: "SET_SELECTED_MARKER_INDEX",
          payload: nextIndex,
        });
      }
    },
    [state.markers, state.selectedMarkerIndex, state.filteredSwimlane, dispatch]
  );

  return {
    navigateWithinSwimlane,
    navigateBetweenSwimlanes,
    navigateChronologically,
  };
};
