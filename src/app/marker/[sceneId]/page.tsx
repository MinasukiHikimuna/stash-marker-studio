"use client";

import { useEffect, useRef, useCallback, useState, useMemo, use } from "react";
import {
  stashappService,
  type Tag,
  type SceneMarker,
} from "../../../services/StashappService";
import { KeyboardShortcutsModal } from "../../components/KeyboardShortcutsModal";
import { MarkerSlotsDialog } from "../../../components/marker/MarkerSlotsDialog";
import { Timeline, TimelineRef } from "../../../components/timeline-redux";
import { VideoPlayer } from "../../../components/marker/video/VideoPlayer";
import { MarkerWithTrack, TagGroup } from "../../../core/marker/types";
import { CorrespondingTagConversionModal } from "../../components/CorrespondingTagConversionModal";
import { MarkerPageHeader } from "../../../components/marker/MarkerPageHeader";
import { MarkerSummary } from "../../../components/marker/MarkerSummary";
import { MarkerList } from "../../../components/marker/MarkerList";
import { CompletionModal } from "../../../components/marker/CompletionModal";
import { DeleteRejectedModal } from "../../../components/marker/DeleteRejectedModal";
import { useAppSelector, useAppDispatch } from "../../../store/hooks";
import { useMarkerNavigation } from "../../../hooks/useMarkerNavigation";
import { useTimelineZoom } from "../../../hooks/useTimelineZoom";
import { useMarkerOperations } from "../../../hooks/useMarkerOperations";
import { useDynamicKeyboardShortcuts } from "../../../hooks/useDynamicKeyboardShortcuts";
import {
  selectMarkers,
  selectShotBoundaries,
  selectScene,
  selectAvailableTags,
  selectSelectedMarkerId,
  selectIsCompletionModalOpen,
  selectIncorrectMarkers,
  selectVideoDuration,
  selectCurrentVideoTime,
  selectMarkerLoading,
  selectMarkerError,
  selectIsEditingMarker,
  selectIsCreatingMarker,
  selectIsDuplicatingMarker,
  selectIsDeletingRejected,
  selectIsCorrespondingTagConversionModalOpen,
  selectIsKeyboardShortcutsModalOpen,
  selectIsCollectingModalOpen,
  selectIsSlotAssignmentModalOpen,
  selectCorrespondingTagConversionModalData,
  selectDeleteRejectedModalData,
  selectCompletionModalData,
  selectSlotAssignmentModalData,
  setSelectedMarkerId,
  clearError,
  setAvailableTags,
  // New modal actions
  openCompletionModal,
  openKeyboardShortcutsModal,
  openCollectingModal,
  closeModal,
  setCreatingMarker,
  setDuplicatingMarker,
  setMarkers,
  setIncorrectMarkers,
  setCurrentVideoTime,
  setVideoDuration,
  initializeMarkerPage,
  loadMarkers,
  createMarker,
  createShotBoundary,
  updateShotBoundary,
  deleteShotBoundary,
  updateMarkerTag,
  updateMarkerTimes,
  deleteMarker,
  seekToTime,
  setError
} from "../../../store/slices/markerSlice";
import { selectMarkerAiReviewed } from "../../../store/slices/configSlice";
import Toast from "../../components/Toast";
import { useRouter } from "next/navigation";
import { incorrectMarkerStorage } from "@/utils/incorrectMarkerStorage";
import { IncorrectMarkerCollectionModal } from "../../components/IncorrectMarkerCollectionModal";
import {
  formatSeconds,
  filterUnprocessedMarkers,
  getMarkerStatus,
} from "../../../core/marker/markerLogic";
import { MarkerStatus } from "../../../core/marker/types";
import type { ShotBoundary } from "../../../core/shotBoundary/types";


// Add toast state type
type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

