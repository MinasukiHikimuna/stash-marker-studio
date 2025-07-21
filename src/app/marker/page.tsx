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
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import {
  selectMarkers,
  selectScene,
  selectAvailableTags,
  // selectSceneId,  // TODO: Use if needed
  // selectSceneTitle,  // TODO: Use if needed
  selectSelectedMarkerId,
  selectFilteredSwimlane,
  selectIncorrectMarkers,
  selectVideoDuration,
  selectCurrentVideoTime,
  selectMarkerLoading,
  selectMarkerError,
  // selectMarkerInitialized,  // TODO: Use for conditional rendering
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
  // clearError, // TODO: Use for error handling
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
  confirmMarker,
  rejectMarker,
  resetMarker,
  loadMarkers,
  splitMarker,
  seekToTime,
  playVideo,
  pauseVideo,
  togglePlayPause
} from "../../store/slices/markerSlice";
import { useConfig } from "@/contexts/ConfigContext";
import Toast from "../components/Toast";
import { useRouter } from "next/navigation";
import { incorrectMarkerStorage } from "@/utils/incorrectMarkerStorage";
import { IncorrectMarkerCollectionModal } from "../components/IncorrectMarkerCollectionModal";
import {
  formatSeconds,
  formatTimeColonDot,
  parseTimeColonDot,
  isMarkerConfirmed,
  isMarkerRejected,
  isShotBoundaryMarker,
  isUnprocessed,
  filterUnprocessedMarkers,
  getMarkerStatus,
  calculateMarkerSummary,
} from "../../core/marker/markerLogic";
import { MarkerStatus } from "../../core/marker/types";
// TODO: Remove useMarkerOperations after Phase 4 migration

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
  // const sceneId = useAppSelector(selectSceneId);  // TODO: Use if needed
  // const sceneTitle = useAppSelector(selectSceneTitle);  // TODO: Use if needed
  const availableTags = useAppSelector(selectAvailableTags);
  const selectedMarkerId = useAppSelector(selectSelectedMarkerId);
  const filteredSwimlane = useAppSelector(selectFilteredSwimlane);
  const incorrectMarkers = useAppSelector(selectIncorrectMarkers);
  const videoDuration = useAppSelector(selectVideoDuration);
  const currentVideoTime = useAppSelector(selectCurrentVideoTime);
  const isLoading = useAppSelector(selectMarkerLoading);
  const error = useAppSelector(selectMarkerError);
  // const initialized = useAppSelector(selectMarkerInitialized);  // TODO: Use for conditional rendering
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
  // TODO: Remove videoElement ref after full Redux migration is complete
  // This is temporary to maintain compatibility during migration
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

  // Add zoom state
  const [zoom, setZoom] = useState(1);
  const [timelineContainerWidth, setTimelineContainerWidth] = useState(0);

  // Timeline container ref for fit-to-window functionality
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Track timeline container width for fit-to-window
  useEffect(() => {
    if (!timelineContainerRef.current) {
      // Fallback: use window width minus estimated sidebar and padding
      const fallbackWidth = window.innerWidth - 192 - 48; // sidebar + padding
      setTimelineContainerWidth(fallbackWidth);
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setTimelineContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(timelineContainerRef.current);

    // Also set initial width
    const initialWidth = timelineContainerRef.current.clientWidth;
    if (initialWidth > 0) {
      setTimelineContainerWidth(initialWidth);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Additional fallback: listen for window resize to update container width estimate
  useEffect(() => {
    const handleWindowResize = () => {
      if (!timelineContainerRef.current) {
        const fallbackWidth = window.innerWidth - 192 - 48; // sidebar + padding
        console.log("Window resize fallback, setting width to:", fallbackWidth);
        setTimelineContainerWidth(fallbackWidth);
      }
    };

    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  // Set up ResizeObserver to track container width
  useEffect(() => {
    const updateContainerWidth = () => {
      if (timelineContainerRef.current) {
        const width = timelineContainerRef.current.offsetWidth;
        console.log("Container width from ref:", width);
        setTimelineContainerWidth(width);
      } else {
        // Fallback calculation
        const fallbackWidth = window.innerWidth - 192 - 48;
        console.log("Using fallback width calculation:", {
          windowInnerWidth: window.innerWidth,
          fallbackWidth: fallbackWidth,
          calculation: `${window.innerWidth} - 192 - 48 = ${fallbackWidth}`,
        });
        setTimelineContainerWidth(fallbackWidth);
      }
    };

    updateContainerWidth();

    const observer = new ResizeObserver(updateContainerWidth);
    if (timelineContainerRef.current) {
      observer.observe(timelineContainerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

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

  // Calculate fit-to-window zoom level
  const calculateFitZoom = useCallback(() => {
    if (videoDuration && videoDuration > 0 && timelineContainerWidth > 0) {
      // Base timeline width at 1x zoom is 300px per minute
      const basePixelsPerMinute = 300;
      const totalMinutes = videoDuration / 60;
      const baseTimelineWidth = totalMinutes * basePixelsPerMinute;

      // The timelineContainerWidth already accounts for sidebar being outside
      // We just need some padding for scrollbars and margins
      const availableWidth = timelineContainerWidth - 32; // Reduced padding for better fit
      const fitZoom = Math.max(
        0.01, // Very low minimum to allow extreme zoom out if needed
        Math.min(10, availableWidth / baseTimelineWidth)
      );

      // Temporary debugging
      console.log("FIT-TO-WINDOW DEBUG (FIXED):", {
        videoDuration: videoDuration,
        totalMinutes: totalMinutes.toFixed(2),
        baseTimelineWidth: baseTimelineWidth.toFixed(0),
        timelineContainerWidth: timelineContainerWidth,
        padding: 32,
        availableWidth: availableWidth,
        calculatedFitZoom: fitZoom.toFixed(3),
        expectedTimelineWidth: (baseTimelineWidth * fitZoom).toFixed(0),
        windowInnerWidth: window.innerWidth,
      });

      return fitZoom;
    }
    return 1; // Fallback
  }, [videoDuration, timelineContainerWidth]);

  // Get current minimum zoom (fit-to-window level)
  const getMinZoom = useCallback(() => {
    return Math.max(0.01, calculateFitZoom()); // Very low minimum
  }, [calculateFitZoom]);

  const zoomFactor = 2.25;

  // Zoom control functions
  const zoomIn = useCallback(() => {
    setZoom((prevZoom) => Math.min(10, prevZoom * zoomFactor));
  }, []);

  const zoomOut = useCallback(() => {
    const minZoom = getMinZoom();
    setZoom((prevZoom) => Math.max(minZoom, prevZoom / zoomFactor));
  }, [getMinZoom]);

  const resetZoom = useCallback(() => {
    const fitZoom = calculateFitZoom();
    console.log("Resetting zoom to fit-to-window:", fitZoom);
    setZoom(fitZoom);
  }, [calculateFitZoom]);

  // Set default zoom to fit-to-window when data becomes available
  useEffect(() => {
    if (videoDuration && videoDuration > 0 && timelineContainerWidth > 0) {
      const fitZoom = calculateFitZoom();
      // Only set if we're still at the initial zoom level (1)
      if (zoom === 1) {
        setZoom(fitZoom);
      }
    }
  }, [videoDuration, timelineContainerWidth, calculateFitZoom, zoom]);

  // Auto-adjust zoom when container width changes (for window resizing)
  useEffect(() => {
    if (videoDuration && videoDuration > 0 && timelineContainerWidth > 0) {
      const currentMinZoom = calculateFitZoom();

      // If current zoom is at or below the new minimum, update to new fit-to-window level
      // This handles window resizing where the fit level changes
      if (zoom <= currentMinZoom + 0.01) {
        // Small tolerance for floating point comparison
        setZoom(currentMinZoom);
      }
    }
  }, [timelineContainerWidth, calculateFitZoom, videoDuration, zoom]); // Include all dependencies

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

  // TODO: Replace useMarkerOperations with direct Redux thunk dispatches
  // For now, skip this - will be handled in Phase 4
  // const markerOps = null; // useMarkerOperations({ state, dispatch });
  const refreshMarkersOnly = null; // markerOps?.refreshMarkersOnly;

  const handleEditMarker = useCallback((marker: SceneMarker) => {
    setEditingMarkerId(marker.id);
    setEditingTagId(marker.primary_tag.id);
  }, []);

  const handleSaveEditWithTagId = useCallback(
    async (marker: SceneMarker, tagId?: string) => {
      const finalTagId = tagId || editingTagId;
      if (finalTagId !== marker.primary_tag.id) {
        console.log("Updating marker tag:", {
          markerId: marker.id,
          markerTag: marker.primary_tag.name,
          oldTagId: marker.primary_tag.id,
          newTagId: finalTagId,
        });
        // TODO: Replace with Redux thunk
        // await markerOps.updateMarkerTag(marker.id, finalTagId);
      }
      setEditingMarkerId(null);
      setEditingTagId("");
    },
    [editingTagId]
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
      // TODO: Implement proper error handling for tag fetch
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
      // TODO: Add proper error handling with Redux
      // dispatch(setError("Current time must be within the marker's range to split it"));
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
    } catch (err) {
      console.error("Error splitting marker:", err);
      // TODO: Implement proper error handling for marker operations
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
      // TODO: Add proper error handling with Redux
      // dispatch(setError("No Video Cut marker found at current position"));
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
      // TODO: Add proper error handling with Redux
      // dispatch(setError("Failed to split Video Cut marker"));
    }
  }, [markers, currentVideoTime, scene, dispatch, showToast]);

  const createOrDuplicateMarker = useCallback(
    (sourceMarker?: SceneMarker) => {
      console.log("createOrDuplicateMarker called with state:", {
        hasVideoElement: !!videoElementRef.current,
        hasScene: !!scene,
        availableTagsCount: availableTags?.length || 0,
        isDuplicate: !!sourceMarker,
      });

      if (!videoElementRef.current || !scene || !availableTags?.length) {
        if (!videoElementRef.current) {
          console.log("Failed to create marker: No video element");
        }
        if (!scene) {
          console.log("Failed to create marker: No scene data");
        }
        if (!availableTags?.length) {
          console.log("Failed to create marker: No available tags");
          // TODO: Add proper error handling with Redux
          // dispatch(setError("No tags available. Please wait for tags to load or check if tags exist in Stash."));
        }
        return;
      }

      const isDuplicate = !!sourceMarker;
      const currentTime = currentVideoTime;

      // Determine time values
      const startTime = isDuplicate ? sourceMarker.seconds : currentTime;
      const endTime = isDuplicate ? sourceMarker.end_seconds : currentTime + 20; // Standard 20-second duration for new markers

      // Determine tag to use
      let selectedTag: Tag;
      if (isDuplicate) {
        selectedTag = sourceMarker.primary_tag;
      } else {
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
        end_seconds: endTime,
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
      markers,
      currentVideoTime,
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
    if (!currentMarker) {
      console.log("Cannot paste marker times: No current marker found");
      return;
    }

    try {
      // TODO: Replace with Redux thunk
      // await markerOps.updateMarkerTimes(
      //   currentMarker.id,
      //   copiedMarkerTimes.start,
      //   copiedMarkerTimes.end ?? null
      // );

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
  ]);

  const confirmDeleteRejectedMarkers = useCallback(async () => {
    try {
      await stashappService.deleteMarkers(
        rejectedMarkers.map((m) => m.id)
      );
      // TODO: Replace with Redux thunk
      // await refreshMarkersOnly();
      dispatch(setDeletingRejected(false));
      dispatch(setRejectedMarkers([]));
    } catch (err) {
      console.error("Error deleting rejected markers:", err);
      // TODO: Add proper error handling with Redux
      // dispatch(setError("Failed to delete rejected markers"));
    }
  }, [rejectedMarkers, dispatch]);

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
      // TODO: Add proper error handling with Redux
      // dispatch(setError("Failed to prepare AI markers for conversion"));
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
      // TODO: Replace with Redux thunk
      // await refreshMarkersOnly();
    } catch (err) {
      console.error("Error converting AI markers:", err);
      throw err; // Let the modal handle the error display
    }
  }, [confirmedAIMarkers]);

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
      // TODO: Replace with Redux thunk
      // setTimeout(refreshMarkersOnly, 2000); // Give generation time to complete

      // Clear any existing errors on success
      // TODO: Add error clearing action
      // dispatch(clearError());
    } catch (err) {
      console.error("Error completing scene:", err);
      // TODO: Add error handling action
      // dispatch(setError("Failed to complete scene processing"));
    } finally {
      // Loading state is managed by async thunks
      setIsCompletionModalOpen(false);
    }
  }, [
    getActionMarkers,
    videoCutMarkersToDelete,
    scene,
    identifyAITagsToRemove,
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

  // Helper function to find next unprocessed marker
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
  }, [getActionMarkers, selectedMarkerId]);

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
  }, [getActionMarkers, selectedMarkerId]);

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
  }, [markersWithTracks, actionMarkers, selectedMarkerId]);

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
  }, [markersWithTracks, actionMarkers, selectedMarkerId]);

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

      // Sort all markers by start time
      const sortedMarkers = [...actionMarkers].sort(
        (a, b) => a.seconds - b.seconds
      );
      const currentIndex = sortedMarkers.findIndex(
        (m) => m.id === currentMarker.id
      );

      let newIndex;
      if (direction === "next") {
        newIndex =
          currentIndex < sortedMarkers.length - 1
            ? currentIndex + 1
            : currentIndex;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
      }

      // Select the new marker by ID
      const newMarker = sortedMarkers[newIndex];
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

  // Fresh keyboard layout with logical groupings
  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      // Only log key press if it's not a modifier key by itself
      if (!["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
        console.log(
          `Key pressed: ${event.key}${event.shiftKey ? " + Shift" : ""}${
            event.ctrlKey || event.metaKey ? " + Ctrl" : ""
          }${event.altKey ? " + Alt" : ""}`
        );
      }

      // Ignore keyboard shortcuts if we're typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ignore events with unexpected modifiers to prevent conflicts with browser shortcuts
      // Only allow specific modifier combinations that we explicitly handle
      const hasCtrl = event.ctrlKey || event.metaKey;
      const hasAlt = event.altKey;
      const hasShift = event.shiftKey;

      // Define allowed modifier combinations for specific keys
      const allowedModifierCombinations = [
        // No modifiers (most common case)
        { ctrl: false, alt: false, shift: false },
        // Shift only for specific keys
        {
          ctrl: false,
          alt: false,
          shift: true,
          keys: [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "X",
            "I",
            "O",
            "N",
            "M",
            "T",
          ],
        },
      ];

      // Check if current modifier combination is allowed
      const isAllowedCombination = allowedModifierCombinations.some((combo) => {
        if (
          combo.ctrl === hasCtrl &&
          combo.alt === hasAlt &&
          combo.shift === hasShift
        ) {
          return !combo.keys || combo.keys.includes(event.key);
        }
        return false;
      });

      if (!isAllowedCombination) {
        console.log("Key combination not allowed");
        return;
      }

      // Handle shift+x for delete rejected markers
      if (hasShift && event.key === "X") {
        event.preventDefault();
        handleDeleteRejectedMarkers();
        return;
      }

      // Handle keys that work even without markers
      switch (event.key) {
        case "r":
        case "R":
          event.preventDefault();
          if (actionMarkers.length > 0 && scene?.id) {
            dispatch(loadMarkers(scene.id));
          } else {
            fetchData();
          }
          return;
        case "a":
        case "A":
          event.preventDefault();
          console.log("'A' key pressed - Attempting to create marker", {
            hasVideoElement: !!videoElementRef.current,
            hasScene: !!scene,
            availableTagsCount: availableTags?.length || 0,
            isCreatingMarker: isCreatingMarker,
            isDuplicatingMarker: isDuplicatingMarker,
          });
          handleCreateMarker();
          return;
        case "f":
        case "F":
          event.preventDefault();
          // Filter by current marker's swimlane, or clear if no markers are visible due to filtering
          if (actionMarkers.length > 0) {
            const currentMarker = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (!currentMarker) {
              console.log("Cannot split marker: No current marker found");
              return;
            }

            // Remember the current marker ID to preserve selection after filtering
            const currentMarkerId = currentMarker.id;

            // Use the same tag grouping logic as the timeline
            const tagGroupName = currentMarker.primary_tag.name.endsWith("_AI")
              ? currentMarker.primary_tag.name.replace("_AI", "")
              : currentMarker.primary_tag.name;

            // Toggle filter: if already filtered by this swimlane, clear it; otherwise set it
            const newFilter =
              filteredSwimlane === tagGroupName ? null : tagGroupName;

            // Apply the filter
            dispatch(setFilteredSwimlane(newFilter));

            // After filtering, find and select the same marker in the new filtered/unfiltered list
            setTimeout(() => {
              // Calculate what the new actionMarkers will be
              if (!markers) return;

              let newFilteredMarkers = markers.filter((marker) => {
                if (marker.id.startsWith("temp-")) return true;
                return !isShotBoundaryMarker(marker);
              });

              // Apply swimlane filter if active
              if (newFilter) {
                newFilteredMarkers = newFilteredMarkers.filter((marker) => {
                  const tagGroupName = marker.primary_tag.name.endsWith("_AI")
                    ? marker.primary_tag.name.replace("_AI", "")
                    : marker.primary_tag.name;
                  return tagGroupName === newFilter;
                });
              }

              if (currentMarkerId) {
                dispatch(setSelectedMarkerId(currentMarkerId));
              } else if (newFilteredMarkers.length > 0) {
                dispatch(setSelectedMarkerId(newFilteredMarkers[0].id));
              } else {
                dispatch(setSelectedMarkerId(null));
              }
            }, 0);
          } else if (filteredSwimlane) {
            // If no action markers are visible but a filter is applied, pressing F clears the filter.
            dispatch(setFilteredSwimlane(null));
          }
          return;
        case "Escape":
          event.preventDefault();
          if (editingMarkerId) {
            handleCancelEdit();
          } else if (isCreatingMarker || isDuplicatingMarker) {
            // Cancel temporary marker creation
            const realMarkers = markers.filter(
              (m) => !m.id.startsWith("temp-")
            );
            dispatch(setMarkers(realMarkers));
            dispatch(setCreatingMarker(false));
            dispatch(setDuplicatingMarker(false));
          }
          return;
        case "v":
        case "V":
          event.preventDefault();
          splitVideoCutMarker();
          return;
      }

      // Early return if no markers for marker-specific actions
      if (actionMarkers.length === 0) return;

      // ARROWS - Timeline Navigation
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          navigateBetweenSwimlanes("up", !event.shiftKey);
          break;
        case "ArrowDown":
          event.preventDefault();
          navigateBetweenSwimlanes("down", !event.shiftKey);
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (event.shiftKey) {
            navigateChronologically("prev");
          } else {
            navigateWithinSwimlane("left");
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (event.shiftKey) {
            navigateChronologically("next");
          } else {
            navigateWithinSwimlane("right");
          }
          break;

        // LEFT HAND - Marker Actions
        // Review Actions (bottom row)
        case "z":
        case "Z":
          event.preventDefault();
          {
            const markerToConfirm = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (markerToConfirm) {
              const isAlreadyConfirmed = markerToConfirm.tags.some(
                (tag) => tag.id === stashappService.MARKER_STATUS_CONFIRMED
              );

              if (isAlreadyConfirmed) {
                if (scene?.id) {
                  dispatch(resetMarker({ sceneId: scene.id, markerId: markerToConfirm.id }));
                }
              } else {
                if (scene?.id) {
                  dispatch(confirmMarker({ sceneId: scene.id, markerId: markerToConfirm.id })).then(() => {
                    // Find and select next unprocessed marker in the same swimlane
                    const nextMarkerId = findNextUnprocessedMarkerInSwimlane();
                    if (nextMarkerId) {
                      dispatch(setSelectedMarkerId(nextMarkerId));
                    }
                  });
                }
              }
            }
          }
          break;
        case "x":
        case "X":
          event.preventDefault();
          {
            const markerToHandle = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (markerToHandle) {
              const isAlreadyRejected = markerToHandle.tags.some(
                (tag) => tag.id === stashappService.MARKER_STATUS_REJECTED
              );

              if (isAlreadyRejected) {
                if (scene?.id) {
                  dispatch(resetMarker({ sceneId: scene.id, markerId: markerToHandle.id }));
                }
              } else {
                if (scene?.id) {
                  dispatch(rejectMarker({ sceneId: scene.id, markerId: markerToHandle.id })).then(() => {
                    // Find and select next unprocessed marker in the same swimlane
                    const nextMarkerId = findNextUnprocessedMarkerInSwimlane();
                    if (nextMarkerId) {
                      dispatch(setSelectedMarkerId(nextMarkerId));
                    }
                  });
                }
              }
            }
          }
          break;
        case "c":
        case "C":
          event.preventDefault();
          if (hasShift) {
            // Shift+C: Open collection modal
            if (incorrectMarkers.length > 0) {
              dispatch(setCollectingModalOpen(true));
            } else {
              showToast("No incorrect markers to collect", "success");
            }
          } else {
            // C: Mark/unmark current marker as incorrect
            const markerToHandle = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (markerToHandle && scene?.id) {
              const isIncorrect = incorrectMarkers.some(
                (m) => m.markerId === markerToHandle.id
              );

              if (isIncorrect) {
                // TODO: Replace with Redux thunk
                // await markerOps.resetMarker(markerToHandle.id);
                incorrectMarkerStorage.removeIncorrectMarker(
                  scene.id,
                  markerToHandle.id
                );
                showToast("Removed incorrect marker feedback", "success");
              } else {
                // TODO: Replace with Redux thunk
                // await markerOps.rejectMarker(markerToHandle.id);
                incorrectMarkerStorage.addIncorrectMarker(scene.id, {
                  markerId: markerToHandle.id,
                  tagName: markerToHandle.primary_tag.name,
                  startTime: markerToHandle.seconds,
                  endTime: markerToHandle.end_seconds || null,
                  timestamp: new Date().toISOString(),
                  sceneId: scene.id,
                  sceneTitle: scene.title || "Untitled Scene",
                });
                showToast("Marked marker as incorrect", "success");
              }

              // Update state
              dispatch(setIncorrectMarkers(incorrectMarkerStorage.getIncorrectMarkers(
                  scene.id
                )));
            }
          }
          break;
        case "n":
        case "N":
          event.preventDefault();
          if (hasShift) {
            // Shift+N: Global search
            const prevMarkerId = findPreviousUnprocessedMarker();
            if (prevMarkerId) {
              dispatch(setSelectedMarkerId(prevMarkerId));
            }
          } else {
            // N: Swimlane search
            const prevMarkerId = findPreviousUnprocessedMarkerInSwimlane();
            if (prevMarkerId) {
              dispatch(setSelectedMarkerId(prevMarkerId));
            }
          }
          break;

        case "m":
        case "M":
          event.preventDefault();
          if (hasShift) {
            // Shift+M: Global search
            const nextMarkerId = findNextUnprocessedMarker();
            if (nextMarkerId) {
              dispatch(setSelectedMarkerId(nextMarkerId));
            }
          } else {
            // M: Swimlane search
            const nextMarkerId = findNextUnprocessedMarkerInSwimlane();
            if (nextMarkerId) {
              dispatch(setSelectedMarkerId(nextMarkerId));
            }
          }
          break;

        // Creation Actions (middle row)
        case "s":
        case "S":
          event.preventDefault();
          splitCurrentMarker();
          break;
        case "d":
        case "D":
          event.preventDefault();
          {
            const markerToDuplicate = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (markerToDuplicate) {
              createOrDuplicateMarker(markerToDuplicate);
            }
          }
          break;

        // Editing Actions (top row)
        case "q":
        case "Q":
          event.preventDefault();
          {
            const markerToEdit = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (markerToEdit) {
              handleEditMarker(markerToEdit);
            }
          }
          break;
        case "w":
        case "W":
          event.preventDefault();
          {
            if (videoElementRef.current) {
              const markerToUpdate = actionMarkers.find(
                (m) => m.id === selectedMarkerId
              );
              if (markerToUpdate) {
                // const newStartTime = videoElementRef.current.currentTime;
                // const newEndTime = markerToUpdate.end_seconds ?? null;
                // TODO: Replace with Redux thunk
                // markerOps.updateMarkerTimes(
                //   markerToUpdate.id,
                //   newStartTime,
                //   newEndTime
                // );
              }
            }
          }
          break;
        case "e":
        case "E":
          event.preventDefault();
          {
            if (videoElementRef.current) {
              const markerToSetEnd = actionMarkers.find(
                (m) => m.id === selectedMarkerId
              );
              if (markerToSetEnd) {
                // const newStartTime = markerToSetEnd.seconds;
                // const newEndTime = videoElementRef.current.currentTime;
                // TODO: Replace with Redux thunk
                // markerOps.updateMarkerTimes(
                //   markerToSetEnd.id,
                //   newStartTime,
                //   newEndTime
                // );
              }
            }
          }
          break;
        case "t":
        case "T":
          event.preventDefault();
          if (hasShift) {
            // Shift+T: Paste marker times
            pasteMarkerTimes();
          } else {
            // T: Copy marker times
            copyMarkerTimes();
          }
          break;

        // RIGHT HAND - Time & Playback
        // View Control
        case "h":
        case "H":
          event.preventDefault();
          // Center timeline on current playhead position
          if (videoElementRef.current && videoDuration && videoDuration > 0) {
            const timelineElement = document.querySelector(
              "[data-timeline-container]"
            ) as HTMLElement;
            if (timelineElement) {
              const currentTime = currentVideoTime;
              // Calculate pixels per second based on timeline's actual width and video duration
              const timelineContent =
                timelineElement.firstElementChild as HTMLElement;
              if (timelineContent) {
                const timelineWidth = timelineContent.offsetWidth;
                const pixelsPerSecond = timelineWidth / videoDuration;
                const currentTimePosition = currentTime * pixelsPerSecond;
                const containerWidth = timelineElement.clientWidth;
                const desiredScrollPosition = Math.max(
                  0,
                  currentTimePosition - containerWidth / 2
                );

                timelineElement.scrollTo({
                  left: desiredScrollPosition,
                  behavior: "smooth",
                });
              }
            }
          }
          break;

        // Playback Control
        case " ":
          event.preventDefault();
          // Toggle play/pause
          dispatch(togglePlayPause());
          break;
        case "j":
        case "J":
          event.preventDefault();
          // Seek backward 5 seconds
          dispatch(seekToTime(Math.max(currentVideoTime - 5, 0)));
          break;
        case "k":
        case "K":
          event.preventDefault();
          // Toggle play/pause
          dispatch(togglePlayPause());
          break;
        case "l":
        case "L":
          event.preventDefault();
          // Seek forward 5 seconds
          if (videoDuration) {
            dispatch(seekToTime(Math.min(currentVideoTime + 5, videoDuration)));
          }
          break;
        case ",":
          event.preventDefault();
          // Pause video first to ensure frame stepping works properly
          dispatch(pauseVideo());
          // Use 1/30 second for frame stepping (30fps)
          const frameTime = 1 / 30;
          dispatch(seekToTime(Math.max(currentVideoTime - frameTime, 0)));
          break;
        case ".":
          event.preventDefault();
          // Pause video first to ensure frame stepping works properly
          dispatch(pauseVideo());
          // Use 1/30 second for frame stepping (30fps)
          const frameTimeForward = 1 / 30;
          if (videoDuration) {
            dispatch(seekToTime(Math.min(currentVideoTime + frameTimeForward, videoDuration)));
          }
          break;

        // Jump to Positions
        case "i":
        case "I":
          event.preventDefault();
          if (hasShift) {
            // Shift+I: Jump to beginning of scene
            dispatch(seekToTime(0));
          } else {
            // I: Jump to start of current marker
            const marker = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (marker) {
              dispatch(seekToTime(marker.seconds));
            }
          }
          break;
        case "o":
        case "O":
          event.preventDefault();
          if (hasShift) {
            // Shift+O: Jump to end of scene
            if (videoDuration && videoDuration > 0) {
              dispatch(seekToTime(videoDuration));
            }
          } else {
            // O: Jump to end of current marker
            const marker = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (marker) {
              const endTime = marker.end_seconds ?? marker.seconds + 1;
              dispatch(seekToTime(endTime));
            }
          }
          break;

        // Shot Navigation
        case "y":
        case "Y":
          event.preventDefault();
          jumpToPreviousShot();
          break;
        case "u":
        case "U":
          event.preventDefault();
          jumpToNextShot();
          break;

        // Enter key - Start playback from current marker
        case "Enter":
          event.preventDefault();
          const marker = actionMarkers.find(
            (m) => m.id === selectedMarkerId
          );
          if (marker) {
            dispatch(seekToTime(marker.seconds));
            dispatch(playVideo());
          }
          break;

        // Navigation between unprocessed markers
        case "n":
        case "N":
          event.preventDefault();
          if (hasShift) {
            // Shift+N: Global search
            const prevMarkerId = findPreviousUnprocessedMarker();
            if (prevMarkerId) {
              dispatch(setSelectedMarkerId(prevMarkerId));
            }
          } else {
            // N: Swimlane search
            const prevMarkerId = findPreviousUnprocessedMarkerInSwimlane();
            if (prevMarkerId) {
              dispatch(setSelectedMarkerId(prevMarkerId));
            }
          }
          break;

        case "m":
        case "M":
          event.preventDefault();
          if (hasShift) {
            // Shift+M: Global search
            const nextMarkerId = findNextUnprocessedMarker();
            if (nextMarkerId) {
              dispatch(setSelectedMarkerId(nextMarkerId));
            }
          } else {
            // M: Swimlane search
            const nextMarkerId = findNextUnprocessedMarkerInSwimlane();
            if (nextMarkerId) {
              dispatch(setSelectedMarkerId(nextMarkerId));
            }
          }
          break;

        // Zoom Controls
        case "+":
        case "=":
          event.preventDefault();
          zoomIn();
          break;
        case "-":
        case "_":
          event.preventDefault();
          zoomOut();
          break;
        case "0":
          event.preventDefault();
          resetZoom();
          break;
      }
    },
    [
      actionMarkers,
      fetchData,
      editingMarkerId,
      handleCancelEdit,
      // Redux selectors added to dependencies
      availableTags,
      filteredSwimlane,
      incorrectMarkers,
      isCreatingMarker,
      isDuplicatingMarker,
      markers,
      scene,
      selectedMarkerId,
      videoDuration,
      currentVideoTime,
      dispatch,
      navigateBetweenSwimlanes,
      navigateChronologically,
      navigateWithinSwimlane,

      findNextUnprocessedMarker,
      findPreviousUnprocessedMarker,
      findNextUnprocessedMarkerInSwimlane,
      findPreviousUnprocessedMarkerInSwimlane,
      handleCreateMarker,
      splitCurrentMarker,
      handleEditMarker,
      copyMarkerTimes,
      pasteMarkerTimes,
      zoomIn,
      zoomOut,
      resetZoom,
      handleDeleteRejectedMarkers,
      jumpToNextShot,
      jumpToPreviousShot,
      createOrDuplicateMarker,
      showToast,
      splitVideoCutMarker,
    ]
  );

  // Modal-specific keyboard handler
  const handleModalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Handle completion modal
      if (isCompletionModalOpen) {
        // Prevent event from bubbling to the main keyboard handler
        event.stopPropagation();

        switch (event.key) {
          case "Enter":
            event.preventDefault();
            executeCompletion();
            break;
          case "Escape":
            event.preventDefault();
            setIsCompletionModalOpen(false);
            break;
          case "y":
          case "Y":
            event.preventDefault();
            executeCompletion();
            break;
          case "n":
          case "N":
            event.preventDefault();
            setIsCompletionModalOpen(false);
            break;
        }
        return;
      }

      // Handle delete rejected modal
      if (isDeletingRejected) {
        // Prevent event from bubbling to the main keyboard handler
        event.stopPropagation();

        switch (event.key) {
          case "Enter":
            event.preventDefault();
            confirmDeleteRejectedMarkers();
            break;
          case "Escape":
            event.preventDefault();
            dispatch(setDeletingRejected(false));
            dispatch(setRejectedMarkers([]));
            break;
          case "y":
          case "Y":
            event.preventDefault();
            confirmDeleteRejectedMarkers();
            break;
          case "n":
          case "N":
            event.preventDefault();
            dispatch(setDeletingRejected(false));
            dispatch(setRejectedMarkers([]));
            break;
        }
      }
    },
    [
      isCompletionModalOpen,
      executeCompletion,
      isDeletingRejected,
      confirmDeleteRejectedMarkers,
      dispatch,
    ]
  );

  useEffect(() => {
    // Add modal handler with capture=true to handle events before they reach the main handler
    window.addEventListener("keydown", handleModalKeyDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleModalKeyDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleModalKeyDown, handleKeyDown]);

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
                                  // Create the marker and get the response with the new marker data
                                  const createdMarker =
                                    await stashappService.createSceneMarker(
                                      marker.scene.id,
                                      newTagId,
                                      newStart,
                                      newEnd ?? null,
                                      [
                                        stashappService.MARKER_SOURCE_MANUAL,
                                        stashappService.MARKER_STATUS_CONFIRMED,
                                      ]
                                    );

                                  console.log("Created marker:", createdMarker);

                                  // Remove temp markers and add the newly created marker in one atomic operation
                                  const realMarkers = markers.filter(
                                    (m) => !m.id.startsWith("temp-")
                                  );
                                  const updatedMarkers = [
                                    ...realMarkers,
                                    createdMarker,
                                  ].sort((a, b) => a.seconds - b.seconds);

                                  // Update state with new markers and clear creating flags atomically
                                  dispatch(setMarkers(updatedMarkers));
                                  dispatch(setCreatingMarker(false));
                                  dispatch(setDuplicatingMarker(false));

                                  // Use setTimeout to ensure markers state has been updated before updating selected index
                                  setTimeout(() => {
                                    // Filter to get action markers from the updated data
                                    const updatedActionMarkers =
                                      updatedMarkers.filter((m) => {
                                        // Always include temp markers regardless of their primary tag
                                        if (m.id.startsWith("temp-")) {
                                          return true;
                                        }
                                        // Filter out shot boundary markers for non-temp markers
                                        return !isShotBoundaryMarker(m);
                                      });

                                    console.log(
                                      "Looking for new marker ID:",
                                      createdMarker.id,
                                      "in",
                                      updatedActionMarkers.length,
                                      "action markers"
                                    );

                                    // Find the newly created marker in the updated action markers
                                    const newMarkerIndex =
                                      updatedActionMarkers.findIndex(
                                        (m) => m.id === createdMarker.id
                                      );

                                    console.log(
                                      "Found marker at index:",
                                      newMarkerIndex
                                    );

                                    if (newMarkerIndex >= 0) {
                                      console.log(
                                        "Selecting marker at index:",
                                        newMarkerIndex
                                      );
                                      dispatch(setSelectedMarkerId(createdMarker.id));
                                    } else {
                                      console.error(
                                        "Created marker not found in action markers list"
                                      );
                                      // This should not happen with this approach, but log for debugging
                                      console.log(
                                        "Created marker:",
                                        createdMarker
                                      );
                                      console.log(
                                        "Is shot boundary?",
                                        isShotBoundaryMarker(createdMarker)
                                      );
                                    }
                                  }, 50); // Small delay to ensure state has been updated
                                } catch (error) {
                                  console.error(
                                    "Error creating marker:",
                                    error
                                  );

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
          refreshMarkersOnly={refreshMarkersOnly || (() => Promise.resolve())}
        />
      )}
    </div>
  );
}

