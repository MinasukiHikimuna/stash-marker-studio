"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import {
  stashappService,
  type Tag,
  type SceneMarker,
} from "../../services/StashappService";
import { KeyboardShortcutsModal } from "../components/KeyboardShortcutsModal";
import Timeline from "../../components/Timeline";
import { VideoPlayer } from "../../components/marker/video/VideoPlayer";
import { MarkerWithTrack, TagGroup } from "../../core/marker/types";
import { AITagConversionModal } from "../components/AITagConversionModal";
import { TagAutocomplete } from "../../components/marker/TagAutocomplete";
import { TempMarkerForm } from "../../components/marker/TempMarkerForm";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { useMarkerKeyboardShortcuts } from "../../hooks/useMarkerKeyboardShortcuts";
import { useMarkerNavigation } from "../../hooks/useMarkerNavigation";
import { useTimelineZoom } from "../../hooks/useTimelineZoom";
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
  selectCopiedMarkerTimes,
  setFilteredSwimlane,
  setSelectedMarkerId,
  clearError,
  setAvailableTags,
  setRejectedMarkers,
  setDeletingRejected,
  setConfirmedAIMarkers,
  setAIConversionModalOpen,
  setCollectingModalOpen,
  setCreatingMarker,
  setDuplicatingMarker,
  setKeyboardShortcutsModalOpen,
  setMarkers,
  setIncorrectMarkers,
  setCopiedMarkerTimes,
  setCurrentVideoTime,
  setVideoDuration,
  initializeMarkerPage,
  loadMarkers,
  createMarker,
  splitMarker,
  updateMarkerTimes,
  updateMarkerTag,
  seekToTime,
  pauseVideo,
  setError
} from "../../store/slices/markerSlice";
import { useConfig } from "@/contexts/ConfigContext";
import Toast from "../components/Toast";
import { useRouter } from "next/navigation";
import { incorrectMarkerStorage } from "@/utils/incorrectMarkerStorage";
import { IncorrectMarkerCollectionModal } from "../components/IncorrectMarkerCollectionModal";
import {
  formatSeconds,
  isMarkerConfirmed,
  isMarkerRejected,
  isShotBoundaryMarker,
  filterUnprocessedMarkers,
  getMarkerStatus,
  calculateMarkerSummary,
} from "../../core/marker/markerLogic";
import { MarkerStatus } from "../../core/marker/types";

// Add this type definition at the top of the file
type MarkerSummary = {
  confirmed: number;
  rejected: number;
  unknown: number;
};

// Add toast state type
type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