export default function MarkerPage({ params }: { params: Promise<{ sceneId: string }> }) {
  const resolvedParams = use(params);
  const dispatch = useAppDispatch();
  
  // Redux selectors
  const markers = useAppSelector(selectMarkers);
  const shotBoundaries = useAppSelector(selectShotBoundaries);
  const markerAiReviewed = useAppSelector(selectMarkerAiReviewed);
  const scene = useAppSelector(selectScene);
  const availableTags = useAppSelector(selectAvailableTags);
  const selectedMarkerId = useAppSelector(selectSelectedMarkerId);
  const incorrectMarkers = useAppSelector(selectIncorrectMarkers);
  const videoDuration = useAppSelector(selectVideoDuration);
  const currentVideoTime = useAppSelector(selectCurrentVideoTime);
  const isLoading = useAppSelector(selectMarkerLoading);
  const error = useAppSelector(selectMarkerError);
  const _isEditingMarker = useAppSelector(selectIsEditingMarker);
  const isCreatingMarker = useAppSelector(selectIsCreatingMarker);
  const isDuplicatingMarker = useAppSelector(selectIsDuplicatingMarker);
  const isDeletingRejected = useAppSelector(selectIsDeletingRejected);
  const isCorrespondingTagConversionModalOpen = useAppSelector(selectIsCorrespondingTagConversionModalOpen);
  const isKeyboardShortcutsModalOpen = useAppSelector(selectIsKeyboardShortcutsModalOpen);
  const isCollectingModalOpen = useAppSelector(selectIsCollectingModalOpen);
  const isSlotAssignmentModalOpen = useAppSelector(selectIsSlotAssignmentModalOpen);
  const slotAssignmentModalData = useAppSelector(selectSlotAssignmentModalData);
  const correspondingTagConversionModalData = useAppSelector(selectCorrespondingTagConversionModalData);
  const deleteRejectedModalData = useAppSelector(selectDeleteRejectedModalData);
  const completionModalData = useAppSelector(selectCompletionModalData);
  const isCompletionModalOpen = useAppSelector(selectIsCompletionModalOpen);
  
  const markerListRef = useRef<HTMLDivElement>(null);
  // Temporary ref for video element compatibility - can be removed when VideoPlayer fully handles all video interactions
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<TimelineRef>(null);
  const router = useRouter();

  const [toastState, setToastState] = useState<ToastState>(null);
  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToastState({ message, type });
      setTimeout(() => setToastState(null), 3000);
    },
    []
  );

  // Get sorted shot boundaries from Redux
  const getShotBoundaries = useCallback((): ShotBoundary[] => {
    return [...shotBoundaries].sort((a, b) => a.startTime - b.startTime);
  }, [shotBoundaries]);

  // Add state for tracking which marker is being edited
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string>("");

  // Add state for swimlane data from Timeline
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [markersWithTracks, setMarkersWithTracks] = useState<MarkerWithTrack[]>(
    []
  );

  // Add state for marker merging
  const [copiedMarkerForMerge, setCopiedMarkerForMerge] = useState<SceneMarker | null>(null);

  // Center timeline on playhead function (defined early for use in useTimelineZoom)
  const centerPlayhead = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.centerOnPlayhead();
    }
  }, []);

  // Timeline zoom functionality
  const {
    zoom,
    setZoom: _setZoom,
    timelineContainerRef,
    zoomIn,
    zoomOut,
    resetZoom,
    setAvailableTimelineWidth,
  } = useTimelineZoom({ onZoomChange: centerPlayhead });

  // Callback to receive swimlane data from Timeline component
  const handleSwimlaneDataUpdate = useCallback(
    (newTagGroups: TagGroup[], newMarkersWithTracks: MarkerWithTrack[]) => {
      setTagGroups(newTagGroups);
      setMarkersWithTracks(newMarkersWithTracks);
    },
    []
  );

  // Callback to receive available timeline width for accurate zoom calculations
  const handleAvailableWidthUpdate = useCallback(
    (availableWidth: number) => {
      setAvailableTimelineWidth(availableWidth);
    },
    [setAvailableTimelineWidth]
  );

  const fetchData = useCallback(async () => {
    const sceneId = resolvedParams.sceneId;
    
    if (!sceneId) {
      router.push("/search");
      return;
    }
    
    await dispatch(initializeMarkerPage(sceneId));
  }, [resolvedParams.sceneId, dispatch, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handlePopState = () => {
      fetchData();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [fetchData]);

  // Watch for Redux error state changes and show error toasts
  useEffect(() => {
    if (error) {
      showToast(error, "error");
      // Clear the error after showing it
      dispatch(clearError());
    }
  }, [error, showToast, dispatch]);

  // All markers are action markers now (shot boundaries are stored separately)
  const actionMarkers = useMemo(() => {
    return markers || [];
  }, [markers]);


  // Marker operations functionality
  const {
    splitCurrentMarker: splitCurrentMarkerFromHook,
    splitVideoCutMarker: splitVideoCutMarkerFromHook,
    copyMarkerTimes: copyMarkerTimesFromHook,
    pasteMarkerTimes: pasteMarkerTimesFromHook,
    handleDeleteRejectedMarkers: handleDeleteRejectedMarkersFromHook,
    confirmDeleteRejectedMarkers: confirmDeleteRejectedMarkersFromHook,
    handleCorrespondingTagConversion,
    handleConfirmCorrespondingTagConversion,
    getMarkerSummary: getMarkerSummaryFromHook,
    checkAllMarkersApproved,
    identifyAITagsToRemove,
    executeCompletion,
  } = useMarkerOperations(
    actionMarkers,
    getShotBoundaries,
    showToast
  );

  // Create aliases for compatibility with existing code
  const splitCurrentMarker = splitCurrentMarkerFromHook;
  const splitVideoCutMarker = splitVideoCutMarkerFromHook;
  const copyMarkerTimes = copyMarkerTimesFromHook;
  const pasteMarkerTimes = pasteMarkerTimesFromHook;
  const getMarkerSummary = getMarkerSummaryFromHook;
  const handleDeleteRejectedMarkers = handleDeleteRejectedMarkersFromHook;
  const confirmDeleteRejectedMarkers = confirmDeleteRejectedMarkersFromHook;

  const handleEditMarker = useCallback((marker: SceneMarker) => {
    setEditingMarkerId(marker.id);
    setEditingTagId(marker.primary_tag.id);
  }, []);

  const handleSaveEditWithTagId = useCallback(
    async (marker: SceneMarker, tagId?: string) => {
      const finalTagId = tagId || editingTagId;
      if (finalTagId !== marker.primary_tag.id && scene) {
        console.log("Updating marker tag:", {
          markerId: marker.id,
          markerTag: marker.primary_tag.name,
          oldTagId: marker.primary_tag.id,
          newTagId: finalTagId,
        });
        try {
          await dispatch(updateMarkerTag({
            sceneId: scene.id,
            markerId: marker.id,
            tagId: finalTagId
          })).unwrap();
        } catch (error) {
          console.error("Error updating marker tag:", error);
          dispatch(setError(`Failed to update marker tag: ${error}`));
        }
      }
      setEditingMarkerId(null);
      setEditingTagId("");
    },
    [editingTagId, scene, dispatch]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMarkerId(null);
    setEditingTagId("");
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const result = await stashappService.getAllTags();
      dispatch(setAvailableTags(result.findTags.tags));
    } catch (err) {
      console.error("Error fetching tags:", err);
      dispatch(setError(`Failed to fetch tags: ${err}`));
    }
  }, [dispatch]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Handle import markers button click
  const handleImportMarkers = useCallback(async () => {
    if (!scene) {
      showToast("No scene available", "error");
      return;
    }

    try {
      const response = await fetch('/api/markers/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sceneId: scene.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to import markers');
      }

      const result = await response.json();
      showToast(`Imported ${result.count} marker(s) from Stashapp`, "success");

      // Refresh markers to show the imported markers
      await dispatch(loadMarkers(scene.id));
    } catch (error) {
      console.error("Error importing markers:", error);
      showToast("Failed to import markers from Stashapp", "error");
    }
  }, [scene, showToast, dispatch]);

  // Handle completion button click
  const handleComplete = useCallback(async () => {
    if (!actionMarkers || actionMarkers.length === 0) return;

    const warnings: string[] = [];

    // Check if all markers are approved
    const unprocessedMarkers = filterUnprocessedMarkers(actionMarkers);
    if (unprocessedMarkers.length > 0) {
      warnings.push(
        `${unprocessedMarkers.length} marker(s) are not yet approved`
      );
    }

    // Capture shot boundary state for completion summary (no longer deleting via Stashapp)
    const shotBoundariesForSummary = getShotBoundaries();
    console.log("=== Shot Boundaries Summary ===");
    console.log(`Found ${shotBoundariesForSummary.length} shot boundaries`);
    shotBoundariesForSummary.forEach((boundary, index) => {
      console.log(
        `${index + 1}. ID: ${boundary.id}, Time: ${formatSeconds(boundary.startTime, true)} - ${
          boundary.endTime !== null && boundary.endTime !== undefined
            ? formatSeconds(boundary.endTime, true)
            : "N/A"
        }`
      );
    });
    console.log("=== End Shot Boundaries Summary ===");

    // Calculate tags to remove and primary tags to add for preview
    const confirmedMarkers = actionMarkers.filter((marker) =>
      [MarkerStatus.CONFIRMED].includes(
        getMarkerStatus(marker)
      )
    );

    let tagsToRemove: Tag[] = [];
    let primaryTagsToAdd: Tag[] = [];
    let hasAiReviewedTagAlready = false;

    if (confirmedMarkers.length > 0) {
      try {
        if (!scene) {
          throw new Error("Scene data not found");
        }
        // Get current scene tags to check what's already present
        const currentSceneTags = await stashappService.getSceneTags(
          scene.id
        );
        const currentSceneTagIds = new Set(
          currentSceneTags.map((tag) => tag.id)
        );

        tagsToRemove = await identifyAITagsToRemove(confirmedMarkers);

        // Get unique primary tags from confirmed markers, but only those not already on the scene
        const uniquePrimaryTagsMap = new Map<
          string,
          { id: string; name: string }
        >();
        confirmedMarkers.forEach((marker) => {
          uniquePrimaryTagsMap.set(marker.primary_tag.id, {
            id: marker.primary_tag.id,
            name: marker.primary_tag.name,
          });
        });

        // Filter to only include tags that aren't already on the scene and sort alphabetically
        primaryTagsToAdd = Array.from(uniquePrimaryTagsMap.values())
          .filter((tag) => !currentSceneTagIds.has(tag.id))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Also check if AI_Reviewed tag is already present
        const aiReviewedTagId = markerAiReviewed;
        hasAiReviewedTagAlready = currentSceneTagIds.has(aiReviewedTagId);

        console.log("Current scene tag IDs:", Array.from(currentSceneTagIds));
        console.log(
          "All unique primary tags from markers:",
          Array.from(uniquePrimaryTagsMap.values()).map((t) => t.name)
        );
        console.log(
          "Primary tags to add (new only):",
          primaryTagsToAdd.map((t) => t.name)
        );
        console.log(
          "AI_Reviewed tag already present:",
          hasAiReviewedTagAlready
        );
      } catch (error) {
        console.error("Error calculating tags for completion:", error);
        // Continue without tag preview
      }
    }

    // Open completion modal with all the data
    dispatch(openCompletionModal({
      warnings,
      videoCutMarkersToDelete: shotBoundariesForSummary,
      hasAiReviewedTag: hasAiReviewedTagAlready,
      primaryTagsToAdd,
      tagsToRemove
    }));
  }, [
    actionMarkers,
    getShotBoundaries,
    scene,
    identifyAITagsToRemove,
    markerAiReviewed,
    dispatch,
  ]);

  // executeCompletion now comes from useMarkerOperations hook
  // Create wrapper function to handle state dependencies
  const executeCompletionWrapper = useCallback(async (selectedActions: import("../../../serverConfig").CompletionDefaults) => {
    // Get current modal data
    const modalData = completionModalData;
    if (!modalData) return;
    
    // Close modal when completion starts
    dispatch(closeModal());
    
    // Call the hook's executeCompletion with the modal data and selected actions
    await executeCompletion(modalData.videoCutMarkersToDelete, selectedActions);
  }, [executeCompletion, completionModalData, dispatch]);

  // Wrapper for keyboard shortcuts - opens completion modal
  const executeCompletionFromKeyboard = useCallback(() => {
    // Check if we have action markers to complete
    if (!actionMarkers || actionMarkers.length === 0) return;
    
    // Use the existing handleComplete function to open the modal with proper data
    handleComplete();
  }, [actionMarkers, handleComplete]);

  // Universal marker creation function
  const createOrDuplicateMarker = useCallback(
    (startTime: number, endTime: number | null, sourceMarker?: SceneMarker) => {
      console.log("createOrDuplicateMarker called with state:", {
        hasScene: !!scene,
        availableTagsCount: availableTags?.length || 0,
        isDuplicate: !!sourceMarker,
        startTime,
        endTime,
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

      // Determine tag to use for the temporary marker
      let selectedTag: Tag;
      if (isDuplicate) {
        selectedTag = sourceMarker.primary_tag;
      } else {
        // For new markers, try to use the previously selected marker's tag
        const previouslySelectedMarker = actionMarkers.find(m => m.id === selectedMarkerId);
        if (previouslySelectedMarker?.primary_tag) {
          selectedTag = previouslySelectedMarker.primary_tag;
        } else {
          // Fall back to first available tag if no previous selection
          selectedTag = availableTags[0] || { id: "", name: "Select Tag" };
        }
      }


      // Create temporary marker object
      const tempMarker: SceneMarker = {
        id: isDuplicate ? "temp-duplicate" : "temp-new",
        seconds: startTime,
        end_seconds: endTime ?? undefined,
        primary_tag: selectedTag,
        scene: scene,
        tags: isDuplicate ? [] : [], // Both start with empty tags array
        title: isDuplicate ? sourceMarker.title : "",
        stream: isDuplicate ? sourceMarker.stream : "",
        preview: isDuplicate ? sourceMarker.preview : "",
        screenshot: isDuplicate ? sourceMarker.screenshot : "",
      };

      const insertIndex = (markers || []).findIndex(m => m.seconds > tempMarker.seconds);
      const updatedMarkers = [...(markers || [])];
      if (insertIndex === -1) {
        updatedMarkers.push(tempMarker);
      } else {
        updatedMarkers.splice(insertIndex, 0, tempMarker);
      }

      dispatch(setMarkers(updatedMarkers));
      dispatch(setSelectedMarkerId(tempMarker.id));
      if (isDuplicate) {
        dispatch(setDuplicatingMarker(true));
      } else {
        dispatch(setCreatingMarker(true));
      }
    },
    [
      scene,
      availableTags,
      markers,
      actionMarkers,
      selectedMarkerId,
      dispatch,
    ]
  );

  // Convenience wrapper for creating new markers
  const handleCreateMarker = useCallback(() => {
    const currentTime = currentVideoTime;
    createOrDuplicateMarker(currentTime, currentTime + 20);
  }, [createOrDuplicateMarker, currentVideoTime]);

  // Update handleMarkerClick to use marker IDs
  const handleMarkerClick = useCallback(
    (marker: SceneMarker) => {
      console.log("Marker clicked:", {
        markerId: marker.id,
        markerTag: marker.primary_tag.name,
        markerStart: marker.seconds,
        markerEnd: marker.end_seconds,
      });

      dispatch(setSelectedMarkerId(marker.id));
    },
    [dispatch]
  );

  // Navigate to next/previous shot
  const jumpToNextShot = useCallback(() => {
    const shotBoundaries = getShotBoundaries();
    const nextShot = shotBoundaries.find(
      (shot) => (shot.startTime ?? 0) > currentVideoTime + 0.1
    );

    if (nextShot) {
      dispatch(seekToTime(nextShot.startTime));
    }
  }, [getShotBoundaries, currentVideoTime, dispatch]);

  const jumpToPreviousShot = useCallback(() => {
    const shotBoundaries = getShotBoundaries();
    const previousShot = [...shotBoundaries]
      .reverse()
      .find((shot) => (shot.startTime ?? 0) < currentVideoTime - 0.1);

    if (previousShot) {
      dispatch(seekToTime(previousShot.startTime));
    }
  }, [getShotBoundaries, currentVideoTime, dispatch]);

  // Copy marker properties for merging
  const copyMarkerForMerge = useCallback(() => {
    const currentMarker = actionMarkers.find(m => m.id === selectedMarkerId);
    if (!currentMarker) {
      showToast("No marker selected to copy", "error");
      return;
    }
    
    setCopiedMarkerForMerge(currentMarker);
    showToast(`Copied marker "${currentMarker.primary_tag.name}" for merging`, "success");
  }, [actionMarkers, selectedMarkerId, showToast]);

  // Merge copied marker properties into current marker
  const mergeMarkerProperties = useCallback(async () => {
    if (!copiedMarkerForMerge) {
      showToast("No marker copied for merging", "error");
      return;
    }

    const targetMarker = actionMarkers.find(m => m.id === selectedMarkerId);
    if (!targetMarker) {
      showToast("No target marker selected", "error");
      return;
    }

    if (!scene) {
      showToast("No scene data available", "error");
      return;
    }

    // Determine which marker is chronologically first
    const firstMarker = copiedMarkerForMerge.seconds <= targetMarker.seconds 
      ? copiedMarkerForMerge 
      : targetMarker;
    const secondMarker = copiedMarkerForMerge.seconds <= targetMarker.seconds 
      ? targetMarker 
      : copiedMarkerForMerge;

    // Calculate new end time (latest of both markers)
    const firstEndTime = firstMarker.end_seconds ?? firstMarker.seconds;
    const secondEndTime = secondMarker.end_seconds ?? secondMarker.seconds;
    const newEndTime = Math.max(firstEndTime, secondEndTime);

    try {
      // Update the first marker to extend to the second marker's end time
      await dispatch(updateMarkerTimes({
        sceneId: scene.id,
        markerId: firstMarker.id,
        startTime: firstMarker.seconds,
        endTime: newEndTime
      })).unwrap();

      // Delete the second marker
      await dispatch(deleteMarker({
        sceneId: scene.id,
        markerId: secondMarker.id
      })).unwrap();

      showToast(`Merged markers: ${formatSeconds(firstMarker.seconds)} - ${formatSeconds(newEndTime)}`, "success");
      setCopiedMarkerForMerge(null); // Clear copied marker after merge

      // Select the remaining (first) marker
      dispatch(setSelectedMarkerId(firstMarker.id));
    } catch (error) {
      console.error("Error merging markers:", error);
      showToast("Failed to merge markers", "error");
    }
  }, [copiedMarkerForMerge, actionMarkers, selectedMarkerId, scene, dispatch, showToast]);

  // Create marker from previous shot boundary to next shot boundary
  const createShotBoundaryMarker = useCallback(() => {
    if (!scene || !availableTags?.length) {
      console.log("Cannot create shot boundary marker: missing scene or tags");
      return;
    }

    const shotBoundaries = getShotBoundaries();
    if (shotBoundaries.length === 0) {
      showToast("No shot boundaries found", "error");
      return;
    }

    // Find previous shot boundary (at or before current time)
    const previousShot = [...shotBoundaries]
      .reverse()
      .find((shot) => shot.startTime <= currentVideoTime);

    // Find next shot boundary (after current time)
    const nextShot = shotBoundaries
      .find((shot) => shot.startTime > currentVideoTime);

    let startTime: number;
    let endTime: number;

    // Frame duration at 30fps (1/30 second)
    const frameTime = 1 / 30;

    if (previousShot && nextShot) {
      // Between two shot boundaries - end one frame before next shot
      startTime = previousShot.startTime;
      endTime = nextShot.startTime - frameTime;
    } else if (previousShot && !nextShot) {
      // After last shot boundary - use previous shot to end of video
      startTime = previousShot.startTime;
      endTime = videoDuration || (currentVideoTime + 20);
    } else if (!previousShot && nextShot) {
      // Before first shot boundary - end one frame before next shot
      startTime = 0;
      endTime = nextShot.startTime - frameTime;
    } else {
      // No shot boundaries - fallback to current time + 20 seconds
      startTime = currentVideoTime;
      endTime = currentVideoTime + 20;
    }

    console.log("Creating shot boundary marker:", {
      startTime,
      endTime,
      previousShot: previousShot?.startTime,
      nextShot: nextShot?.startTime,
      currentTime: currentVideoTime,
    });

    // Create the marker using the unified createOrDuplicateMarker function
    createOrDuplicateMarker(startTime, endTime);
  }, [
    scene,
    availableTags,
    getShotBoundaries,
    currentVideoTime,
    videoDuration,
    createOrDuplicateMarker,
    showToast,
  ]);

  // Add or split shot boundary at playhead position
  const addShotBoundaryAtPlayhead = useCallback(async () => {
    if (!scene) {
      showToast("No scene data available", "error");
      return;
    }

    const shotBoundaries = getShotBoundaries();
    const currentTime = currentVideoTime;

    // Find if playhead is inside an existing shot boundary
    const containingShot = shotBoundaries.find(
      (shot) =>
        shot.startTime <= currentTime &&
        shot.endTime !== null &&
        shot.endTime !== undefined &&
        shot.endTime > currentTime
    );

    if (containingShot) {
      // Split the existing shot boundary at playhead
      if (containingShot.endTime === null || containingShot.endTime === undefined) {
        showToast("Cannot split shot boundary without end time", "error");
        return;
      }

      try {
        console.log("Splitting shot boundary at playhead:", {
          shotId: containingShot.id,
          originalStart: containingShot.startTime,
          originalEnd: containingShot.endTime,
          splitTime: currentTime,
        });

        // Update first shot to end at playhead
        await dispatch(updateShotBoundary({
          sceneId: scene.id,
          shotBoundaryId: containingShot.id,
          startTime: containingShot.startTime,
          endTime: currentTime,
        })).unwrap();

        // Create new shot from playhead to original end
        await dispatch(createShotBoundary({
          sceneId: scene.id,
          startTime: currentTime,
          endTime: containingShot.endTime,
        })).unwrap();

        showToast(`Split shot boundary at ${formatSeconds(currentTime)}`, "success");
      } catch (error) {
        console.error("Error splitting shot boundary:", error);
        showToast("Failed to split shot boundary", "error");
      }
      return;
    }

    // Playhead is not inside any shot boundary - create new boundaries
    const nextShot = shotBoundaries.find((shot) => shot.startTime > currentTime);
    const endTime = nextShot ? nextShot.startTime : (videoDuration || currentTime + 20);

    const previousShot = [...shotBoundaries]
      .reverse()
      .find((shot) => shot.startTime < currentTime);

    try {
      if (
        previousShot &&
        previousShot.endTime !== null &&
        previousShot.endTime !== undefined &&
        previousShot.endTime < currentTime
      ) {
        // There's a gap - create shot from previous end to playhead, then playhead to next
        console.log("Creating shot boundaries to fill gap:", {
          gapStart: previousShot.endTime,
          splitPoint: currentTime,
          gapEnd: endTime,
        });

        await dispatch(createShotBoundary({
          sceneId: scene.id,
          startTime: previousShot.endTime,
          endTime: currentTime,
        })).unwrap();

        await dispatch(createShotBoundary({
          sceneId: scene.id,
          startTime: currentTime,
          endTime: endTime,
        })).unwrap();
      } else if (!previousShot) {
        // No previous shot - create from start of video
        console.log("Creating shot boundaries from start:", {
          firstShotEnd: currentTime,
          secondShotEnd: endTime,
        });

        await dispatch(createShotBoundary({
          sceneId: scene.id,
          startTime: 0,
          endTime: currentTime,
        })).unwrap();

        await dispatch(createShotBoundary({
          sceneId: scene.id,
          startTime: currentTime,
          endTime: endTime,
        })).unwrap();
      } else {
        // Previous shot extends to playhead, just create from playhead onward
        await dispatch(createShotBoundary({
          sceneId: scene.id,
          startTime: currentTime,
          endTime: endTime,
        })).unwrap();
      }

      showToast(`Created shot boundary at ${formatSeconds(currentTime)}`, "success");
    } catch (error) {
      console.error("Error creating shot boundary:", error);
      showToast("Failed to create shot boundary", "error");
    }
  }, [
    scene,
    getShotBoundaries,
    currentVideoTime,
    videoDuration,
    dispatch,
    showToast,
  ]);

  // Remove shot boundary marker at playhead position and merge with previous shot
  const removeShotBoundaryMarker = useCallback(async () => {
    if (!scene) {
      showToast("No scene data available", "error");
      return;
    }

    const shotBoundaries = getShotBoundaries();
    if (shotBoundaries.length === 0) {
      showToast("No shot boundaries found", "error");
      return;
    }

    // Find the shot boundary marker that starts at or near the current playhead position
    // Allow for small tolerance (0.5 seconds) to account for precision issues
    const currentShotBoundary = shotBoundaries.find(
      (shot) => Math.abs(shot.startTime - currentVideoTime) <= 0.5
    );

    if (!currentShotBoundary) {
      showToast("No shot boundary marker found at current playhead position", "error");
      return;
    }

    // Find the previous and next shot boundary markers
    const previousShotBoundary = [...shotBoundaries]
      .reverse()
      .find((shot) => shot.startTime < currentShotBoundary.startTime);

    const nextShotBoundary = shotBoundaries.find(
      (shot) => shot.startTime > currentShotBoundary.startTime
    );

    try {
      if (!previousShotBoundary) {
        // Removing first boundary - extend next boundary to start from 0
        if (!nextShotBoundary) {
          showToast("Cannot remove the only shot boundary", "error");
          return;
        }

        console.log("Removing first shot boundary:", {
          currentShotId: currentShotBoundary.id,
          nextShotId: nextShotBoundary.id,
          nextShotOldStart: nextShotBoundary.startTime,
        });

        await dispatch(updateShotBoundary({
          sceneId: scene.id,
          shotBoundaryId: nextShotBoundary.id,
          startTime: 0,
          endTime: nextShotBoundary.endTime ?? null,
        })).unwrap();

        await dispatch(deleteShotBoundary({
          sceneId: scene.id,
          shotBoundaryId: currentShotBoundary.id,
        })).unwrap();

        showToast(`Removed first shot boundary, extended next to start from beginning`, "success");
      } else {
        // Normal case - extend previous boundary
        const newEndTime =
          currentShotBoundary.endTime ??
          videoDuration ??
          currentVideoTime + 20;

        console.log("Removing shot boundary marker:", {
          currentShotId: currentShotBoundary.id,
          currentShotStart: currentShotBoundary.startTime,
          previousShotId: previousShotBoundary.id,
          previousShotStart: previousShotBoundary.startTime,
          previousShotOldEnd: previousShotBoundary.endTime,
          newEndTime,
        });

        await dispatch(updateShotBoundary({
          sceneId: scene.id,
          shotBoundaryId: previousShotBoundary.id,
          startTime: previousShotBoundary.startTime,
          endTime: newEndTime,
        })).unwrap();

        await dispatch(deleteShotBoundary({
          sceneId: scene.id,
          shotBoundaryId: currentShotBoundary.id,
        })).unwrap();

        showToast(
          `Merged shot boundaries: ${formatSeconds(previousShotBoundary.startTime)} - ${formatSeconds(newEndTime)}`,
          "success"
        );
      }
    } catch (error) {
      console.error("Error removing shot boundary marker:", error);
      showToast("Failed to remove shot boundary marker", "error");
    }
  }, [
    scene,
    getShotBoundaries,
    currentVideoTime,
    videoDuration,
    dispatch,
    showToast,
  ]);

  // Use navigation hook
  const {
    findNextUnprocessedMarker,
    findPreviousUnprocessedGlobal,
    findNextUnprocessedMarkerInSwimlane,
    findPreviousUnprocessedMarkerInSwimlane,
    findNextUnprocessedGlobal,
    navigateBetweenSwimlanes,
    navigateWithinSwimlane,
    findNextMarkerAtPlayhead,
    findPreviousMarkerAtPlayhead,
  } = useMarkerNavigation({
    actionMarkers,
    markersWithTracks,
    tagGroups,
    selectedMarkerId,
    currentVideoTime,
  });

  // Use dynamic keyboard shortcuts hook
  useDynamicKeyboardShortcuts({
    actionMarkers,
    markers,
    scene,
    selectedMarkerId,
    editingMarkerId,
    isCreatingMarker,
    isDuplicatingMarker,
    incorrectMarkers,
    availableTags,
    videoDuration,
    currentVideoTime,
    isCompletionModalOpen,
    isDeletingRejected,
    isCorrespondingTagConversionModalOpen,
    isCollectingModalOpen,
    videoElementRef,
    fetchData,
    handleCancelEdit,
    handleEditMarker,
    handleDeleteRejectedMarkers,
    splitCurrentMarker,
    splitVideoCutMarker,
    createOrDuplicateMarker,
    createShotBoundaryMarker,
    addShotBoundaryAtPlayhead,
    removeShotBoundaryMarker,
    copyMarkerTimes,
    pasteMarkerTimes,
    copyMarkerForMerge,
    mergeMarkerProperties,
    jumpToNextShot,
    jumpToPreviousShot,
    executeCompletion: executeCompletionFromKeyboard,
    confirmDeleteRejectedMarkers,
    handleConfirmCorrespondingTagConversion,
    showToast,
    navigateBetweenSwimlanes,
    navigateWithinSwimlane,
    findNextUnprocessedMarker,
    findPreviousUnprocessedGlobal,
    findNextUnprocessedMarkerInSwimlane,
    findPreviousUnprocessedMarkerInSwimlane,
    findNextUnprocessedGlobal,
    findNextMarkerAtPlayhead,
    findPreviousMarkerAtPlayhead,
    zoomIn,
    zoomOut,
    resetZoom,
    centerPlayhead,
  });

  // Effect to ensure selected marker is valid
  useEffect(() => {
    console.log("Marker selection effect triggered", {
      actionMarkersCount: actionMarkers.length,
      selectedMarkerId,
      hasSwimLaneData: markersWithTracks.length > 0 && tagGroups.length > 0,
      markersWithTracksCount: markersWithTracks.length,
      tagGroupsCount: tagGroups.length,
      actionMarkers: actionMarkers.map(m => ({
        id: m.id,
        seconds: m.seconds,
        tag: m.primary_tag.name,
        status: {
          isConfirmed: m.tags?.some(tag => tag.name === 'MARKER_STATUS_CONFIRMED'),
          isRejected: m.tags?.some(tag => tag.name === 'MARKER_STATUS_REJECTED')
        }
      }))
    });

    if (actionMarkers.length > 0) {
      // Check if currently selected marker still exists
      const selectedMarker = actionMarkers.find(
        (m) => m.id === selectedMarkerId
      );
      
      console.log("Selected marker check", {
        selectedMarkerId,
        selectedMarkerExists: !!selectedMarker,
        selectedMarkerDetails: selectedMarker ? {
          id: selectedMarker.id,
          tag: selectedMarker.primary_tag.name,
          seconds: selectedMarker.seconds
        } : null
      });
      
      if (!selectedMarker) {
        // Wait for both actionMarkers and markersWithTracks to be populated
        if (actionMarkers.length > 0 && markersWithTracks.length > 0 && tagGroups.length > 0) {
          console.log("No selected marker found, searching for first unprocessed with swimlane data...");
          const firstUnprocessedId = findNextUnprocessedGlobal();
          console.log("First unprocessed search result", {
            firstUnprocessedId
          });
          
          if (firstUnprocessedId) {
            console.log("Selecting first unprocessed marker:", firstUnprocessedId);
            dispatch(setSelectedMarkerId(firstUnprocessedId));
          } else {
            console.log("No unprocessed markers found - this may indicate all markers are processed");
            // Do not fall back to chronological selection - rely purely on swimlane-based approach
          }
        } else {
          console.log("Waiting for both action markers and swimlane data", {
            actionMarkersCount: actionMarkers.length,
            markersWithTracksCount: markersWithTracks.length,
            tagGroupsCount: tagGroups.length
          });
        }
      }
    } else {
      // If no markers, clear selection
      console.log("No action markers, clearing selection");
      dispatch(setSelectedMarkerId(null));
    }
  }, [actionMarkers, selectedMarkerId, dispatch, findNextUnprocessedGlobal, markersWithTracks.length, tagGroups.length]);


  // Scroll selected marker into view
  useEffect(() => {
    if (markerListRef.current && selectedMarkerId) {
      // Longer delay to ensure all state updates have completed and DOM has updated
      const timeoutId = setTimeout(() => {
        if (markerListRef.current) {
          const selectedElement = markerListRef.current.querySelector(
            `[data-marker-id="${selectedMarkerId}"]`
          ) as HTMLElement;

          if (selectedElement) {
            selectedElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }
      }, 200);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedMarkerId]); // Also depend on actionMarkers.length to ensure it runs after markers are updated

  // Update video duration and current time
  useEffect(() => {
    const video = videoElementRef.current;
    if (video) {
      const handleLoadedMetadata = () => {
        if (videoElementRef.current) {
          dispatch(setVideoDuration(videoElementRef.current.duration));
        }
      };
      video.addEventListener(
        "loadedmetadata",
        handleLoadedMetadata
      );
      return () => {
        video.removeEventListener(
          "loadedmetadata",
          handleLoadedMetadata
        );
      };
    }
  }, [dispatch]);

  // Load incorrect markers when scene changes
  useEffect(() => {
    if (scene?.id) {
      const incorrectMarkers = incorrectMarkerStorage.getIncorrectMarkers(
        scene.id
      );
      dispatch(setIncorrectMarkers(incorrectMarkers));
    }
  }, [scene?.id, dispatch]);

  const updateCurrentTime = useCallback(() => {
    if (videoElementRef.current) {
      dispatch(setCurrentVideoTime(videoElementRef.current.currentTime));
    }
  }, [dispatch]);

  // Effect to update current time from video
  useEffect(() => {
    const video = videoElementRef.current;
    if (video) {
      const handleLoadedMetadata = () => {
        dispatch(setVideoDuration(video.duration));
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("timeupdate", updateCurrentTime);
      video.addEventListener("seeking", updateCurrentTime);
      video.addEventListener("seeked", updateCurrentTime);

      // Clean up listeners
      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("timeupdate", updateCurrentTime);
        video.removeEventListener("seeking", updateCurrentTime);
        video.removeEventListener("seeked", updateCurrentTime);
      };
    }
  }, [updateCurrentTime, dispatch]);

  useEffect(() => {
    if (scene) {
      const incorrectMarkers = incorrectMarkerStorage.getIncorrectMarkers(
        scene.id
      );
      dispatch(setIncorrectMarkers(incorrectMarkers));
    }
  }, [scene, dispatch]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <MarkerPageHeader
        scene={scene}
        markers={markers}
        incorrectMarkers={incorrectMarkers}
        isLoading={isLoading}
        checkAllMarkersApproved={checkAllMarkersApproved}
        onDeleteRejected={handleDeleteRejectedMarkers}
        onOpenCollectModal={() => dispatch(openCollectingModal())}
        onCorrespondingTagConversion={handleCorrespondingTagConversion}
        onComplete={handleComplete}
        onImportMarkers={handleImportMarkers}
      />

      {error && (
        <div className="w-full text-center p-4 bg-red-900 text-red-100 flex-shrink-0">
          <h2 className="font-bold">Error:</h2>
          <pre className="text-sm">{error}</pre>
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0">
        {scene && (
          <>
            {/* Video player and marker list in equal height container */}
            <div className="flex flex-1 min-h-0">
              <div className="w-1/3 flex flex-col border-r border-gray-300 min-h-0">
                <MarkerSummary
                  markerSummary={getMarkerSummary()}
                  shotBoundariesCount={getShotBoundaries().length}
                  markers={markers}
                  isCreatingMarker={isCreatingMarker}
                  isDuplicatingMarker={isDuplicatingMarker}
                  selectedMarkerId={selectedMarkerId}
                  onCreateMarker={handleCreateMarker}
                  onSplitMarker={() => splitCurrentMarker()}
                  onShowShortcuts={() => dispatch(openKeyboardShortcutsModal())}
                  actionMarkers={actionMarkers}
                  createOrDuplicateMarker={createOrDuplicateMarker}
                />
                {/* Scrollable marker list - now with grow to push edit section to bottom */}
                <div
                  ref={markerListRef}
                  className="overflow-y-auto flex-1 min-h-0"
                  data-testid="marker-list"
                >
                  <MarkerList
                    markers={markers}
                    selectedMarkerId={selectedMarkerId}
                    editingMarkerId={editingMarkerId}
                    editingTagId={editingTagId}
                    availableTags={availableTags}
                    incorrectMarkers={incorrectMarkers}
                    videoElementRef={videoElementRef}
                    actionMarkers={actionMarkers}
                    onMarkerClick={handleMarkerClick}
                    onEditMarker={handleEditMarker}
                    onSaveEditWithTagId={handleSaveEditWithTagId}
                    onCancelEdit={handleCancelEdit}
                    setEditingTagId={setEditingTagId}
                  />
                </div>
              </div>
              <div className="w-2/3 flex flex-col min-h-0 bg-black">
                <VideoPlayer className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Timeline spans full width below the video/marker layout */}
            <div
              ref={timelineContainerRef}
              className="border-t border-gray-300 flex-shrink-0"
            >
              <Timeline
                ref={timelineRef}
                markers={markers || []}
                actionMarkers={actionMarkers}
                shotBoundaries={shotBoundaries}
                selectedMarkerId={selectedMarkerId}
                videoDuration={videoDuration || 0}
                currentTime={currentVideoTime}
                onMarkerClick={handleMarkerClick}
                onSwimlaneDataUpdate={handleSwimlaneDataUpdate}
                onAvailableWidthUpdate={handleAvailableWidthUpdate}
                scene={scene}
                zoom={zoom}
              />
            </div>
          </>
        )}
      </div>

      <DeleteRejectedModal
        isOpen={isDeletingRejected}
        rejectedMarkers={deleteRejectedModalData?.rejectedMarkers || []}
        onCancel={() => dispatch(closeModal())}
        onConfirm={confirmDeleteRejectedMarkers}
      />

      <CorrespondingTagConversionModal
        isOpen={isCorrespondingTagConversionModalOpen}
        onClose={() =>
          dispatch(closeModal())
        }
        markers={correspondingTagConversionModalData?.markers || []}
        onConfirm={handleConfirmCorrespondingTagConversion}
      />

      {/* Toast Notifications */}
      {toastState && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          onClose={() => setToastState(null)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsModalOpen}
        onClose={() =>
          dispatch(closeModal())
        }
      />

      {/* Slot Assignment Dialog */}
      {isSlotAssignmentModalOpen && slotAssignmentModalData && scene && (
        <MarkerSlotsDialog
          marker={slotAssignmentModalData.marker}
          scene={scene}
          onSave={async (slots) => {
            // Update slots via API
            const response = await fetch(`/api/markers/${slotAssignmentModalData.marker.id}/slots`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                slots: slots.map(s => ({
                  slotDefinitionId: s.slotDefinitionId,
                  stashappPerformerId: s.performerId ? parseInt(s.performerId) : null,
                })),
              }),
            });

            if (!response.ok) {
              throw new Error('Failed to update marker slots');
            }

            // Refresh markers to show updated slots
            await dispatch(loadMarkers(scene.id));
            dispatch(closeModal());
          }}
          onCancel={() => dispatch(closeModal())}
        />
      )}

      {/* Completion Modal */}
      <CompletionModal
        isOpen={isCompletionModalOpen}
        completionWarnings={completionModalData?.warnings || []}
        videoCutMarkersToDelete={completionModalData?.videoCutMarkersToDelete || []}
        hasAiReviewedTag={completionModalData?.hasAiReviewedTag || false}
        primaryTagsToAdd={completionModalData?.primaryTagsToAdd || []}
        tagsToRemove={completionModalData?.tagsToRemove || []}
        onCancel={() => dispatch(closeModal())}
        onConfirm={executeCompletionWrapper}
      />
      {isCollectingModalOpen && scene?.id && (
        <IncorrectMarkerCollectionModal
          isOpen={isCollectingModalOpen}
          onClose={() =>
            dispatch(closeModal())
          }
          markers={incorrectMarkers}
          currentSceneId={scene.id}
          onRemoveMarker={(markerId) => {
            if (scene?.id) {
              incorrectMarkerStorage.removeIncorrectMarker(
                scene.id,
                markerId
              );
              dispatch(setIncorrectMarkers(incorrectMarkerStorage.getIncorrectMarkers(
                  scene.id
                )));
            }
          }}
          onConfirm={async () => {
            if (scene?.id) {
              incorrectMarkerStorage.clearIncorrectMarkers(scene.id);
              dispatch(setIncorrectMarkers([]));
            }
          }}
          refreshMarkersOnly={async () => {
            if (scene?.id) {
              await dispatch(loadMarkers(scene.id)).unwrap();
            }
          }}
        />
      )}
    </div>
  );
}
