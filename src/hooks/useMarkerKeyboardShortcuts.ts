import { useCallback, useEffect } from "react";
import { MarkerContextType, MarkerWithTrack } from "../core/marker/types";
import { useVideoControls } from "./useVideoControls";
import { useTimelineNavigation } from "./useTimelineNavigation";
import { useMarkerOperations } from "./useMarkerOperations";
import { getActionMarkers } from "../core/marker/markerLogic";

export const useMarkerKeyboardShortcuts = (
  { state, dispatch }: MarkerContextType,
  markersWithTracks: MarkerWithTrack[]
) => {
  const videoControls = useVideoControls({ state, dispatch });
  const timelineNavigation = useTimelineNavigation(
    { state, dispatch },
    markersWithTracks
  );
  const markerOperations = useMarkerOperations({ state, dispatch });

  const handleModalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore keyboard shortcuts if we're typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Handle Escape key for modals
      if (event.key === "Escape") {
        if (state.isEditingMarker) {
          dispatch({ type: "SET_EDITING_MARKER", payload: false });
        }
        if (state.isCreatingMarker) {
          dispatch({ type: "SET_CREATING_MARKER", payload: false });
        }
        if (state.isDuplicatingMarker) {
          dispatch({ type: "SET_DUPLICATING_MARKER", payload: false });
        }
        if (state.isAIConversionModalOpen) {
          dispatch({ type: "SET_AI_CONVERSION_MODAL_OPEN", payload: false });
        }
        if (state.isCollectingModalOpen) {
          dispatch({ type: "SET_COLLECTING_MODAL_OPEN", payload: false });
        }
        if (state.isKeyboardShortcutsModalOpen) {
          dispatch({
            type: "SET_KEYBOARD_SHORTCUTS_MODAL_OPEN",
            payload: false,
          });
        }
        event.stopPropagation();
      }
    },
    [
      state.isEditingMarker,
      state.isCreatingMarker,
      state.isDuplicatingMarker,
      state.isAIConversionModalOpen,
      state.isCollectingModalOpen,
      state.isKeyboardShortcutsModalOpen,
      dispatch,
    ]
  );

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
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
        return;
      }

      // ARROWS - Timeline Navigation
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          timelineNavigation.navigateBetweenSwimlanes("up", !event.shiftKey);
          break;
        case "ArrowDown":
          event.preventDefault();
          timelineNavigation.navigateBetweenSwimlanes("down", !event.shiftKey);
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (event.shiftKey) {
            timelineNavigation.navigateChronologically("prev");
          } else {
            timelineNavigation.navigateWithinSwimlane("left");
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (event.shiftKey) {
            timelineNavigation.navigateChronologically("next");
          } else {
            timelineNavigation.navigateWithinSwimlane("right");
          }
          break;

        // LEFT HAND - Marker Actions
        case "z":
        case "Z":
          event.preventDefault();
          const actionMarkers = getActionMarkers(
            state.markers || [],
            state.filteredSwimlane
          );
          const currentMarker = actionMarkers.find(
            (m) => m.id === state.selectedMarkerId
          );
          if (!currentMarker) {
            console.log("Cannot confirm marker: No current marker found");
            return;
          }
          await markerOperations.confirmMarker(currentMarker.id);
          break;
        case "x":
        case "X":
          event.preventDefault();
          if (event.shiftKey) {
            await markerOperations.deleteRejectedMarkers();
          } else if (state.selectedMarkerId) {
            const actionMarkers = getActionMarkers(
              state.markers || [],
              state.filteredSwimlane
            );
            const currentMarker = actionMarkers.find(
              (m) => m.id === state.selectedMarkerId
            );
            if (!currentMarker) {
              console.log("Cannot reject marker: No current marker found");
              return;
            }
            await markerOperations.rejectMarker(currentMarker.id);
          }
          break;
        case "a":
        case "A":
          event.preventDefault();
          if (!state.isCreatingMarker && !state.isDuplicatingMarker) {
            dispatch({ type: "SET_CREATING_MARKER", payload: true });
          }
          break;
        case "d":
        case "D":
          event.preventDefault();
          if (!state.isCreatingMarker && !state.isDuplicatingMarker) {
            dispatch({ type: "SET_DUPLICATING_MARKER", payload: true });
          }
          break;

        // RIGHT HAND - Time & Playback
        case " ": // Space
          event.preventDefault();
          videoControls.togglePlayPause();
          break;
        case "j":
        case "J":
          event.preventDefault();
          videoControls.seekRelative(-5);
          break;
        case "k":
        case "K":
          event.preventDefault();
          if (state.videoElement) {
            state.videoElement.pause();
          }
          break;
        case "l":
        case "L":
          event.preventDefault();
          videoControls.seekRelative(5);
          break;
        case ",":
          event.preventDefault();
          videoControls.frameStep(false);
          break;
        case ".":
          event.preventDefault();
          videoControls.frameStep(true);
          break;
        case "i":
        case "I":
          event.preventDefault();
          if (event.shiftKey) {
            videoControls.seekToTime(0);
          } else if (state.selectedMarkerId) {
            const actionMarkers = getActionMarkers(
              state.markers || [],
              state.filteredSwimlane
            );
            const currentMarker = actionMarkers.find(
              (m) => m.id === state.selectedMarkerId
            );
            if (!currentMarker) {
              console.log("Cannot jump to marker: No current marker found");
              return;
            }

            videoControls.jumpToMarkerTime(currentMarker.seconds);
          }
          break;
        case "o":
        case "O":
          event.preventDefault();
          if (event.shiftKey && state.videoDuration) {
            videoControls.seekToTime(state.videoDuration);
          } else if (state.selectedMarkerId) {
            const actionMarkers = getActionMarkers(
              state.markers || [],
              state.filteredSwimlane
            );
            const currentMarker = actionMarkers.find(
              (m) => m.id === state.selectedMarkerId
            );
            if (!currentMarker) {
              console.log("Cannot jump to marker: No current marker found");
              return;
            }

            if (currentMarker.end_seconds) {
              videoControls.jumpToMarkerTime(currentMarker.end_seconds);
            }
          }
          break;
      }
    },
    [
      state.markers,
      state.videoElement,
      state.videoDuration,
      state.filteredSwimlane,
      state.isCreatingMarker,
      state.isDuplicatingMarker,
      state.selectedMarkerId,
      dispatch,
      videoControls,
      timelineNavigation,
      markerOperations,
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

  return {
    handleModalKeyDown,
    handleKeyDown,
  };
};
