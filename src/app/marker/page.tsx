"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import {
  stashappService,
  type Tag,
  type SceneMarker,
} from "../../services/StashappService";
import { KeyboardShortcutsModal } from "../components/KeyboardShortcutsModal";
import Timeline, { TimelineRef } from "../../components/Timeline";
import { VideoPlayer } from "../../components/marker/video/VideoPlayer";
import { MarkerWithTrack, TagGroup } from "../../core/marker/types";
import { AITagConversionModal } from "../components/AITagConversionModal";
import { MarkerPageHeader } from "../../components/marker/MarkerPageHeader";
import { MarkerSummary } from "../../components/marker/MarkerSummary";
import { MarkerList } from "../../components/marker/MarkerList";
import { CompletionModal } from "../../components/marker/CompletionModal";
import { DeleteRejectedModal } from "../../components/marker/DeleteRejectedModal";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { useMarkerNavigation } from "../../hooks/useMarkerNavigation";
import { useTimelineZoom } from "../../hooks/useTimelineZoom";
import { useMarkerOperations } from "../../hooks/useMarkerOperations";
import { useDynamicKeyboardShortcuts } from "../../hooks/useDynamicKeyboardShortcuts";
import {
  selectMarkers,
  selectScene,
  selectAvailableTags,
  selectSelectedMarkerId,
  selectFilteredSwimlane,
  selectIncorrectMarkers,
  selectVideoDuration,
  selectCurrentVideoTime,
  selectMarkerLoading,
  selectMarkerError,
  selectIsEditingMarker,
  selectIsCreatingMarker,
  selectIsDuplicatingMarker,
  selectIsDeletingRejected,
  selectIsAIConversionModalOpen,
  selectIsKeyboardShortcutsModalOpen,
  selectIsCollectingModalOpen,
  selectRejectedMarkers,
  selectConfirmedAIMarkers,
  setFilteredSwimlane,
  setSelectedMarkerId,
  clearError,
  setAvailableTags,
  setRejectedMarkers,
  setDeletingRejected,
  setAIConversionModalOpen,
  setCollectingModalOpen,
  setCreatingMarker,
  setDuplicatingMarker,
  setKeyboardShortcutsModalOpen,
  setMarkers,
  setIncorrectMarkers,
  setCurrentVideoTime,
  setVideoDuration,
  initializeMarkerPage,
  loadMarkers,
  updateMarkerTag,
  updateMarkerTimes,
  deleteMarker,
  seekToTime,
  setError
} from "../../store/slices/markerSlice";
import { selectMarkerShotBoundary, selectMarkerAiReviewed } from "../../store/slices/configSlice";
import Toast from "../components/Toast";
import { useRouter } from "next/navigation";
import { incorrectMarkerStorage } from "@/utils/incorrectMarkerStorage";
import { IncorrectMarkerCollectionModal } from "../components/IncorrectMarkerCollectionModal";
import {
  formatSeconds,
  isShotBoundaryMarker,
  filterUnprocessedMarkers,
  getMarkerStatus,
} from "../../core/marker/markerLogic";
import { MarkerStatus } from "../../core/marker/types";


// Add toast state type
type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