export default function MarkerPage() {
  return <MarkerPageContent />;
}

// Add this new TagAutocomplete component after the formatTimeColonDot function and before SelectedMarkerDetails
function TagAutocomplete({
  value,
  onChange,
  availableTags,
  placeholder = "Type to search tags...",
  className = "",
  autoFocus = false,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (tagId: string) => void;
  availableTags: Tag[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onSave?: (tagId?: string) => void;
  onCancel?: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [openUpward, setOpenUpward] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the current tag name based on value
  const currentTag = availableTags.find((tag) => tag.id === value);

  useEffect(() => {
    if (currentTag && !autoFocus) {
      setInputValue(currentTag.name);
    } else if (autoFocus) {
      // Clear input when starting inline editing so user can just start typing
      setInputValue("");
    }
  }, [currentTag, autoFocus]);

  // Auto-focus when component mounts if autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      // Don't select text since we're clearing it - just focus for typing
    }
  }, [autoFocus]);

  // Filter and sort tags based on input with priority scoring
  const filteredTags = availableTags
    .filter((tag) => tag.name.toLowerCase().includes(inputValue.toLowerCase()))
    .sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const searchTerm = inputValue.toLowerCase();

      // Exact match gets highest priority
      const aExact = aName === searchTerm;
      const bExact = bName === searchTerm;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Starts with gets second priority
      const aStartsWith = aName.startsWith(searchTerm);
      const bStartsWith = bName.startsWith(searchTerm);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Within same priority level, sort alphabetically
      return aName.localeCompare(bName);
    });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);
    checkDropdownDirection();
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    checkDropdownDirection();
  };

  const checkDropdownDirection = () => {
    if (!inputRef.current) return;

    // Find the scrollable marker list container by traversing up the DOM
    let scrollContainer = inputRef.current.parentElement;
    while (scrollContainer) {
      const styles = window.getComputedStyle(scrollContainer);
      if (
        styles.overflowY === "auto" ||
        styles.overflowY === "scroll" ||
        scrollContainer.classList.contains("overflow-y-auto")
      ) {
        break;
      }
      scrollContainer = scrollContainer.parentElement;
    }

    if (!scrollContainer) {
      setOpenUpward(false);
      return;
    }

    const inputRect = inputRef.current.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const dropdownMaxHeight = 192; // max-h-48 = 192px

    // Calculate space within the scrollable container
    const spaceBelow = containerRect.bottom - inputRect.bottom;
    const spaceAbove = inputRect.top - containerRect.top;

    // If there's not enough space below but more space above, open upward
    if (
      spaceBelow < dropdownMaxHeight &&
      spaceAbove > spaceBelow &&
      spaceAbove > 100
    ) {
      setOpenUpward(true);
    } else {
      setOpenUpward(false);
    }
  };

  const handleSelectTag = (tag: Tag) => {
    setInputValue(tag.name);
    onChange(tag.id);
    setIsOpen(false);
    setSelectedIndex(-1);
    // Auto-save when a tag is selected if onSave is provided
    if (onSave) {
      onSave(tag.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredTags.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredTags.length) {
        handleSelectTag(filteredTags[selectedIndex]);
      } else if (filteredTags.length > 0) {
        // Select the first matching tag if no specific selection
        handleSelectTag(filteredTags[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
      // Call onCancel if provided
      if (onCancel) {
        onCancel();
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle window resize to recalculate dropdown direction
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        checkDropdownDirection();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        className="w-full bg-gray-700 text-white px-2 py-1 rounded-sm"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && filteredTags.length > 0 && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-sm shadow-lg max-h-48 overflow-y-auto ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {filteredTags.map((tag, index) => (
            <div
              key={tag.id}
              className={`px-3 py-2 cursor-pointer text-white ${
                index === selectedIndex ? "bg-blue-600" : "hover:bg-gray-600"
              }`}
              onClick={() => handleSelectTag(tag)}
              title={tag.description || undefined}
            >
              <div className="font-medium">{tag.name}</div>
            </div>
          ))}
        </div>
      )}
      {isOpen && filteredTags.length === 0 && inputValue && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-sm shadow-lg ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="px-3 py-2 text-gray-400">
            No tags found matching &quot;{inputValue}&quot;
          </div>
        </div>
      )}
    </div>
  );
}

// Add this new component before the SelectedMarkerDetails component
function TempMarkerForm({
  marker,
  availableTags,
  videoElement,
  onSave,
  onCancel,
  isDuplicate = false,
}: {
  marker: SceneMarker;
  availableTags: Tag[];
  videoElement: HTMLVideoElement | null;
  onSave: (start: number, end: number | null, tagId: string) => void;
  onCancel: () => void;
  isDuplicate?: boolean;
}) {
  const [start, setStart] = useState(formatTimeColonDot(marker.seconds));
  const [end, setEnd] = useState(
    marker.end_seconds !== undefined
      ? formatTimeColonDot(marker.end_seconds)
      : ""
  );
  const [tagId, setTagId] = useState(marker.primary_tag.id);

  const handleTimeKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    isStart: boolean
  ) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const currentTime = isStart
        ? parseTimeColonDot(start)
        : parseTimeColonDot(end);
      const increment = e.key === "ArrowUp" ? 0.1 : -0.1;
      const newTime = Math.max(0, currentTime + increment);

      if (isStart) {
        setStart(formatTimeColonDot(newTime));
      } else {
        setEnd(formatTimeColonDot(newTime));
      }

      if (videoElement) {
        videoElement.currentTime = newTime;
      }
    }
  };

  const handleTimeChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    isStart: boolean
  ) => {
    const value = e.target.value;
    // Only allow digits, dots, and colons
    if (/^[\d:.]*$/.test(value)) {
      if (isStart) {
        setStart(value);
      } else {
        setEnd(value);
      }
    }
  };

  return (
    <div className="flex items-center">
      <span className="text-blue-300 mr-2 font-bold">*</span>
      <div className="flex items-center space-x-2 flex-1">
        <input
          type="text"
          className="w-20 bg-gray-700 text-white px-1 py-1 rounded-sm text-xs"
          value={start}
          onChange={(e) => handleTimeChange(e, true)}
          onKeyDown={(e) => handleTimeKeyDown(e, true)}
          placeholder="start"
          title="Start time (mm:ss.zzz)"
        />
        <span className="text-gray-400 text-xs">-</span>
        <input
          type="text"
          className="w-20 bg-gray-700 text-white px-1 py-1 rounded-sm text-xs"
          value={end}
          onChange={(e) => handleTimeChange(e, false)}
          onKeyDown={(e) => handleTimeKeyDown(e, false)}
          placeholder="end"
          title="End time (mm:ss.zzz)"
        />
        <TagAutocomplete
          value={tagId}
          onChange={setTagId}
          availableTags={availableTags}
          placeholder={
            isDuplicate
              ? `Duplicating: ${marker.primary_tag.name}`
              : "Type to search tags..."
          }
          className="flex-1"
          autoFocus={true}
          onSave={(selectedTagId) => {
            if (selectedTagId) {
              onSave(
                parseTimeColonDot(start),
                end === "" ? null : parseTimeColonDot(end),
                selectedTagId
              );
            }
          }}
        />
        <button
          className="bg-green-500 hover:bg-green-700 text-white px-2 py-1 rounded-sm text-xs"
          onClick={() => {
            onSave(
              parseTimeColonDot(start),
              end === "" ? null : parseTimeColonDot(end),
              tagId
            );
          }}
        >
          Save
        </button>
        <button
          className="bg-gray-500 hover:bg-gray-700 text-white px-2 py-1 rounded-sm text-xs"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