function MarkerPageContent() {
  const dispatch = useAppDispatch();
  
  // Redux selectors
  const markers = useAppSelector(selectMarkers);
  const scene = useAppSelector(selectScene);
  const availableTags = useAppSelector(selectAvailableTags);
  const selectedMarkerId = useAppSelector(selectSelectedMarkerId);
  const filteredSwimlane = useAppSelector(selectFilteredSwimlane);
  const incorrectMarkers = useAppSelector(selectIncorrectMarkers);
  const videoDuration = useAppSelector(selectVideoDuration);
  const currentVideoTime = useAppSelector(selectCurrentVideoTime);
  const isLoading = useAppSelector(selectMarkerLoading);
  const error = useAppSelector(selectMarkerError);
  const isEditingMarker = useAppSelector(selectIsEditingMarker);
  const isCreatingMarker = useAppSelector(selectIsCreatingMarker);
  const isDuplicatingMarker = useAppSelector(selectIsDuplicatingMarker);
  const isDeletingRejected = useAppSelector(selectIsDeletingRejected);
  const isAIConversionModalOpen = useAppSelector(selectIsAIConversionModalOpen);
  const isKeyboardShortcutsModalOpen = useAppSelector(selectIsKeyboardShortcutsModalOpen);
  const isCollectingModalOpen = useAppSelector(selectIsCollectingModalOpen);
  const rejectedMarkers = useAppSelector(selectRejectedMarkers);
  const confirmedAIMarkers = useAppSelector(selectConfirmedAIMarkers);
  const copiedMarkerTimes = useAppSelector(selectCopiedMarkerTimes);
  
  const markerListRef = useRef<HTMLDivElement>(null);
  // Temporary ref for video element compatibility - can be removed when VideoPlayer fully handles all video interactions
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();
  const { STASH_URL } = useConfig(); // STASH_API_KEY removed - now handled in VideoPlayer

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

  // Timeline zoom functionality
  const {
    zoom,
    setZoom,
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

  // Effect to update selected marker when filtering changes to ensure it's valid
  useEffect(() => {
    if (actionMarkers.length > 0) {
      // Check if currently selected marker still exists after filtering
      const selectedMarker = actionMarkers.find(
        (m) => m.id === selectedMarkerId
      );
      if (!selectedMarker) {
        // If selected marker is not in filtered list, select the first marker
        dispatch(setSelectedMarkerId(actionMarkers[0].id));
      }
    } else {
      // If no markers after filtering, clear selection
      dispatch(setSelectedMarkerId(null));
    }
  }, [actionMarkers, selectedMarkerId, dispatch]);

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
      dispatch(setSelectedMarkerId(currentMarker.id));
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

      // Determine tag to use for the temporary marker
      let selectedTag: Tag;
      if (isDuplicate) {
        selectedTag = sourceMarker.primary_tag;
      } else {
        // For new markers, use the first available tag as placeholder
        selectedTag = availableTags[0] || { id: "", name: "Select Tag" };
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

      // Insert the temporary marker at the correct chronological position
      const updatedMarkers = [...(markers || []), tempMarker].sort(
        (a, b) => a.seconds - b.seconds
      );

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
      currentVideoTime,
      markers,
      dispatch,
    ]
  );

  // Convenience wrapper for creating new markers
  const handleCreateMarker = useCallback(() => {
    createOrDuplicateMarker();
  }, [createOrDuplicateMarker]);

  // Update calculateMarkerSummary to use imported functions
  const getMarkerSummary = useCallback((): MarkerSummary => {
    const actionMarkers = getActionMarkers();
    if (!actionMarkers.length) return { confirmed: 0, rejected: 0, unknown: 0 };

    return calculateMarkerSummary(actionMarkers);
  }, [getActionMarkers]);

  // Update handleDeleteRejectedMarkers to use imported function
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
      [MarkerStatus.CONFIRMED, MarkerStatus.MANUAL].includes(
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
        const aiReviewedTagId = stashappService.MARKER_AI_REVIEWED;
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
  ]);

  // Execute the completion process
  const executeCompletion = useCallback(async () => {
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
      // const sceneData = {
      //   id: scene.id,
      //   title: scene.title,
      //   paths: {
      //     preview: "",
      //     vtt: "",
      //     sprite: "",
      //     screenshot: "",
      //   },
      //   tags: [],
      //   performers: [],
      // };

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
    } finally {
      // Loading state is managed by async thunks
      setIsCompletionModalOpen(false);
    }
  }, [
    getActionMarkers,
    videoCutMarkersToDelete,
    scene,
    identifyAITagsToRemove,
    dispatch,
  ]);

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
      if (marker.primary_tag.id === stashappService.MARKER_SHOT_BOUNDARY) {
        console.log("Prevented selection of shot boundary marker");
        return;
      }

      dispatch(setSelectedMarkerId(marker.id));
    },
    [dispatch]
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

  // Use navigation hook
  const {
    findNextUnprocessedMarker,
    findPreviousUnprocessedMarker,
    findNextUnprocessedMarkerInSwimlane,
    findPreviousUnprocessedMarkerInSwimlane,
    navigateChronologically,
    navigateBetweenSwimlanes,
    navigateWithinSwimlane,
  } = useMarkerNavigation({
    actionMarkers,
    markersWithTracks,
    tagGroups,
    selectedMarkerId,
    getActionMarkers,
  });


  // Use keyboard shortcuts hook
  useMarkerKeyboardShortcuts({
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
    handleCreateMarker,
    handleEditMarker,
    handleDeleteRejectedMarkers,
    splitCurrentMarker,
    splitVideoCutMarker,
    createOrDuplicateMarker,
    copyMarkerTimes,
    pasteMarkerTimes,
    jumpToNextShot,
    jumpToPreviousShot,
    executeCompletion,
    confirmDeleteRejectedMarkers,
    showToast,
    navigateBetweenSwimlanes,
    navigateChronologically,
    navigateWithinSwimlane,
    findNextUnprocessedMarker,
    findPreviousUnprocessedMarker,
    findNextUnprocessedMarkerInSwimlane,
    findPreviousUnprocessedMarkerInSwimlane,
    zoomIn,
    zoomOut,
    resetZoom,
  });

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
      {/* Header Section */}
      <div className="bg-gray-900 text-white px-6 py-4 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">
                {scene ? scene.title : "Scene Markers"}
              </h1>
              {scene && (
                <a
                  href={`${STASH_URL}/scenes/${scene.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  View in Stash ↗
                </a>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => router.push("/search")}
                className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors"
                title="Switch to a different scene"
              >
                Switch Scene
              </button>
              <button
                onClick={handleDeleteRejectedMarkers}
                disabled={
                  isLoading || !markers?.some(isMarkerRejected)
                }
                title="Delete All Rejected Markers"
                className="bg-red-500 hover:bg-red-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors"
              >
                Delete Rejected
              </button>
              <button
                onClick={() =>
                  dispatch(setCollectingModalOpen(true))
                }
                className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors
                  ${
                    incorrectMarkers.length > 0
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-gray-600"
                  } text-white`}
                disabled={incorrectMarkers.length === 0}
              >
                Collect AI Feedback{" "}
                {incorrectMarkers.length > 0 &&
                  `(${incorrectMarkers.length})`}
              </button>
              <button
                onClick={handleAIConversion}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-sm text-sm transition-colors"
              >
                Convert AI Tags
              </button>
              <button
                onClick={handleComplete}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                  !checkAllMarkersApproved()
                    ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
                } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                title={
                  !checkAllMarkersApproved()
                    ? "Complete scene (some markers not approved - warnings will be shown)"
                    : "Complete scene (generate markers, mark as reviewed, and clean up AI tags)"
                }
              >
                {!checkAllMarkersApproved() ? "⚠️ Complete" : "Complete"}
              </button>
            </div>
          </div>
          <div className="flex items-center">
            {/* Space reserved for hamburger menu */}
            <div className="w-10"></div>
          </div>
        </div>
      </div>

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
                {/* Sticky marker summary */}
                <div
                  className="bg-gray-700 p-4 mb-4 rounded-none flex items-center justify-between sticky top-0 z-10"
                  data-testid="marker-summary"
                >
                  <div className="flex items-center space-x-4">
                    {filteredSwimlane && (
                      <div className="flex items-center bg-yellow-600 text-yellow-100 px-2 py-1 rounded-sm text-xs">
                        <span className="mr-1">🔍</span>
                        <span>Filtered: {filteredSwimlane}</span>
                        <button
                          onClick={() => handleSwimlaneFilter(null)}
                          className="ml-2 text-yellow-200 hover:text-white"
                          title="Clear filter"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <div className="flex items-center">
                      <span className="text-green-400 mr-1">✓</span>
                      <span className="text-white">
                        {getMarkerSummary().confirmed}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-red-400 mr-1">✗</span>
                      <span className="text-white">
                        {getMarkerSummary().rejected}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-yellow-400 mr-1">?</span>
                      <span className="text-white">
                        {getMarkerSummary().unknown}
                      </span>
                    </div>
                    {getShotBoundaries().length > 0 && (
                      <div className="flex items-center">
                        <span className="text-gray-400 mr-1">🎥</span>
                        <span className="text-white text-xs">
                          {getShotBoundaries().length} shots
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Compact marker action buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCreateMarker}
                      disabled={
                        isCreatingMarker ||
                        isDuplicatingMarker ||
                        markers.some((m) => m.id.startsWith("temp-"))
                      }
                      title="Create New Marker (A)"
                      className={`px-2 py-1 rounded-sm text-xs flex items-center ${
                        isCreatingMarker ||
                        isDuplicatingMarker ||
                        markers.some((m) => m.id.startsWith("temp-"))
                          ? "bg-gray-500 cursor-not-allowed text-gray-300"
                          : "bg-green-500 hover:bg-green-700 text-white"
                      }`}
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3m0 0v3m0-3h3m-3 0H9m9 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      New
                    </button>
                    <button
                      onClick={() => splitCurrentMarker()}
                      title="Split Current Marker (S)"
                      className="bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded-sm text-xs flex items-center"
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 6h16M4 12h8m-8 6h16"
                        />
                      </svg>
                      Split
                    </button>
                    <button
                      onClick={() => {
                        const actionMarkers = getActionMarkers();
                        const currentMarker = actionMarkers.find(
                          (m) => m.id === selectedMarkerId
                        );
                        if (!currentMarker) {
                          console.log(
                            "Cannot duplicate marker: No current marker found"
                          );
                          return;
                        }
                        createOrDuplicateMarker(currentMarker);
                      }}
                      disabled={
                        isCreatingMarker ||
                        isDuplicatingMarker ||
                        markers.some((m) => m.id.startsWith("temp-"))
                      }
                      title="Duplicate Current Marker (D)"
                      className={`px-2 py-1 rounded-sm text-xs flex items-center ${
                        isCreatingMarker ||
                        isDuplicatingMarker ||
                        markers.some((m) => m.id.startsWith("temp-"))
                          ? "bg-gray-500 cursor-not-allowed text-gray-300"
                          : "bg-indigo-500 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <rect
                          x="1"
                          y="1"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                      </svg>
                      Duplicate
                    </button>
                  </div>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() =>
                        dispatch(setKeyboardShortcutsModalOpen(true))
                      }
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-sm text-sm transition-colors flex items-center space-x-1"
                      title="Show keyboard shortcuts"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                        />
                      </svg>
                      <span>Shortcuts</span>
                    </button>
                  </div>
                </div>
                {/* Scrollable marker list - now with grow to push edit section to bottom */}
                <div
                  ref={markerListRef}
                  className="overflow-y-auto flex-1 px-4 min-h-0"
                  data-testid="marker-list"
                >
                  {getActionMarkers().length === 0 ? (
                    <div className="text-gray-400 text-center py-4">
                      No markers
                    </div>
                  ) : (
                    getActionMarkers().map((marker: SceneMarker) => {
                      const isEditing = editingMarkerId === marker.id;
                      const isSelected = marker.id === selectedMarkerId;
                      const isTemp =
                        marker.id === "temp-new" ||
                        marker.id === "temp-duplicate";

                      return (
                        <div
                          key={marker.id}
                          data-marker-id={marker.id}
                          className={`p-2 border-l-4 ${
                            isTemp
                              ? "bg-blue-800 border-blue-400"
                              : isSelected
                              ? "bg-gray-700 text-white border-blue-500"
                              : incorrectMarkers.some(
                                  (m) => m.markerId === marker.id
                                )
                              ? "bg-purple-900/50 border-purple-500 hover:bg-purple-800"
                              : "hover:bg-gray-600 hover:text-white border-transparent"
                          }`}
                          onClick={() => handleMarkerClick(marker)}
                          onMouseEnter={() => {}}
                          onMouseLeave={() => {}}
                        >
                          {isTemp ? (
                            <TempMarkerForm
                              marker={marker}
                              availableTags={availableTags}
                              videoElement={videoElementRef.current}
                              onSave={async (newStart, newEnd, newTagId) => {
                                try {
                                  const isDuplicating = marker.id === "temp-duplicate";
                                  
                                  // Remove temp markers first
                                  const realMarkers = markers.filter(
                                    (m) => !m.id.startsWith("temp-")
                                  );
                                  dispatch(setMarkers(realMarkers));

                                  // Create marker using Redux thunk
                                  let result;
                                  if (isDuplicating) {
                                    // For duplication, we need the source marker ID
                                    // Since this is a temp marker, we don't have the original source ID
                                    // We'll use createMarker instead
                                    result = await dispatch(createMarker({
                                      sceneId: marker.scene.id,
                                      startTime: newStart,
                                      endTime: newEnd ?? null,
                                      tagId: newTagId,
                                    }));
                                  } else {
                                    result = await dispatch(createMarker({
                                      sceneId: marker.scene.id,
                                      startTime: newStart,
                                      endTime: newEnd ?? null,
                                      tagId: newTagId,
                                    }));
                                  }

                                  // On success, select the new marker
                                  if (createMarker.fulfilled.match(result)) {
                                    const newMarkerId = result.payload.id;
                                    dispatch(setSelectedMarkerId(newMarkerId));
                                  }

                                  // Clear UI flags
                                  dispatch(setCreatingMarker(false));
                                  dispatch(setDuplicatingMarker(false));
                                } catch (error) {
                                  console.error("Error creating marker:", error);
                                  dispatch(setError(`Failed to create marker: ${error}`));

                                  // Clean up on error - remove temp markers and clear flags
                                  const realMarkers = markers.filter(
                                    (m) => !m.id.startsWith("temp-")
                                  );
                                  dispatch(setMarkers(realMarkers));
                                  dispatch(setCreatingMarker(false));
                                  dispatch(setDuplicatingMarker(false));
                                }
                              }}
                              onCancel={() => {
                                // Remove temp marker
                                const realMarkers = markers.filter(
                                  (m) => !m.id.startsWith("temp-")
                                );
                                dispatch(setMarkers(realMarkers));
                                // Reset selected marker to first marker
                                const actionMarkers = getActionMarkers();
                                if (actionMarkers.length > 0) {
                                  dispatch(setSelectedMarkerId(actionMarkers[0].id));
                                } else {
                                  dispatch(setSelectedMarkerId(null));
                                }
                                dispatch(setCreatingMarker(false));
                                dispatch(setDuplicatingMarker(false));
                              }}
                              isDuplicate={marker.id === "temp-duplicate"}
                            />
                          ) : (
                            <div className="flex items-center justify-between">
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() =>
                                  !isEditing && handleMarkerClick(marker)
                                }
                              >
                                <div className="flex items-center">
                                  {isMarkerRejected(marker) && (
                                    <span className="text-red-500 mr-2">✗</span>
                                  )}
                                  {!isMarkerRejected(marker) &&
                                    isMarkerConfirmed(marker) && (
                                      <span className="text-green-500 mr-2">
                                        ✓
                                      </span>
                                    )}
                                  {!isMarkerRejected(marker) &&
                                    !isMarkerConfirmed(marker) && (
                                      <span className="text-yellow-500 mr-2">
                                        ?
                                      </span>
                                    )}

                                  {isEditing ? (
                                    <div className="flex items-center space-x-2 flex-1">
                                      <TagAutocomplete
                                        value={editingTagId}
                                        onChange={setEditingTagId}
                                        availableTags={availableTags}
                                        placeholder="Type to search tags..."
                                        className="flex-1"
                                        autoFocus={isEditing}
                                        onSave={(tagId) =>
                                          void handleSaveEditWithTagId(
                                            marker,
                                            tagId
                                          )
                                        }
                                        onCancel={handleCancelEdit}
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-bold mr-2">
                                        {marker.primary_tag.name}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        {marker.end_seconds
                                          ? `${formatSeconds(
                                              marker.seconds,
                                              true
                                            )} - ${formatSeconds(
                                              marker.end_seconds,
                                              true
                                            )}`
                                          : formatSeconds(marker.seconds, true)}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {!isEditing && (
                                  <p className="text-xs mt-1 text-gray-600">
                                    {marker.tags
                                      .filter(
                                        (tag) =>
                                          tag.id !==
                                            stashappService.MARKER_STATUS_CONFIRMED &&
                                          tag.id !==
                                            stashappService.MARKER_STATUS_REJECTED
                                      )
                                      .map((tag) => tag.name)
                                      .join(", ")}
                                  </p>
                                )}
                              </div>
                              {!isEditing && (
                                <div className="flex items-center space-x-1 ml-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditMarker(marker);
                                    }}
                                    className="text-gray-400 hover:text-white p-1"
                                    title="Edit marker (Q)"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="w-2/3 p-6 flex flex-col min-h-0">
                <VideoPlayer className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Timeline spans full width below the video/marker layout */}
            <div
              ref={timelineContainerRef}
              className="border-t border-gray-300 flex-shrink-0"
            >
              <Timeline
                markers={markers || []}
                actionMarkers={actionMarkers}
                selectedMarker={
                  actionMarkers &&
                  actionMarkers.length > 0 &&
                  selectedMarkerId
                    ? actionMarkers.find(
                        (m) => m.id === selectedMarkerId
                      ) || null
                    : null
                }
                selectedMarkerId={selectedMarkerId}
                videoDuration={videoDuration || 0}
                currentTime={currentVideoTime}
                onMarkerClick={handleMarkerClick}
                isCreatingMarker={false}
                newMarkerStartTime={null}
                newMarkerEndTime={null}
                isEditingMarker={isEditingMarker}
                onSwimlaneDataUpdate={handleSwimlaneDataUpdate}
                filteredSwimlane={filteredSwimlane}
                onSwimlaneFilter={handleSwimlaneFilter}
                scene={scene}
                zoom={zoom}
                onZoomChange={setZoom}
              />
            </div>
          </>
        )}
      </div>

      {isDeletingRejected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
            <h3 className="text-xl font-bold mb-4">Delete Rejected Markers</h3>
            <p className="mb-4">The following markers will be deleted:</p>
            <div className="max-h-96 overflow-y-auto mb-4">
              {rejectedMarkers.map((marker) => (
                <div
                  key={marker.id}
                  className="flex items-center justify-between p-2 bg-gray-700 rounded-sm mb-2"
                >
                  <div>
                    <span className="font-bold">{marker.primary_tag.name}</span>
                    <span className="text-sm text-gray-400 ml-2">
                      {marker.end_seconds
                        ? `${formatSeconds(
                            marker.seconds,
                            true
                          )} - ${formatSeconds(marker.end_seconds, true)}`
                        : formatSeconds(marker.seconds, true)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">
                Press{" "}
                <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
                  Enter
                </kbd>{" "}
                or{" "}
                <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Y</kbd>{" "}
                to confirm,{" "}
                <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
                  Esc
                </kbd>{" "}
                or{" "}
                <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">N</kbd>{" "}
                to cancel
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    dispatch(setDeletingRejected(false));
                    dispatch(setRejectedMarkers([]));
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteRejectedMarkers}
                  className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded-sm"
                >
                  Delete {rejectedMarkers.length} Marker
                  {rejectedMarkers.length !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
      {isCompletionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
            <h3 className="text-xl font-bold mb-4">
              Complete Scene Processing
            </h3>

            {completionWarnings.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-900 border border-yellow-600 rounded">
                <h4 className="font-semibold text-yellow-200 mb-2">
                  ⚠️ Warnings:
                </h4>
                <ul className="text-yellow-100 text-sm">
                  {completionWarnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-4">
              <p className="mb-3">This will perform the following actions:</p>
              <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                <li>
                  Delete Video Cut markers
                  {videoCutMarkersToDelete.length > 0 ? (
                    <span className="text-red-300">
                      {" "}
                      ({videoCutMarkersToDelete.length} marker
                      {videoCutMarkersToDelete.length !== 1 ? "s" : ""})
                    </span>
                  ) : (
                    <span className="text-gray-500"> (none found)</span>
                  )}
                </li>
                <li>Generate markers (screenshots and previews)</li>
                <li>
                  Add &quot;AI_Reviewed&quot; tag to the scene
                  {hasAiReviewedTag ? (
                    <span className="text-gray-400"> (already present)</span>
                  ) : (
                    <span className="text-green-300"> (will be added)</span>
                  )}
                </li>
                <li>
                  Add tags from confirmed markers to the scene
                  {primaryTagsToAdd.length > 0 ? (
                    <span className="text-green-300">
                      {" "}
                      ({primaryTagsToAdd.length} new tag
                      {primaryTagsToAdd.length !== 1 ? "s" : ""})
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      {" "}
                      (all already present)
                    </span>
                  )}
                </li>
                <li>
                  Remove corresponding AI tags from the scene
                  {aiTagsToRemove.length > 0 ? (
                    <span className="text-red-300">
                      {" "}
                      ({aiTagsToRemove.length} tag
                      {aiTagsToRemove.length !== 1 ? "s" : ""})
                    </span>
                  ) : (
                    <span className="text-gray-500"> (none found)</span>
                  )}
                </li>
                <li className="text-xs text-gray-400 ml-4">
                  Note: Opens browser console for detailed logging of Video Cut
                  marker deletion and AI tag removal
                </li>
              </ul>

              {primaryTagsToAdd.length > 0 && (
                <div className="mt-4 p-3 bg-green-900/30 border border-green-600/50 rounded">
                  <h4 className="font-semibold text-green-200 mb-2">
                    ✅ New primary tags from the markers to be added to the
                    scene:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {primaryTagsToAdd.map((tag) => (
                      <span
                        key={`add-${tag.id}`}
                        className="px-2 py-1 bg-green-800/50 text-green-200 rounded-sm text-xs font-mono"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {primaryTagsToAdd.length === 0 && hasAiReviewedTag && (
                <div className="mt-4 p-3 bg-gray-900/30 border border-gray-600/50 rounded">
                  <h4 className="font-semibold text-gray-300 mb-2">
                    ℹ️ No new tags to add
                  </h4>
                  <p className="text-gray-400 text-sm">
                    All primary tags from confirmed markers and the AI_Reviewed
                    tag are already present on the scene.
                  </p>
                </div>
              )}

              {aiTagsToRemove.length > 0 && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-600/50 rounded">
                  <h4 className="font-semibold text-red-200 mb-2">
                    🗑️ AI tags to be removed from the scene:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {aiTagsToRemove.map((tag) => (
                      <span
                        key={`remove-${tag.id}`}
                        className="px-2 py-1 bg-red-800/50 text-red-200 rounded-sm text-xs font-mono"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">
                Press{" "}
                <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
                  Enter
                </kbd>{" "}
                or{" "}
                <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Y</kbd>{" "}
                to proceed,{" "}
                <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
                  Esc
                </kbd>{" "}
                or{" "}
                <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">N</kbd>{" "}
                to cancel
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => setIsCompletionModalOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={executeCompletion}
                  className={`px-4 py-2 rounded-sm font-medium ${
                    completionWarnings.length > 0
                      ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  {completionWarnings.length > 0
                    ? "Proceed Anyway"
                    : "Complete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

export default function MarkerPage() {
  return <MarkerPageContent />;
}

