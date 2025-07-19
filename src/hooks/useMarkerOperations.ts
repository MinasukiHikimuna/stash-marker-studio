import { useCallback } from "react";
import { MarkerContextType, MarkerWithTrack } from "../core/marker/types";
import { stashappService, type SceneMarker } from "../services/StashappService";
import {
  getActionMarkers,
  isUnprocessed,
  isMarkerRejected,
} from "../core/marker/markerLogic";
import { isShotBoundaryMarker } from "../core/marker/markerLogic";

export const useMarkerOperations = ({ state, dispatch }: MarkerContextType) => {
  const refreshMarkersOnly = useCallback(async () => {
    if (!state.scene?.id) return;

    try {
      console.log("Refreshing markers...");
      const result = await stashappService.getSceneMarkers(state.scene.id);
      const markers = result.findSceneMarkers.scene_markers || [];
      console.log("Got refreshed markers:", {
        count: markers.length,
        firstFew: markers.slice(0, 3).map((m) => ({
          id: m.id,
          tagId: m.primary_tag.id,
          tagName: m.primary_tag.name,
        })),
      });
      dispatch({
        type: "SET_MARKERS",
        payload: markers,
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
    async (markerId: string, startTime: number, endTime: number | null) => {
      if (!state.scene?.id) return;

      try {
        await stashappService.updateMarkerTimes(markerId, startTime, endTime);
        await refreshMarkersOnly();
      } catch (err) {
        console.error("Error updating marker times:", err);
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to update marker times",
        });
      }
    },
    [state.scene?.id, refreshMarkersOnly, dispatch]
  );

  const updateMarkerTag = useCallback(
    async (markerId: string, tagId: string) => {
      if (!state.scene?.id) return;

      try {
        console.log("Calling updateMarkerTagAndTitle:", {
          markerId,
          tagId,
        });
        const updatedMarker = await stashappService.updateMarkerTagAndTitle(
          markerId,
          tagId
        );
        console.log("Got updated marker:", {
          id: updatedMarker.id,
          tagId: updatedMarker.primary_tag.id,
          tagName: updatedMarker.primary_tag.name,
        });
        await refreshMarkersOnly();
      } catch (err) {
        console.error("Error updating marker tag:", err);
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to update marker tag",
        });
      }
    },
    [state.scene?.id, refreshMarkersOnly, dispatch]
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
      dispatch({ type: "SET_SELECTED_MARKER_ID", payload: null });
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

  const confirmMarker = useCallback(
    async (markerId: string) => {
      if (!state.scene?.id) return;

      try {
        await stashappService.confirmMarker(markerId, state.scene.id);
        await refreshMarkersOnly();

        // Find the current marker's index
        const actionMarkers = getActionMarkers(
          state.markers || [],
          state.filteredSwimlane
        );
        const currentMarkerIndex = actionMarkers.findIndex(
          (m: SceneMarker) => m.id === markerId
        );

        if (currentMarkerIndex >= 0) {
          // Find the next unprocessed marker after current position
          let nextUnprocessedMarker = null;
          for (let i = currentMarkerIndex + 1; i < actionMarkers.length; i++) {
            if (isUnprocessed(actionMarkers[i])) {
              nextUnprocessedMarker = actionMarkers[i];
              break;
            }
          }

          // If not found after current position, look from beginning
          if (!nextUnprocessedMarker) {
            for (let i = 0; i < currentMarkerIndex; i++) {
              if (isUnprocessed(actionMarkers[i])) {
                nextUnprocessedMarker = actionMarkers[i];
                break;
              }
            }
          }

          // If found an unprocessed marker, select it
          if (nextUnprocessedMarker) {
            dispatch({
              type: "SET_SELECTED_MARKER_ID",
              payload: nextUnprocessedMarker.id,
            });
          }
        }
      } catch (err) {
        console.error("Error confirming marker:", err);
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to confirm marker",
        });
      }
    },
    [
      state.scene?.id,
      state.markers,
      state.filteredSwimlane,
      dispatch,
      refreshMarkersOnly,
    ]
  );

  const rejectMarker = useCallback(
    async (markerId: string) => {
      if (!state.scene?.id) return;

      try {
        console.log("Rejecting marker:", markerId);
        await stashappService.rejectMarker(markerId, state.scene.id);
        await refreshMarkersOnly();

        // Find the current marker's index
        const actionMarkers = getActionMarkers(
          state.markers || [],
          state.filteredSwimlane
        );
        console.log("Action markers after refresh:", {
          count: actionMarkers.length,
          firstFew: actionMarkers.slice(0, 3).map((m) => ({
            id: m.id,
            tagId: m.primary_tag.id,
            tagName: m.primary_tag.name,
          })),
        });
        const currentMarkerIndex = actionMarkers.findIndex(
          (m: SceneMarker) => m.id === markerId
        );
        console.log("Found rejected marker at index:", currentMarkerIndex);

        if (currentMarkerIndex >= 0) {
          // Find the next unprocessed marker after current position
          let nextUnprocessedMarker = null;
          console.log(
            "Looking for next unprocessed marker after index:",
            currentMarkerIndex
          );
          for (let i = currentMarkerIndex + 1; i < actionMarkers.length; i++) {
            if (
              isUnprocessed(actionMarkers[i]) &&
              actionMarkers[i].primary_tag.id !==
                stashappService.MARKER_SHOT_BOUNDARY
            ) {
              nextUnprocessedMarker = actionMarkers[i];
              console.log("Found next unprocessed marker:", {
                id: nextUnprocessedMarker.id,
                index: i,
                tagName: nextUnprocessedMarker.primary_tag.name,
              });
              break;
            }
          }

          // If not found after current position, look from beginning
          if (!nextUnprocessedMarker) {
            console.log(
              "No unprocessed marker found after current position, searching from start"
            );
            for (let i = 0; i < currentMarkerIndex; i++) {
              if (
                isUnprocessed(actionMarkers[i]) &&
                actionMarkers[i].primary_tag.id !==
                  stashappService.MARKER_SHOT_BOUNDARY
              ) {
                nextUnprocessedMarker = actionMarkers[i];
                console.log("Found next unprocessed marker from start:", {
                  id: nextUnprocessedMarker.id,
                  index: i,
                  tagName: nextUnprocessedMarker.primary_tag.name,
                });
                break;
              }
            }
          }

          // If found an unprocessed marker, select it
          if (nextUnprocessedMarker) {
            console.log(
              "Selecting next unprocessed marker:",
              nextUnprocessedMarker.id
            );
            dispatch({
              type: "SET_SELECTED_MARKER_ID",
              payload: nextUnprocessedMarker.id,
            });
          }
        }
      } catch (err) {
        console.error("Error rejecting marker:", err);
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to reject marker",
        });
      }
    },
    [
      state.scene?.id,
      state.markers,
      state.filteredSwimlane,
      dispatch,
      refreshMarkersOnly,
    ]
  );

  return {
    refreshMarkersOnly,
    updateMarkerTimes,
    updateMarkerTag,
    deleteRejectedMarkers,
    createMarker,
    confirmMarker,
    rejectMarker,
  };
};
