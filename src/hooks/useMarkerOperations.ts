import { useCallback } from "react";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import {
  stashappService,
  type Tag,
  type SceneMarker,
} from "../services/StashappService";
import {
  selectMarkers,
  selectScene,
  selectAvailableTags,
  selectSelectedMarkerId,
  selectCurrentVideoTime,
  selectRejectedMarkers,
  selectConfirmedAIMarkers,
  selectCopiedMarkerTimes,
  setRejectedMarkers,
  setDeletingRejected,
  setConfirmedAIMarkers,
  setAIConversionModalOpen,
  setCopiedMarkerTimes,
  setError,
  clearError,
  loadMarkers,
  createMarker,
  splitMarker,
  updateMarkerTimes,
  pauseVideo,
  seekToTime,
} from "../store/slices/markerSlice";
import {
  formatSeconds,
  isMarkerConfirmed,
  isMarkerRejected,
  isShotBoundaryMarker,
  filterUnprocessedMarkers,
  calculateMarkerSummary,
} from "../core/marker/markerLogic";

type ToastFunction = (message: string, type: "success" | "error") => void;

export const useMarkerOperations = (
  actionMarkers: SceneMarker[],
  getShotBoundaries: () => SceneMarker[],
  showToast: ToastFunction
) => {
  const dispatch = useAppDispatch();
  
  // Redux selectors
  const markers = useAppSelector(selectMarkers);
  const scene = useAppSelector(selectScene);
  const availableTags = useAppSelector(selectAvailableTags);
  const selectedMarkerId = useAppSelector(selectSelectedMarkerId);
  const currentVideoTime = useAppSelector(selectCurrentVideoTime);
  const rejectedMarkers = useAppSelector(selectRejectedMarkers);
  const confirmedAIMarkers = useAppSelector(selectConfirmedAIMarkers);
  const copiedMarkerTimes = useAppSelector(selectCopiedMarkerTimes);

  // Get action markers helper
  const getActionMarkers = useCallback(() => {
    return actionMarkers;
  }, [actionMarkers]);

  // Calculate marker summary
  const getMarkerSummary = useCallback(() => {
    const actionMarkers = getActionMarkers();
    if (!actionMarkers.length) return { confirmed: 0, rejected: 0, unknown: 0 };

    return calculateMarkerSummary(actionMarkers);
  }, [getActionMarkers]);

  // Split current marker at playhead position
  const splitCurrentMarker = useCallback(async () => {
    const actionMarkers = getActionMarkers();
    if (!actionMarkers || !selectedMarkerId || !scene) {
      console.log("Cannot split marker:", {
        hasActionMarkers: !!actionMarkers,
        selectedMarkerId: selectedMarkerId,
        hasScene: !!scene,
      });
      return;
    }

    const currentMarker = actionMarkers.find(
      (m) => m.id === selectedMarkerId
    );
    if (!currentMarker) {
      console.log("Cannot split marker: No current marker found");
      return;
    }

    const currentTime = currentVideoTime;

    console.log("Attempting to split marker:", {
      markerId: currentMarker.id,
      markerStart: currentMarker.seconds,
      markerEnd: currentMarker.end_seconds,
      splitTime: currentTime,
    });

    // Check if the current time is within the marker's range
    if (
      currentTime <= currentMarker.seconds ||
      (currentMarker.end_seconds && currentTime >= currentMarker.end_seconds)
    ) {
      console.log("Split failed: Current time not within marker range");
      dispatch(setError("Current time must be within the marker's range to split it"));
      return;
    }

    try {
      // Use Redux splitMarker thunk
      const originalTagIds = currentMarker.tags.map((tag) => tag.id);
      const result = await dispatch(splitMarker({
        sceneId: scene.id,
        sourceMarkerId: currentMarker.id,
        splitTime: currentTime,
        tagId: currentMarker.primary_tag.id,
        originalTagIds: originalTagIds,
        sourceStartTime: currentMarker.seconds,
        sourceEndTime: currentMarker.end_seconds || null,
      })).unwrap();

      console.log("Split marker completed:", result);

      // After split, pause video and seek to split time
      dispatch(pauseVideo());
      dispatch(seekToTime(currentTime));
      
      // Keep the original marker selected (it now ends at the split time)
      // dispatch(setSelectedMarkerId(currentMarker.id));
    } catch (err) {
      console.error("Error splitting marker:", err);
      dispatch(setError(`Failed to split marker: ${err}`));
    }
  }, [
    getActionMarkers,
    selectedMarkerId,
    scene,
    currentVideoTime,
    dispatch,
  ]);

  // Split a Video Cut marker at the current playhead position
  const splitVideoCutMarker = useCallback(async () => {
    const currentTime = currentVideoTime;
    const allMarkers = markers || [];

    // Find the Video Cut marker that contains the current time
    const videoCutMarker = allMarkers.find(
      (marker) =>
        isShotBoundaryMarker(marker) &&
        marker.seconds <= currentTime &&
        marker.end_seconds &&
        marker.end_seconds > currentTime
    );

    if (!videoCutMarker || !videoCutMarker.end_seconds || !scene) {
      console.log("Cannot split Video Cut marker:", {
        hasMarker: !!videoCutMarker,
        hasEndTime: !!videoCutMarker?.end_seconds,
        hasScene: !!scene,
      });
      dispatch(setError("No Video Cut marker found at current position"));
      return;
    }

    try {
      // Use Redux splitMarker thunk
      const originalTagIds = videoCutMarker.tags.map((tag) => tag.id);
      const result = await dispatch(splitMarker({
        sceneId: scene.id,
        sourceMarkerId: videoCutMarker.id,
        splitTime: currentTime,
        tagId: videoCutMarker.primary_tag.id,
        originalTagIds: originalTagIds,
        sourceStartTime: videoCutMarker.seconds,
        sourceEndTime: videoCutMarker.end_seconds || null,
      })).unwrap();

      console.log("Split Video Cut marker completed:", result);

      // Show success message
      showToast("Video Cut marker split successfully", "success");
    } catch (err) {
      console.error("Error splitting Video Cut marker:", err);
      dispatch(setError("Failed to split Video Cut marker"));
    }
  }, [markers, currentVideoTime, scene, dispatch, showToast]);

  // Create or duplicate marker
  const createOrDuplicateMarker = useCallback(
    (sourceMarker?: SceneMarker) => {
      console.log("createOrDuplicateMarker called with state:", {
        hasScene: !!scene,
        availableTagsCount: availableTags?.length || 0,
        isDuplicate: !!sourceMarker,
        currentTime: currentVideoTime,
      });

      if (!scene || !availableTags?.length) {
        if (!scene) {
          console.log("Failed to create marker: No scene data");
          dispatch(setError("No scene data available"));
        }
        if (!availableTags?.length) {
          console.log("Failed to create marker: No available tags");
          dispatch(setError("No tags available. Please wait for tags to load or check if tags exist in Stash."));
        }
        return;
      }

      const isDuplicate = !!sourceMarker;
      const currentTime = currentVideoTime;

      // Determine time values
      const startTime = isDuplicate ? sourceMarker.seconds : currentTime;
      const endTime = isDuplicate ? (sourceMarker.end_seconds ?? null) : currentTime + 20; // Standard 20-second duration for new markers

      // Determine tag ID
      const tagId = isDuplicate
        ? sourceMarker.primary_tag.id
        : availableTags[0].id; // Default to first available tag

      console.log("Creating marker with:", {
        startTime,
        endTime,
        tagId,
        isDuplicate,
      });

      // Dispatch the createMarker thunk
      return dispatch(createMarker({
        sceneId: scene.id,
        startTime,
        endTime,
        tagId,
      }));
    },
    [scene, availableTags, currentVideoTime, dispatch]
  );

  // Handle create marker
  const handleCreateMarker = useCallback(() => {
    createOrDuplicateMarker();
  }, [createOrDuplicateMarker]);

  // Handle delete rejected markers
  const handleDeleteRejectedMarkers = useCallback(async () => {
    const actionMarkers = getActionMarkers();
    if (!actionMarkers) return;

    const rejected = actionMarkers.filter(isMarkerRejected);
    dispatch(setRejectedMarkers(rejected));
    dispatch(setDeletingRejected(true));
  }, [getActionMarkers, dispatch]);

  // Copy marker times function
  const copyMarkerTimes = useCallback(() => {
    const actionMarkers = getActionMarkers();
    if (!actionMarkers || !selectedMarkerId) return;

    const currentMarker = actionMarkers.find(
      (m) => m.id === selectedMarkerId
    );
    if (!currentMarker) return;

    const copiedTimes = {
      start: currentMarker.seconds,
      end: currentMarker.end_seconds,
    };

    dispatch(setCopiedMarkerTimes(copiedTimes));

    // Show toast notification
    const endTimeStr = copiedTimes.end
      ? formatSeconds(copiedTimes.end, true)
      : "N/A";

    showToast(
      `Copied times: ${formatSeconds(copiedTimes.start, true)} - ${endTimeStr}`,
      "success"
    );
  }, [getActionMarkers, selectedMarkerId, dispatch, showToast]);

  // Paste marker times function
  const pasteMarkerTimes = useCallback(async () => {
    if (!copiedMarkerTimes) {
      showToast("No marker times copied yet", "error");
      return;
    }

    const actionMarkers = getActionMarkers();
    if (!actionMarkers) {
      return;
    }

    const currentMarker = actionMarkers.find(
      (m) => m.id === selectedMarkerId
    );
    if (!currentMarker || !scene) {
      console.log("Cannot paste marker times: No current marker or scene found");
      return;
    }

    try {
      await dispatch(updateMarkerTimes({
        sceneId: scene.id,
        markerId: currentMarker.id,
        startTime: copiedMarkerTimes.start,
        endTime: copiedMarkerTimes.end ?? null
      })).unwrap();

      // Show toast notification
      const endTimeStr = copiedMarkerTimes.end
        ? formatSeconds(copiedMarkerTimes.end, true)
        : "N/A";

      showToast(
        `Pasted times: ${formatSeconds(
          copiedMarkerTimes.start,
          true
        )} - ${endTimeStr}`,
        "success"
      );
    } catch (err) {
      console.error("Error pasting marker times:", err);
      showToast("Failed to paste marker times", "error");
    }
  }, [
    copiedMarkerTimes,
    getActionMarkers,
    selectedMarkerId,
    showToast,
    dispatch,
    scene,
  ]);

  // Confirm delete rejected markers
  const confirmDeleteRejectedMarkers = useCallback(async () => {
    try {
      await stashappService.deleteMarkers(
        rejectedMarkers.map((m) => m.id)
      );
      if (scene?.id) await dispatch(loadMarkers(scene.id)).unwrap();
      dispatch(setDeletingRejected(false));
      dispatch(setRejectedMarkers([]));
    } catch (err) {
      console.error("Error deleting rejected markers:", err);
      dispatch(setError("Failed to delete rejected markers"));
    }
  }, [rejectedMarkers, dispatch, scene?.id]);

  // Handle AI conversion
  const handleAIConversion = useCallback(async () => {
    const actionMarkers = getActionMarkers();
    if (!actionMarkers) return;

    try {
      const markers = await stashappService.convertConfirmedAIMarkers(
        actionMarkers
      );
      dispatch(setConfirmedAIMarkers(markers));
      dispatch(setAIConversionModalOpen(true));
    } catch (err) {
      console.error("Error preparing AI conversion:", err);
      dispatch(setError("Failed to prepare AI markers for conversion"));
    }
  }, [getActionMarkers, dispatch]);

  // Handle confirm AI conversion
  const handleConfirmAIConversion = useCallback(async () => {
    try {
      for (const { aiMarker, correspondingTag } of confirmedAIMarkers) {
        await stashappService.updateMarkerTagAndTitle(
          aiMarker.id,
          correspondingTag.id
        );
      }
      if (scene?.id) await dispatch(loadMarkers(scene.id)).unwrap();
    } catch (err) {
      console.error("Error converting AI markers:", err);
      throw err; // Let the modal handle the error display
    }
  }, [confirmedAIMarkers, dispatch, scene?.id]);

  // Check if all markers are approved (confirmed, rejected, or manual)
  const checkAllMarkersApproved = useCallback(() => {
    const actionMarkers = getActionMarkers();
    if (!actionMarkers || actionMarkers.length === 0) return true;

    return filterUnprocessedMarkers(actionMarkers).length === 0;
  }, [getActionMarkers]);

  // Helper function to identify AI tags that should be removed from the scene
  const identifyAITagsToRemove = useCallback(
    async (confirmedMarkers: SceneMarker[]): Promise<Tag[]> => {
      try {
        // Get current scene tags
        const currentSceneTags = await stashappService.getSceneTags(
          confirmedMarkers[0].scene.id
        );

        console.log("=== AI Tag Removal Debug ===");
        console.log(
          "Current scene tags:",
          currentSceneTags.map((t) => ({ id: t.id, name: t.name }))
        );

        // Get all tags to find the AI parent tag and its children
        const allTags = await stashappService.getAllTags();

        // Find the "AI" parent tag
        const aiParentTag = allTags.findTags.tags.find(
          (tag) => tag.name === "AI"
        );
        console.log(
          "AI parent tag found:",
          aiParentTag
            ? `${aiParentTag.name} (ID: ${aiParentTag.id})`
            : "Not found"
        );

        if (!aiParentTag) {
          console.log("No AI parent tag found, cannot remove AI child tags");
          return [];
        }

        // Get the AI tag's children directly
        const aiChildTags = aiParentTag.children || [];

        console.log(
          "All AI child tags found:",
          aiChildTags.map((t) => t.name)
        );

        // Find which AI child tags are currently on the scene
        const aiChildTagsOnScene = currentSceneTags.filter((sceneTag) =>
          aiChildTags.some((aiChild) => aiChild.id === sceneTag.id)
        );

        console.log(
          "AI child tags on scene to remove:",
          aiChildTagsOnScene.map((t) => t.name)
        );
        console.log("=== End AI Tag Removal Debug ===");

        return aiChildTagsOnScene;
      } catch (error) {
        console.error("Error identifying AI tags to remove:", error);
        // Return empty array if there's an error - don't block the completion process
        return [];
      }
    },
    []
  );

  // Execute the completion process
  const executeCompletion = useCallback(async (
    videoCutMarkersToDelete: SceneMarker[]
  ) => {
    const actionMarkers = getActionMarkers();
    if (!actionMarkers || actionMarkers.length === 0) return;

    try {
      // Loading state is managed by async thunks

      // Step 1: Delete Video Cut markers
      if (videoCutMarkersToDelete.length > 0) {
        console.log("=== Deleting Video Cut Markers ===");
        console.log(
          `Deleting ${videoCutMarkersToDelete.length} Video Cut markers`
        );
        const videoCutMarkerIds = videoCutMarkersToDelete.map(
          (marker) => marker.id
        );
        await stashappService.deleteMarkers(videoCutMarkerIds);
        console.log("Video Cut markers deleted successfully");
        console.log("=== End Video Cut Marker Deletion ===");
      }

      // Step 2: Generate markers for action markers
      const actionMarkerIds = actionMarkers.map((marker) => marker.id);
      await stashappService.generateMarkers(actionMarkerIds);

      // Step 3: Mark scene as reviewed
      if (!scene) {
        throw new Error("Scene data not found");
      }

      // Get all confirmed markers and their primary tags
      const confirmedMarkers = actionMarkers.filter((marker) =>
        isMarkerConfirmed(marker)
      );

      const primaryTags = confirmedMarkers.map((marker) => ({
        id: marker.primary_tag.id,
        name: marker.primary_tag.name,
      }));

      // Create AI_Reviewed tag object
      const aiReviewedTag = {
        id: stashappService.MARKER_AI_REVIEWED,
        name: "AI_Reviewed",
      };

      // Combine all tags to add (AI_Reviewed + primary tags from confirmed markers)
      const tagsToAdd = [aiReviewedTag, ...primaryTags];

      // Step 4: Remove AI tags from scene
      const tagsToRemove: Tag[] = await identifyAITagsToRemove(
        confirmedMarkers
      );

      // Update the scene with new tags
      await stashappService.updateScene(scene, tagsToAdd, tagsToRemove);

      // Step 5: Refresh markers to show generated content
      setTimeout(() => {
        if (scene?.id) dispatch(loadMarkers(scene.id));
      }, 2000); // Give generation time to complete

      // Clear any existing errors on success
      dispatch(clearError());
    } catch (err) {
      console.error("Error completing scene:", err);
      dispatch(setError("Failed to complete scene processing"));
    }
  }, [
    getActionMarkers,
    scene,
    identifyAITagsToRemove,
    dispatch,
  ]);

  return {
    // Data
    getActionMarkers,
    getMarkerSummary,
    checkAllMarkersApproved,
    
    // Marker operations
    splitCurrentMarker,
    splitVideoCutMarker,
    createOrDuplicateMarker,
    handleCreateMarker,
    
    // Copy/paste operations
    copyMarkerTimes,
    pasteMarkerTimes,
    
    // Delete operations
    handleDeleteRejectedMarkers,
    confirmDeleteRejectedMarkers,
    
    // AI operations
    handleAIConversion,
    handleConfirmAIConversion,
    
    // Completion operations
    identifyAITagsToRemove,
    executeCompletion,
  };
};