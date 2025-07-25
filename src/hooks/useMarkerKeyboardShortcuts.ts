import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  loadMarkers,
  setMarkers,
  setCreatingMarker,
  setDuplicatingMarker,
  setSelectedMarkerId,
  setFilteredSwimlane,
  confirmMarker,
  rejectMarker,
  resetMarker,
  updateMarkerTimes,
  setCollectingModalOpen,
  setIncorrectMarkers,
  setDeletingRejected,
  setRejectedMarkers,
  togglePlayPause,
  seekToTime,
  pauseVideo,
  playVideo,
} from '../store/slices/markerSlice';
import { selectMarkerStatusConfirmed, selectMarkerStatusRejected } from '../store/slices/configSlice';
import { isShotBoundaryMarker } from '../core/marker/markerLogic';
import { type SceneMarker, type Scene } from '../services/StashappService';
import { incorrectMarkerStorage } from '../utils/incorrectMarkerStorage';

interface UseMarkerKeyboardShortcutsParams {
  actionMarkers: SceneMarker[];
  markers: SceneMarker[] | null;
  scene: Scene | null;
  selectedMarkerId: string | null;
  editingMarkerId: string | null;
  isCreatingMarker: boolean;
  isDuplicatingMarker: boolean;
  filteredSwimlane: string | null;
  incorrectMarkers: { markerId: string; [key: string]: unknown }[];
  availableTags: { id: string; name: string; [key: string]: unknown }[] | null;
  videoDuration: number | null;
  currentVideoTime: number;
  isCompletionModalOpen: boolean;
  isDeletingRejected: boolean;
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  
  // Handler functions
  fetchData: () => void;
  handleCancelEdit: () => void;
  handleEditMarker: (marker: SceneMarker) => void;
  handleDeleteRejectedMarkers: () => void;
  splitCurrentMarker: () => void;
  splitVideoCutMarker: () => void;
  createOrDuplicateMarker: (startTime: number, endTime: number | null, sourceMarker?: SceneMarker) => void;
  createShotBoundaryMarker: () => void;
  copyMarkerTimes: () => void;
  pasteMarkerTimes: () => void;
  jumpToNextShot: () => void;
  jumpToPreviousShot: () => void;
  executeCompletion: () => void;
  confirmDeleteRejectedMarkers: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  
  // Navigation functions
  navigateBetweenSwimlanes: (direction: 'up' | 'down', centerVideo: boolean) => void;
  navigateChronologically: (direction: 'prev' | 'next') => void;
  navigateWithinSwimlane: (direction: 'left' | 'right') => void;
  findNextUnprocessedMarker: () => string | null;
  findPreviousUnprocessedMarker: () => string | null;
  findNextUnprocessedMarkerInSwimlane: () => string | null;
  findPreviousUnprocessedMarkerInSwimlane: () => string | null;
  
  // Zoom functions
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  
  // Timeline functions
  centerPlayhead: () => void;
}

