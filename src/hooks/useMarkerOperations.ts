import { useCallback } from "react";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import {
  stashappService,
  type Tag,
  type SceneMarker,
} from "../services/StashappService";
import type { ShotBoundary } from "../core/shotBoundary/types";
import {
  selectMarkers,
  selectScene,
  selectAvailableTags,
  selectSelectedMarkerId,
  selectCurrentVideoTime,
  selectCopiedMarkerTimes,
  selectDeleteRejectedModalData,
  selectCorrespondingTagConversionModalData,
  openDeleteRejectedModal,
  openCorrespondingTagConversionModal,
  closeModal,
  setCopiedMarkerTimes,
  setError,
  clearError,
  loadMarkers,
  createMarker,
  splitMarker,
  updateMarkerTimes,
  deleteRejectedMarkers,
  pauseVideo,
  seekToTime,
  setSelectedMarkerId,
} from "../store/slices/markerSlice";
import { selectMarkerAiReviewed } from "../store/slices/configSlice";
import {
  formatSeconds,
  isMarkerConfirmed,
  isMarkerRejected,
  filterUnprocessedMarkers,
  calculateMarkerSummary,
} from "../core/marker/markerLogic";

type ToastFunction = (message: string, type: "success" | "error") => void;

export const useMarkerOperations = (
  getShotBoundaries: () => ShotBoundary[],
  showToast: ToastFunction
) => {
  const dispatch = useAppDispatch();

  // Redux selectors
  const markerAiReviewed = useAppSelector(selectMarkerAiReviewed);
  const markers = useAppSelector(selectMarkers);
  const scene = useAppSelector(selectScene);
  const availableTags = useAppSelector(selectAvailableTags);
  const selectedMarkerId = useAppSelector(selectSelectedMarkerId);
  const currentVideoTime = useAppSelector(selectCurrentVideoTime);
  const deleteRejectedModalData = useAppSelector(selectDeleteRejectedModalData);
  const correspondingTagConversionModalData = useAppSelector(selectCorrespondingTagConversionModalData);
  const copiedMarkerTimes = useAppSelector(selectCopiedMarkerTimes);

  // Calculate marker summary
  const getMarkerSummary = useCallback(() => {
    if (!markers || markers.length === 0) return { confirmed: 0, rejected: 0, unknown: 0 };

    return calculateMarkerSummary(markers);
  }, [markers]);

  // Split current marker at playhead position
  const splitCurrentMarker = useCallback(async () => {
    if (!markers || !selectedMarkerId || !scene) {
      console.log("Cannot split marker:", {
        hasMarkers: !!markers,
        selectedMarkerId: selectedMarkerId,
        hasScene: !!scene,
      });
      return;
    }

    const currentMarker = markers.find(
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

    // Check if marker has an end time (required for splitting)
    if (!currentMarker.end_seconds) {
      console.log("Split failed: Marker has no end time (no duration)");
      dispatch(setError("Cannot split a marker without an end time"));
      return;
    }

    // Check if the current time is within the marker's range
    if (
      currentTime <= currentMarker.seconds ||
      currentTime >= currentMarker.end_seconds
    ) {
      console.log("Split failed: Current time not within marker range");
      dispatch(setError("Current time must be within the marker's range to split it"));
      return;
    }

    try {
      // Use Redux splitMarker thunk
      const originalTagIds = currentMarker.tags.map((tag) => tag.id);

      // Transform slots from SceneMarker format to API format
      // IMPORTANT: Use stashappPerformerId (database field), NOT performer?.id (may be undefined)
      const originalSlots = currentMarker.slots?.map((slot) => ({
        slotDefinitionId: slot.slotDefinitionId,
        performerId: slot.stashappPerformerId !== null
          ? slot.stashappPerformerId.toString()
          : null,
      }));

      const result = await dispatch(splitMarker({
        sceneId: scene.id,
        sourceMarkerId: currentMarker.id,
        splitTime: currentTime,
        tagId: currentMarker.primary_tag.id,
        originalTagIds: originalTagIds,
        originalSlots: originalSlots,
        sourceStartTime: currentMarker.seconds,
        sourceEndTime: currentMarker.end_seconds || null,
      })).unwrap();

      console.log("Split marker completed:", result);

      // After split, pause video and seek to split time
      dispatch(pauseVideo());
      dispatch(seekToTime(currentTime));
      
      // Keep the original marker selected (it now ends at the split time)
      dispatch(setSelectedMarkerId(currentMarker.id));
    } catch (err) {
      console.error("Error splitting marker:", err);
      dispatch(setError(`Failed to split marker: ${err}`));
    }
  }, [
    markers,
    selectedMarkerId,
    scene,
    currentVideoTime,
    dispatch,
  ]);

  // Create or duplicate marker - now just calls the marker page's createOrDuplicateMarker
  const createOrDuplicateMarker = useCallback(
    (startTime: number, endTime: number | null, sourceMarker?: SceneMarker) => {
      console.log("useMarkerOperations.createOrDuplicateMarker - delegating to marker page function");
      // This will be replaced by direct calls to the marker page's createOrDuplicateMarker
      // For now, keep the old logic as fallback
      if (!scene || !availableTags?.length) {
        console.log("Failed to create marker: missing scene or tags");
        return;
      }

      const isDuplicate = !!sourceMarker;
      const tagId = isDuplicate
        ? sourceMarker.primary_tag.id
        : availableTags[0].id;

      return dispatch(createMarker({
        sceneId: scene.id,
        startTime,
        endTime,
        tagId,
      }));
    },
    [scene, availableTags, dispatch]
  );

  // Handle create marker
  const handleCreateMarker = useCallback(() => {
    const startTime = currentVideoTime;
    const endTime = currentVideoTime + 20; // Standard 20-second duration
    createOrDuplicateMarker(startTime, endTime);
  }, [createOrDuplicateMarker, currentVideoTime]);

  // Handle delete rejected markers
  const handleDeleteRejectedMarkers = useCallback(async () => {
    if (!markers) return;

    const rejected = markers.filter(isMarkerRejected);
    dispatch(openDeleteRejectedModal({ rejectedMarkers: rejected }));
  }, [markers, dispatch]);

  // Copy marker times function
  const copyMarkerTimes = useCallback(() => {
    if (!markers || !selectedMarkerId) return;

    const currentMarker = markers.find(
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
  }, [markers, selectedMarkerId, dispatch, showToast]);

  // Paste marker times function
  const pasteMarkerTimes = useCallback(async () => {
    if (!copiedMarkerTimes) {
      showToast("No marker times copied yet", "error");
      return;
    }

    if (!markers) {
      return;
    }

    const currentMarker = markers.find(
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
    markers,
    selectedMarkerId,
    showToast,
    dispatch,
    scene,
  ]);

  // Confirm delete rejected markers
  const confirmDeleteRejectedMarkers = useCallback(async () => {
    try {
      const rejectedMarkers = deleteRejectedModalData?.rejectedMarkers || [];
      const rejectedMarkerIds = rejectedMarkers.map((m) => m.id);

      if (scene?.id && rejectedMarkerIds.length > 0) {
        await dispatch(
          deleteRejectedMarkers({
            sceneId: scene.id,
            rejectedMarkerIds,
          })
        ).unwrap();
      }

      dispatch(closeModal());
    } catch (err) {
      console.error("Error deleting rejected markers:", err);
      dispatch(setError("Failed to delete rejected markers"));
    }
  }, [deleteRejectedModalData, dispatch, scene?.id]);

  // Handle corresponding tag conversion
  const handleCorrespondingTagConversion = useCallback(async () => {
    if (!markers) return;

    try {
      const convertibleMarkers = await stashappService.convertConfirmedMarkersWithCorrespondingTags(
        markers
      );
      dispatch(openCorrespondingTagConversionModal({ markers: convertibleMarkers }));
    } catch (err) {
      console.error("Error preparing corresponding tag conversion:", err);
      dispatch(setError("Failed to prepare markers for conversion"));
    }
  }, [markers, dispatch]);

  // Handle confirm corresponding tag conversion
  const handleConfirmCorrespondingTagConversion = useCallback(async () => {
    try {
      const markers = correspondingTagConversionModalData?.markers || [];
      for (const { sourceMarker, correspondingTag } of markers) {
        await stashappService.updateMarkerTagAndTitle(
          sourceMarker.id,
          correspondingTag.id
        );
      }
      if (scene?.id) await dispatch(loadMarkers(scene.id)).unwrap();
    } catch (err) {
      console.error("Error converting markers:", err);
      throw err; // Let the modal handle the error display
    }
  }, [correspondingTagConversionModalData, dispatch, scene?.id]);

  // Check if all markers are approved (confirmed or rejected)
  const checkAllMarkersApproved = useCallback(() => {
    if (!markers || markers.length === 0) return true;

    return filterUnprocessedMarkers(markers).length === 0;
  }, [markers]);

  // Helper function to identify AI tags that should be removed from the scene
  const identifyAITagsToRemove = useCallback(
    async (confirmedMarkers: SceneMarker[]): Promise<Tag[]> => {
      try {
        // Get current scene tags from local database
        const currentSceneTagsResponse = await fetch(`/api/stash/scenes/${confirmedMarkers[0].scene.id}/tags`);
        const currentSceneTags = await currentSceneTagsResponse.json();

        console.log("=== AI Tag Removal Debug ===");
        console.log(
          "Current scene tags:",
          currentSceneTags.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
        );

        // Get all tags to find the AI parent tag and its children from local database
        const allTagsResponse = await fetch('/api/stash/tags');
        const allTags = await allTagsResponse.json();

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
    selectedActions: import("../serverConfig").CompletionDefaults
  ) => {
    if (!markers || markers.length === 0) return;
    if (!scene) return;

    try {
      // Step 1: Generate markers for markers (if selected)
      if (selectedActions.generateMarkers) {
        await stashappService.generateMarkers(scene.id);
      }

      // Step 2: Update scene tags (if any tag operations are selected)
      if (selectedActions.addAiReviewedTag || selectedActions.addPrimaryTags || selectedActions.removeCorrespondingTags) {
        if (!scene) {
          throw new Error("Scene data not found");
        }

        // Get all confirmed markers and their primary tags
        const confirmedMarkers = markers.filter((marker) =>
          isMarkerConfirmed(marker)
        );

        const tagsToAdd = [];
        
        // Add AI_Reviewed tag if selected
        if (selectedActions.addAiReviewedTag) {
          const aiReviewedTag = {
            id: markerAiReviewed,
            name: "AI_Reviewed",
          };
          tagsToAdd.push(aiReviewedTag);
        }

        // Add primary tags from confirmed markers if selected
        if (selectedActions.addPrimaryTags) {
          const primaryTags = confirmedMarkers.map((marker) => ({
            id: marker.primary_tag.id,
            name: marker.primary_tag.name,
          }));
          tagsToAdd.push(...primaryTags);
        }

        // Remove AI tags from scene if selected
        const tagsToRemove: Tag[] = selectedActions.removeCorrespondingTags 
          ? await identifyAITagsToRemove(confirmedMarkers)
          : [];

        // Update the scene with new tags only if there are changes
        if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
          await stashappService.updateScene(scene, tagsToAdd, tagsToRemove);
        }
      }

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
    markers,
    scene,
    identifyAITagsToRemove,
    dispatch,
    markerAiReviewed,
  ]);

  return {
    // Data
    getMarkerSummary,
    checkAllMarkersApproved,

    // Marker operations
    splitCurrentMarker,
    createOrDuplicateMarker,
    handleCreateMarker,

    // Copy/paste operations
    copyMarkerTimes,
    pasteMarkerTimes,

    // Delete operations
    handleDeleteRejectedMarkers,
    confirmDeleteRejectedMarkers,

    // AI operations
    handleCorrespondingTagConversion,
    handleConfirmCorrespondingTagConversion,

    // Completion operations
    identifyAITagsToRemove,
    executeCompletion,
  };
};