export default function MarkerPage() {
  const dispatch = useAppDispatch();
  
  // Redux selectors
  const markers = useAppSelector(selectMarkers);
  const markerShotBoundary = useAppSelector(selectMarkerShotBoundary);
  const markerAiReviewed = useAppSelector(selectMarkerAiReviewed);
  const scene = useAppSelector(selectScene);
  const availableTags = useAppSelector(selectAvailableTags);
  const selectedMarkerId = useAppSelector(selectSelectedMarkerId);
  const filteredSwimlane = useAppSelector(selectFilteredSwimlane);
  const incorrectMarkers = useAppSelector(selectIncorrectMarkers);
  const videoDuration = useAppSelector(selectVideoDuration);
  const currentVideoTime = useAppSelector(selectCurrentVideoTime);
  const isLoading = useAppSelector(selectMarkerLoading);
  const error = useAppSelector(selectMarkerError);
  const _isEditingMarker = useAppSelector(selectIsEditingMarker);
  const isCreatingMarker = useAppSelector(selectIsCreatingMarker);
  const isDuplicatingMarker = useAppSelector(selectIsDuplicatingMarker);
  const isDeletingRejected = useAppSelector(selectIsDeletingRejected);
  const isAIConversionModalOpen = useAppSelector(selectIsAIConversionModalOpen);
  const isKeyboardShortcutsModalOpen = useAppSelector(selectIsKeyboardShortcutsModalOpen);
  const isCollectingModalOpen = useAppSelector(selectIsCollectingModalOpen);
  const rejectedMarkers = useAppSelector(selectRejectedMarkers);
  const confirmedAIMarkers = useAppSelector(selectConfirmedAIMarkers);
  
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

  // Get shot boundaries sorted by time
  const getShotBoundaries = useCallback(() => {
    if (!markers) return [];
    return markers
      .filter(isShotBoundaryMarker)
      .sort((a, b) => a.seconds - b.seconds);
  }, [markers]);

  // Add state for tracking which marker is being edited
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string>("");

  // Add state for completion modal
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionWarnings, setCompletionWarnings] = useState<string[]>([]);
  const [aiTagsToRemove, setAiTagsToRemove] = useState<Tag[]>([]);
  const [primaryTagsToAdd, setPrimaryTagsToAdd] = useState<Tag[]>([]);
  const [hasAiReviewedTag, setHasAiReviewedTag] = useState(false);
  const [videoCutMarkersToDelete, setVideoCutMarkersToDelete] = useState<
    SceneMarker[]
  >([]);

  // Add state for swimlane data from Timeline
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [markersWithTracks, setMarkersWithTracks] = useState<MarkerWithTrack[]>(
    []
  );

  // Add state for marker merging
  const [copiedMarkerForMerge, setCopiedMarkerForMerge] = useState<SceneMarker | null>(null);

  // Timeline zoom functionality
  const {
    zoom,
    setZoom: _setZoom,
    timelineContainerRef,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useTimelineZoom(videoDuration);


  // Callback to receive swimlane data from Timeline component
  const handleSwimlaneDataUpdate = useCallback(
    (newTagGroups: TagGroup[], newMarkersWithTracks: MarkerWithTrack[]) => {
      setTagGroups(newTagGroups);
      setMarkersWithTracks(newMarkersWithTracks);
    },
    []
  );

  // Temporary handler - will be replaced after actionMarkers is defined
  const handleSwimlaneFilter = useCallback(
    (swimlaneName: string | null) => {
      dispatch(setFilteredSwimlane(swimlaneName));
    },
    [dispatch]
  );

  // videoRef removed - now handled in VideoPlayer component

  const fetchData = useCallback(async () => {
    const sceneId = new URL(window.location.href).searchParams.get("sceneId");
    if (!sceneId) {
      router.push("/search");
      return;
    }
    
    await dispatch(initializeMarkerPage(sceneId));
  }, [dispatch, router]);

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

  // Get action markers (non-shot boundary) for display and navigation
  const actionMarkers = useMemo(() => {
    if (!markers) {
      return [];
    }

    console.log(
      "Calculating action markers from",
      markers.length,
      "markers"
    );
    let filteredMarkers = markers.filter((marker) => {
      // Always include temp markers regardless of their primary tag
      if (marker.id.startsWith("temp-")) {
        return true;
      }
      // Filter out shot boundary markers for non-temp markers
      return !isShotBoundaryMarker(marker);
    });
    console.log(
      "After filtering shot boundaries:",
      filteredMarkers.length,
      "markers"
    );

    // Apply swimlane filter if active
    if (filteredSwimlane) {
      console.log("Applying swimlane filter:", filteredSwimlane);
      filteredMarkers = filteredMarkers.filter((marker) => {
        // Handle AI tag grouping - if the marker's tag name ends with "_AI",
        // group it with the base tag name for filtering
        const tagGroupName = marker.primary_tag.name.endsWith("_AI")
          ? marker.primary_tag.name.replace("_AI", "")
          : marker.primary_tag.name;
        return tagGroupName === filteredSwimlane;
      });
      console.log("After swimlane filter:", filteredMarkers.length, "markers");
    }

    console.log("Final action markers:", {
      count: filteredMarkers.length,
      firstFew: filteredMarkers.slice(0, 3).map((m) => ({
        id: m.id,
        tagId: m.primary_tag.id,
        tagName: m.primary_tag.name,
      })),
    });

    return filteredMarkers;
  }, [markers, filteredSwimlane]);

  // Keep getActionMarkers for backwards compatibility
  const getActionMarkers = useCallback(() => {
    return actionMarkers;
  }, [actionMarkers]);

  // Marker operations functionality
  const {
    splitCurrentMarker: splitCurrentMarkerFromHook,
    splitVideoCutMarker: splitVideoCutMarkerFromHook,
    copyMarkerTimes: copyMarkerTimesFromHook,
    pasteMarkerTimes: pasteMarkerTimesFromHook,
    handleDeleteRejectedMarkers: handleDeleteRejectedMarkersFromHook,
    confirmDeleteRejectedMarkers: confirmDeleteRejectedMarkersFromHook,
    handleAIConversion,
    handleConfirmAIConversion,
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

  // useMarkerOperations replaced with Redux thunks

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


  // confirmDeleteRejectedMarkers now comes from useMarkerOperations hook

  // handleAIConversion and handleConfirmAIConversion now come from useMarkerOperations hook

  // checkAllMarkersApproved now comes from useMarkerOperations hook

  // identifyAITagsToRemove now comes from useMarkerOperations hook

  // Handle completion button click
  const handleComplete = useCallback(async () => {
    const actionMarkers = getActionMarkers();
    if (!actionMarkers || actionMarkers.length === 0) return;

    const warnings: string[] = [];

    // Check if all markers are approved
    const unprocessedMarkers = filterUnprocessedMarkers(actionMarkers);
    if (unprocessedMarkers.length > 0) {
      warnings.push(
        `${unprocessedMarkers.length} marker(s) are not yet approved`
      );
    }

    // Get Video Cut markers (shot boundaries) to delete
    const videoCutMarkers = getShotBoundaries();
    console.log("=== Video Cut Markers to Delete ===");
    console.log(`Found ${videoCutMarkers.length} Video Cut markers`);
    videoCutMarkers.forEach((marker, index) => {
      console.log(
        `${index + 1}. ID: ${marker.id}, Title: ${
          marker.title
        }, Time: ${formatSeconds(marker.seconds, true)} - ${
          marker.end_seconds ? formatSeconds(marker.end_seconds, true) : "N/A"
        }, Tag: ${marker.primary_tag.name}`
      );
    });
    console.log("=== End Video Cut Markers ===");

    // Calculate AI tags to remove and primary tags to add for preview
    const confirmedMarkers = actionMarkers.filter((marker) =>
      [MarkerStatus.CONFIRMED].includes(
        getMarkerStatus(marker)
      )
    );

    let aiTagsToRemove: Tag[] = [];
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

        aiTagsToRemove = await identifyAITagsToRemove(confirmedMarkers);

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

    setCompletionWarnings(warnings);
    setAiTagsToRemove(aiTagsToRemove);
    setPrimaryTagsToAdd(primaryTagsToAdd);
    setHasAiReviewedTag(hasAiReviewedTagAlready);
    setVideoCutMarkersToDelete(videoCutMarkers);
    setIsCompletionModalOpen(true);
  }, [
    getActionMarkers,
    getShotBoundaries,
    scene,
    identifyAITagsToRemove,
    markerAiReviewed,
  ]);

  // executeCompletion now comes from useMarkerOperations hook
  // Create wrapper function to handle state dependencies
  const executeCompletionWrapper = useCallback(async () => {
    // Close modal when completion starts
    setIsCompletionModalOpen(false);
    
    // Call the hook's executeCompletion with the videoCutMarkersToDelete state
    await executeCompletion(videoCutMarkersToDelete);
  }, [executeCompletion, videoCutMarkersToDelete]);

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

      // When filtering is active, override tag to keep the marker visible
      if (filteredSwimlane && availableTags.length > 0) {
        // Check if current tag matches the filter
        const currentTagGroupName = selectedTag.name.endsWith("_AI")
          ? selectedTag.name.replace("_AI", "")
          : selectedTag.name;

        // If it doesn't match, find a tag that does
        if (currentTagGroupName !== filteredSwimlane) {
          const matchingTag = availableTags.find((tag) => {
            const tagGroupName = tag.name.endsWith("_AI")
              ? tag.name.replace("_AI", "")
              : tag.name;
            return tagGroupName === filteredSwimlane;
          });
          if (matchingTag) {
            selectedTag = matchingTag;
          }
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
      filteredSwimlane,
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

      // Don't select shot boundary markers
      if (marker.primary_tag.id === markerShotBoundary) {
        console.log("Prevented selection of shot boundary marker");
        return;
      }

      dispatch(setSelectedMarkerId(marker.id));
    },
    [dispatch, markerShotBoundary]
  );

  // Navigate to next/previous shot
  const jumpToNextShot = useCallback(() => {
    const shotBoundaries = getShotBoundaries();
    const nextShot = shotBoundaries.find(
      (shot) => shot.seconds > currentVideoTime + 0.1
    );

    if (nextShot) {
      dispatch(seekToTime(nextShot.seconds));
    }
  }, [getShotBoundaries, currentVideoTime, dispatch]);

  const jumpToPreviousShot = useCallback(() => {
    const shotBoundaries = getShotBoundaries();
    const previousShot = [...shotBoundaries]
      .reverse()
      .find((shot) => shot.seconds < currentVideoTime - 0.1);

    if (previousShot) {
      dispatch(seekToTime(previousShot.seconds));
    }
  }, [getShotBoundaries, currentVideoTime, dispatch]);

  // Center timeline on playhead
  const centerPlayhead = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.centerOnPlayhead();
    }
  }, []);

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
      .find((shot) => shot.seconds <= currentVideoTime);

    // Find next shot boundary (after current time)
    const nextShot = shotBoundaries
      .find((shot) => shot.seconds > currentVideoTime);

    let startTime: number;
    let endTime: number;

    // Frame duration at 30fps (1/30 second)
    const frameTime = 1 / 30;

    if (previousShot && nextShot) {
      // Between two shot boundaries - end one frame before next shot
      startTime = previousShot.seconds;
      endTime = nextShot.seconds - frameTime;
    } else if (previousShot && !nextShot) {
      // After last shot boundary - use previous shot to end of video
      startTime = previousShot.seconds;
      endTime = videoDuration || (currentVideoTime + 20);
    } else if (!previousShot && nextShot) {
      // Before first shot boundary - end one frame before next shot
      startTime = 0;
      endTime = nextShot.seconds - frameTime;
    } else {
      // No shot boundaries - fallback to current time + 20 seconds
      startTime = currentVideoTime;
      endTime = currentVideoTime + 20;
    }

    console.log("Creating shot boundary marker:", {
      startTime,
      endTime,
      previousShot: previousShot?.seconds,
      nextShot: nextShot?.seconds,
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

  // Use navigation hook
  const {
    findNextUnprocessedMarker,
    findPreviousUnprocessedMarker,
    findNextUnprocessedMarkerInSwimlane,
    findPreviousUnprocessedMarkerInSwimlane,
    findNextUnprocessedSwimlane,
    navigateBetweenSwimlanes,
    navigateWithinSwimlane,
  } = useMarkerNavigation({
    actionMarkers,
    markersWithTracks,
    tagGroups,
    selectedMarkerId,
    getActionMarkers,
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
    filteredSwimlane,
    incorrectMarkers,
    availableTags,
    videoDuration,
    currentVideoTime,
    isCompletionModalOpen,
    isDeletingRejected,
    videoElementRef,
    fetchData,
    handleCancelEdit,
    handleEditMarker,
    handleDeleteRejectedMarkers,
    splitCurrentMarker,
    splitVideoCutMarker,
    createOrDuplicateMarker,
    createShotBoundaryMarker,
    copyMarkerTimes,
    pasteMarkerTimes,
    copyMarkerForMerge,
    mergeMarkerProperties,
    jumpToNextShot,
    jumpToPreviousShot,
    executeCompletion: executeCompletionWrapper,
    confirmDeleteRejectedMarkers,
    showToast,
    navigateBetweenSwimlanes,
    navigateWithinSwimlane,
    findNextUnprocessedMarker,
    findPreviousUnprocessedMarker,
    findNextUnprocessedMarkerInSwimlane,
    findPreviousUnprocessedMarkerInSwimlane,
    findNextUnprocessedSwimlane,
    zoomIn,
    zoomOut,
    resetZoom,
    centerPlayhead,
  });

  // Effect to update selected marker when filtering changes to ensure it's valid
  useEffect(() => {
    if (actionMarkers.length > 0) {
      // Check if currently selected marker still exists after filtering
      const selectedMarker = actionMarkers.find(
        (m) => m.id === selectedMarkerId
      );
      if (!selectedMarker) {
        // If selected marker is not in filtered list, find next unprocessed marker
        // using the same algorithm as Shift+M for consistency
        const nextUnprocessedId = findNextUnprocessedSwimlane();
        if (nextUnprocessedId) {
          dispatch(setSelectedMarkerId(nextUnprocessedId));
        } else {
          // Fallback to first marker if no unprocessed markers found
          dispatch(setSelectedMarkerId(actionMarkers[0].id));
        }
      }
    } else {
      // If no markers after filtering, clear selection
      dispatch(setSelectedMarkerId(null));
    }
  }, [actionMarkers, selectedMarkerId, dispatch, findNextUnprocessedSwimlane]);


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
        onOpenCollectModal={() => dispatch(setCollectingModalOpen(true))}
        onAIConversion={handleAIConversion}
        onComplete={handleComplete}
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
                  filteredSwimlane={filteredSwimlane}
                  markerSummary={getMarkerSummary()}
                  shotBoundariesCount={getShotBoundaries().length}
                  markers={markers}
                  isCreatingMarker={isCreatingMarker}
                  isDuplicatingMarker={isDuplicatingMarker}
                  selectedMarkerId={selectedMarkerId}
                  onClearFilter={() => handleSwimlaneFilter(null)}
                  onCreateMarker={handleCreateMarker}
                  onSplitMarker={() => splitCurrentMarker()}
                  onShowShortcuts={() => dispatch(setKeyboardShortcutsModalOpen(true))}
                  getActionMarkers={getActionMarkers}
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
                    getActionMarkers={getActionMarkers}
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
                selectedMarkerId={selectedMarkerId}
                videoDuration={videoDuration || 0}
                currentTime={currentVideoTime}
                onMarkerClick={handleMarkerClick}
                onSwimlaneDataUpdate={handleSwimlaneDataUpdate}
                filteredSwimlane={filteredSwimlane}
                onSwimlaneFilter={handleSwimlaneFilter}
                scene={scene}
                zoom={zoom}
              />
            </div>
          </>
        )}
      </div>

      <DeleteRejectedModal
        isOpen={isDeletingRejected}
        rejectedMarkers={rejectedMarkers}
        onCancel={() => {
          dispatch(setDeletingRejected(false));
          dispatch(setRejectedMarkers([]));
        }}
        onConfirm={confirmDeleteRejectedMarkers}
      />

      <AITagConversionModal
        isOpen={isAIConversionModalOpen}
        onClose={() =>
          dispatch(setAIConversionModalOpen(false))
        }
        markers={confirmedAIMarkers}
        onConfirm={handleConfirmAIConversion}
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
          dispatch(setKeyboardShortcutsModalOpen(false))
        }
      />

      {/* Completion Modal */}
      <CompletionModal
        isOpen={isCompletionModalOpen}
        completionWarnings={completionWarnings}
        videoCutMarkersToDelete={videoCutMarkersToDelete}
        hasAiReviewedTag={hasAiReviewedTag}
        primaryTagsToAdd={primaryTagsToAdd}
        aiTagsToRemove={aiTagsToRemove}
        onCancel={() => setIsCompletionModalOpen(false)}
        onConfirm={executeCompletionWrapper}
      />
      {isCollectingModalOpen && scene?.id && (
        <IncorrectMarkerCollectionModal
          isOpen={isCollectingModalOpen}
          onClose={() =>
            dispatch(setCollectingModalOpen(false))
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