export const useMarkerKeyboardShortcuts = (params: UseMarkerKeyboardShortcutsParams) => {
  const dispatch = useAppDispatch();
  const markerStatusConfirmed = useAppSelector(selectMarkerStatusConfirmed);
  const markerStatusRejected = useAppSelector(selectMarkerStatusRejected);

  // Helper function to get frame rate from scene, with fallback to 30fps
  const getFrameRate = useCallback((scene: Scene | null): number => {
    return scene?.files?.[0]?.frame_rate ?? 30;
  }, []);
  const {
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
    centerPlayhead,
  } = params;

  // Modal keyboard handler (runs with capture=true)
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
            dispatch(setCollectingModalOpen(false));
            break;
          case "y":
          case "Y":
            event.preventDefault();
            executeCompletion();
            break;
          case "n":
          case "N":
            event.preventDefault();
            dispatch(setCollectingModalOpen(false));
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

  // Main keyboard handler
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
            "A",
            ",",
            ".",
            "<",
            ">",
            ";",
            ":",
          ],
        },
        // Alt only for Timeline swimlane controls
        {
          ctrl: false,
          alt: true,
          shift: false,
          keys: ["+", "=", "-", "–", "±", "0", "º", "≈"],
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
          if (hasShift) {
            // Shift+A: Create marker from previous shot to next shot
            console.log("'Shift+A' key pressed - Creating shot boundary marker");
            createShotBoundaryMarker();
          } else {
            // A: Create regular marker  
            console.log("'A' key pressed - Attempting to create marker", {
              hasVideoElement: !!videoElementRef.current,
              hasScene: !!scene,
              availableTagsCount: availableTags?.length || 0,
              isCreatingMarker: isCreatingMarker,
              isDuplicatingMarker: isDuplicatingMarker,
            });
            createOrDuplicateMarker(currentVideoTime, currentVideoTime + 20);
          }
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
            const realMarkers = markers?.filter(
              (m) => !m.id.startsWith("temp-")
            );
            if (realMarkers) {
              dispatch(setMarkers(realMarkers));
            }
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
                (tag) => tag.id === markerStatusConfirmed
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
                (tag) => tag.id === markerStatusRejected
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
                await dispatch(resetMarker({ sceneId: scene.id, markerId: markerToHandle.id }));
                incorrectMarkerStorage.removeIncorrectMarker(
                  scene.id,
                  markerToHandle.id
                );
                showToast("Removed incorrect marker feedback", "success");
              } else {
                await dispatch(rejectMarker({ sceneId: scene.id, markerId: markerToHandle.id }));
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
              createOrDuplicateMarker(
                markerToDuplicate.seconds, 
                markerToDuplicate.end_seconds ?? null, 
                markerToDuplicate
              );
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
            const markerToUpdate = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (markerToUpdate && scene) {
              const newStartTime = currentVideoTime;
              const newEndTime = markerToUpdate.end_seconds ?? null;
              
              dispatch(updateMarkerTimes({
                sceneId: scene.id,
                markerId: markerToUpdate.id,
                startTime: newStartTime,
                endTime: newEndTime
              }));
            }
          }
          break;
        case "e":
        case "E":
          event.preventDefault();
          {
            const markerToSetEnd = actionMarkers.find(
              (m) => m.id === selectedMarkerId
            );
            if (markerToSetEnd && scene) {
              const newStartTime = markerToSetEnd.seconds;
              const newEndTime = currentVideoTime;
              
              dispatch(updateMarkerTimes({
                sceneId: scene.id,
                markerId: markerToSetEnd.id,
                startTime: newStartTime,
                endTime: newEndTime
              }));
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
          centerPlayhead();
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
          if (hasShift) {
            // Shift+comma: Step backward 10 frames
            const mediumStep = 10 / getFrameRate(scene);
            dispatch(seekToTime(Math.max(currentVideoTime - mediumStep, 0)));
          } else {
            // comma: Step backward 1 frame
            const frameTime = 1 / getFrameRate(scene);
            dispatch(seekToTime(Math.max(currentVideoTime - frameTime, 0)));
          }
          break;
        case ";":
          // Scandinavian keyboard: Shift+comma produces semicolon
          event.preventDefault();
          dispatch(pauseVideo());
          const mediumStepBackward = 10 / getFrameRate(scene);
          dispatch(seekToTime(Math.max(currentVideoTime - mediumStepBackward, 0)));
          break;
        case ".":
          event.preventDefault();
          // Pause video first to ensure frame stepping works properly
          dispatch(pauseVideo());
          if (hasShift) {
            // Shift+period: Step forward 10 frames
            const mediumStepForward = 10 / getFrameRate(scene);
            if (videoDuration) {
              dispatch(seekToTime(Math.min(currentVideoTime + mediumStepForward, videoDuration)));
            }
          } else {
            // period: Step forward 1 frame
            const frameTimeForward = 1 / getFrameRate(scene);
            if (videoDuration) {
              dispatch(seekToTime(Math.min(currentVideoTime + frameTimeForward, videoDuration)));
            }
          }
          break;
        case ":":
          // Scandinavian keyboard: Shift+period produces colon
          event.preventDefault();
          dispatch(pauseVideo());
          const mediumStepForwardScand = 10 / getFrameRate(scene);
          if (videoDuration) {
            dispatch(seekToTime(Math.min(currentVideoTime + mediumStepForwardScand, videoDuration)));
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

        // Zoom Controls (only without modifiers to avoid conflict with swimlane resize)
        case "+":
        case "=":
          if (!hasCtrl && !hasAlt && !hasShift) {
            event.preventDefault();
            zoomIn();
          }
          break;
        case "-":
        case "_":
          if (!hasCtrl && !hasAlt && !hasShift) {
            event.preventDefault();
            zoomOut();
          }
          break;
        case "0":
          if (!hasCtrl && !hasAlt && !hasShift) {
            event.preventDefault();
            resetZoom();
          }
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
      markerStatusConfirmed,
      markerStatusRejected,
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
      splitVideoCutMarker,
      createOrDuplicateMarker,
      createShotBoundaryMarker,
      videoElementRef,
      showToast,
      centerPlayhead,
      getFrameRate,
    ]
  );

  // Set up event listeners
  useEffect(() => {
    // Add modal handler with capture=true to handle events before they reach the main handler
    window.addEventListener("keydown", handleModalKeyDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleModalKeyDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleModalKeyDown, handleKeyDown]);

  return {
    handleKeyDown,
    handleModalKeyDown,
  };
};