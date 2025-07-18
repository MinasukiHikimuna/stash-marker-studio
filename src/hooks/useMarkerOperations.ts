import { useCallback } from "react";
import { SceneMarker } from "../services/StashappService";
import { stashappService } from "../services/StashappService";
import { MarkerContextType } from "../core/marker/types";
import { getActionMarkers, isMarkerRejected } from "../core/marker/markerLogic";

export const useMarkerOperations = ({ state, dispatch }: MarkerContextType) => {
  const refreshMarkersOnly = useCallback(async () => {
    if (!state.scene?.id) return;

    try {
      const result = await stashappService.getSceneMarkers(state.scene.id);
      dispatch({
        type: "SET_MARKERS",
        payload: result.findSceneMarkers.scene_markers || [],
      });
    } catch (err) {
      console.error("Error refreshing markers:", err);
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to refresh markers",
      });
    }
  }, [state.scene?.id, dispatch]);

  const updateMarkerTimes = useCallback(
    async (id: string, newStartTime: number, newEndTime: number | null) => {
      try {
        await stashappService.updateMarkerTimes(id, newStartTime, newEndTime);
        await refreshMarkersOnly();
        dispatch({ type: "SET_EDITING_MARKER", payload: false });
      } catch (err) {
        console.error("Error updating marker times:", err);
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to update marker times",
        });
      }
    },
    [refreshMarkersOnly, dispatch]
  );

  const deleteRejectedMarkers = useCallback(async () => {
    const actionMarkers = getActionMarkers(
      state.markers || [],
      state.filteredSwimlane
    );
    const rejectedMarkers = actionMarkers.filter(isMarkerRejected);

    if (rejectedMarkers.length === 0) return;

    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const markerIds = rejectedMarkers.map((marker) => marker.id);
      await stashappService.deleteMarkers(markerIds);
      await refreshMarkersOnly();
      dispatch({ type: "SET_SELECTED_MARKER_INDEX", payload: -1 });
    } catch (err) {
      console.error("Error deleting rejected markers:", err);
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to delete rejected markers",
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.markers, state.filteredSwimlane, dispatch, refreshMarkersOnly]);

  const createMarker = useCallback(
    async (startTime: number, endTime: number | null, tagId: string) => {
      if (!state.scene?.id) return;

      try {
        await stashappService.createSceneMarker(
          state.scene.id,
          tagId,
          startTime,
          endTime
        );
        await refreshMarkersOnly();
      } catch (err) {
        console.error("Error creating marker:", err);
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to create marker",
        });
      }
    },
    [state.scene?.id, refreshMarkersOnly, dispatch]
  );

  const splitMarker = useCallback(async () => {
    const actionMarkers = getActionMarkers(
      state.markers || [],
      state.filteredSwimlane
    );
    if (!state.videoElement || state.selectedMarkerIndex < 0) return;

    try {
      const currentMarker = actionMarkers[state.selectedMarkerIndex];
      if (!currentMarker || !currentMarker.end_seconds) return;

      const currentTime = state.videoElement.currentTime;
      if (
        currentTime <= currentMarker.seconds ||
        currentTime >= currentMarker.end_seconds
      ) {
        return;
      }

      // Create two new markers from the split
      await stashappService.createSceneMarker(
        currentMarker.scene.id,
        currentMarker.primary_tag.id,
        currentMarker.seconds,
        currentTime
      );
      await stashappService.createSceneMarker(
        currentMarker.scene.id,
        currentMarker.primary_tag.id,
        currentTime,
        currentMarker.end_seconds
      );

      // Delete the original marker
      await stashappService.deleteMarkers([currentMarker.id]);
      await refreshMarkersOnly();

      // Find and select the first part of the split marker
      const updatedMarkers = getActionMarkers(
        state.markers || [],
        state.filteredSwimlane
      );
      const firstPartIndex = updatedMarkers.findIndex(
        (m) => m.seconds === currentMarker.seconds
      );

      if (firstPartIndex >= 0) {
        dispatch({
          type: "SET_SELECTED_MARKER_INDEX",
          payload: firstPartIndex,
        });
        if (state.videoElement) {
          state.videoElement.pause();
          state.videoElement.currentTime = currentTime;
        }
      }
    } catch (err) {
      console.error("Error splitting marker:", err);
      dispatch({ type: "SET_ERROR", payload: "Failed to split marker" });
    }
  }, [
    state.markers,
    state.selectedMarkerIndex,
    state.videoElement,
    state.filteredSwimlane,
    dispatch,
    refreshMarkersOnly,
  ]);

  const confirmMarker = useCallback(
    async (markerId: string) => {
      if (!state.scene?.id) return;

      try {
        await stashappService.confirmMarker(markerId, state.scene.id);
        await refreshMarkersOnly();
      } catch (err) {
        console.error("Error confirming marker:", err);
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to confirm marker",
        });
      }
    },
    [state.scene?.id, refreshMarkersOnly, dispatch]
  );

  const rejectMarker = useCallback(
    async (markerId: string) => {
      if (!state.scene?.id) return;

      try {
        await stashappService.rejectMarker(markerId, state.scene.id);
        await refreshMarkersOnly();
      } catch (err) {
        console.error("Error rejecting marker:", err);
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to reject marker",
        });
      }
    },
    [state.scene?.id, refreshMarkersOnly, dispatch]
  );

  return {
    refreshMarkersOnly,
    updateMarkerTimes,
    deleteRejectedMarkers,
    createMarker,
    splitMarker,
    confirmMarker,
    rejectMarker,
  };
};
