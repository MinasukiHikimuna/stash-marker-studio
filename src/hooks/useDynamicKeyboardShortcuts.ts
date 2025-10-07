import { useCallback, useEffect } from 'react';
import { useAppDispatch } from '../store/hooks';
import {
  confirmMarker,
  rejectMarker,
  resetMarker,
  openCollectingModal,
  openSlotAssignmentModal,
  closeModal,
  togglePlayPause,
  setCreatingMarker,
  setDuplicatingMarker,
  setMarkers,
  setSelectedMarkerId,
  seekToTime,
  playVideo,
  updateMarkerTimes,
  setIncorrectMarkers,
  // pauseVideo,
} from '../store/slices/markerSlice';
import { keyboardShortcutService } from '../services/KeyboardShortcutService';
import { type SceneMarker, type Scene } from '../services/StashappService';
import { incorrectMarkerStorage } from '../utils/incorrectMarkerStorage';
import { isMarkerConfirmed, isMarkerRejected } from '../core/marker/markerLogic';
import { useConfig } from '../contexts/ConfigContext';

interface UseDynamicKeyboardShortcutsParams {
  actionMarkers: SceneMarker[];
  markers: SceneMarker[] | null;
  scene: Scene | null;
  selectedMarkerId: string | null;
  editingMarkerId: string | null;
  isCreatingMarker: boolean;
  isDuplicatingMarker: boolean;
  incorrectMarkers: { markerId: string; [key: string]: unknown }[];
  availableTags: { id: string; name: string; [key: string]: unknown }[] | null;
  videoDuration: number | null;
  currentVideoTime: number;
  isCompletionModalOpen: boolean;
  isDeletingRejected: boolean;
  isCorrespondingTagConversionModalOpen: boolean;
  isCollectingModalOpen: boolean;
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
  addShotBoundaryAtPlayhead: () => void;
  removeShotBoundaryMarker: () => void;
  copyMarkerTimes: () => void;
  pasteMarkerTimes: () => void;
  copyMarkerForMerge: () => void;
  mergeMarkerProperties: () => void;
  jumpToNextShot: () => void;
  jumpToPreviousShot: () => void;
  executeCompletion: () => void;
  confirmDeleteRejectedMarkers: () => void;
  handleConfirmCorrespondingTagConversion: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  
  // Navigation functions
  navigateBetweenSwimlanes: (direction: 'up' | 'down') => void;
  navigateWithinSwimlane: (direction: 'left' | 'right') => void;
  findNextUnprocessedMarker: () => string | null;
  findPreviousUnprocessedGlobal: () => string | null;
  findNextUnprocessedGlobal: () => string | null;
  findNextUnprocessedMarkerInSwimlane: () => string | null;
  findPreviousUnprocessedMarkerInSwimlane: () => string | null;
  findNextMarkerAtPlayhead: (currentTime: number) => string | null;
  findPreviousMarkerAtPlayhead: (currentTime: number) => string | null;
  
  // Zoom functions
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  
  // Timeline functions
  centerPlayhead: () => void;
}

export const useDynamicKeyboardShortcuts = (params: UseDynamicKeyboardShortcutsParams) => {
  const dispatch = useAppDispatch();
  const config = useConfig();

  // Helper function to get frame rate from scene, with fallback to 30fps
  const getFrameRate = useCallback((scene: Scene | null): number => {
    return scene?.files?.[0]?.frame_rate ?? 30;
  }, []);

  // Get video playback configuration with defaults
  const getVideoConfig = useCallback(() => {
    return {
      smallSeekTime: config.videoPlaybackConfig?.smallSeekTime ?? 5,
      mediumSeekTime: config.videoPlaybackConfig?.mediumSeekTime ?? 10,
      longSeekTime: config.videoPlaybackConfig?.longSeekTime ?? 30,
      smallFrameStep: config.videoPlaybackConfig?.smallFrameStep ?? 1,
      mediumFrameStep: config.videoPlaybackConfig?.mediumFrameStep ?? 10,
      longFrameStep: config.videoPlaybackConfig?.longFrameStep ?? 30,
    };
  }, [config.videoPlaybackConfig]);

  // Action handlers mapped by shortcut ID
  const actionHandlers = useCallback(() => {
    const {
      actionMarkers,
      markers,
      scene,
      selectedMarkerId,
      editingMarkerId,
      isCreatingMarker,
      isDuplicatingMarker,
      incorrectMarkers,
      currentVideoTime,
      videoDuration,
      // videoElementRef,
      // fetchData, // No longer needed for markIncorrect action
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
      executeCompletion,
      confirmDeleteRejectedMarkers,
      handleConfirmCorrespondingTagConversion,
      // showToast,
      navigateBetweenSwimlanes,
      navigateWithinSwimlane,
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
    } = params;

    const currentMarker = actionMarkers.find(m => m.id === selectedMarkerId);

    return {
      // Marker Review
      'marker.confirm': () => {
        if (!currentMarker || !scene?.id) return;
        const isAlreadyConfirmed = isMarkerConfirmed(currentMarker);
        if (isAlreadyConfirmed) {
          dispatch(resetMarker({ sceneId: scene.id, markerId: currentMarker.id }));
        } else {
          dispatch(confirmMarker({ sceneId: scene.id, markerId: currentMarker.id }));
        }
      },

      'marker.reject': () => {
        if (!currentMarker || !scene?.id) return;
        const isAlreadyRejected = isMarkerRejected(currentMarker);
        if (isAlreadyRejected) {
          dispatch(resetMarker({ sceneId: scene.id, markerId: currentMarker.id }));
        } else {
          dispatch(rejectMarker({ sceneId: scene.id, markerId: currentMarker.id }));
        }
      },

      'marker.markIncorrect': () => {
        if (!currentMarker || !scene?.id) return;
        const existingIncorrect = incorrectMarkers.find(m => m.markerId === currentMarker.id);
        
        if (existingIncorrect) {
          // Remove from AI feedback collection and unreject the marker
          incorrectMarkerStorage.removeIncorrectMarker(scene.id, currentMarker.id);
          const isAlreadyRejected = isMarkerRejected(currentMarker);
          if (isAlreadyRejected) {
            dispatch(resetMarker({ sceneId: scene.id, markerId: currentMarker.id }));
          }
        } else {
          // Add to AI feedback collection and reject the marker
          incorrectMarkerStorage.addIncorrectMarker(scene.id, {
            markerId: currentMarker.id,
            tagName: currentMarker.primary_tag.name,
            startTime: currentMarker.seconds,
            endTime: currentMarker.end_seconds || currentMarker.seconds + 30,
            timestamp: new Date().toISOString(),
            sceneId: scene.id,
            sceneTitle: scene.title || '',
          });
          const isAlreadyRejected = isMarkerRejected(currentMarker);
          if (!isAlreadyRejected) {
            dispatch(rejectMarker({ sceneId: scene.id, markerId: currentMarker.id }));
          }
        }
        
        // Update Redux state to reflect AI feedback collection changes
        dispatch(setIncorrectMarkers(incorrectMarkerStorage.getIncorrectMarkers(scene.id)));
      },

      'marker.openCollectionModal': () => {
        dispatch(openCollectingModal());
      },

      // Marker Creation
      'marker.create': () => {
        createOrDuplicateMarker(currentVideoTime, currentVideoTime + 20);
      },

      'marker.createShotBoundary': () => {
        createShotBoundaryMarker();
      },

      'marker.split': () => {
        splitCurrentMarker();
      },

      'marker.duplicate': () => {
        if (!currentMarker) return;
        createOrDuplicateMarker(currentMarker.seconds, currentMarker.end_seconds ?? null, currentMarker);
      },

      'marker.splitVideoCut': () => {
        splitVideoCutMarker();
      },

      'marker.addShotBoundary': () => {
        addShotBoundaryAtPlayhead();
      },

      'marker.removeShotBoundary': () => {
        removeShotBoundaryMarker();
      },

      // Marker Editing
      'marker.edit': () => {
        if (!currentMarker) return;
        handleEditMarker(currentMarker);
      },

      'marker.setStartTime': () => {
        if (!currentMarker || !scene) return;
        dispatch(updateMarkerTimes({
          sceneId: scene.id,
          markerId: currentMarker.id,
          startTime: currentVideoTime,
          endTime: currentMarker.end_seconds ?? null
        }));
      },

      'marker.setEndTime': () => {
        if (!currentMarker || !scene) return;
        dispatch(updateMarkerTimes({
          sceneId: scene.id,
          markerId: currentMarker.id,
          startTime: currentMarker.seconds,
          endTime: currentVideoTime
        }));
      },

      'marker.copyTimes': () => {
        copyMarkerTimes();
      },

      'marker.pasteTimes': () => {
        pasteMarkerTimes();
      },

      'marker.copyForMerge': () => {
        copyMarkerForMerge();
      },

      'marker.mergeProperties': () => {
        mergeMarkerProperties();
      },

      'marker.assignSlots': () => {
        if (!currentMarker) return;
        dispatch(openSlotAssignmentModal({ marker: currentMarker }));
      },

      // Navigation
      'navigation.swimlaneUp': () => navigateBetweenSwimlanes('up'),
      'navigation.swimlaneDown': () => navigateBetweenSwimlanes('down'),
      'navigation.withinSwimlaneLeft': () => navigateWithinSwimlane('left'),
      'navigation.withinSwimlaneRight': () => navigateWithinSwimlane('right'),
      'navigation.previousUnprocessedInSwimlane': () => {
        const markerId = findPreviousUnprocessedMarkerInSwimlane();
        if (markerId) dispatch(setSelectedMarkerId(markerId));
      },
      'navigation.previousUnprocessedGlobal': () => {
        const markerId = findPreviousUnprocessedGlobal();
        if (markerId) dispatch(setSelectedMarkerId(markerId));
      },
      'navigation.nextUnprocessedInSwimlane': () => {
        const markerId = findNextUnprocessedMarkerInSwimlane();
        if (markerId) dispatch(setSelectedMarkerId(markerId));
      },
      'navigation.nextUnprocessedGlobal': () => {
        const markerId = findNextUnprocessedGlobal();
        if (markerId) dispatch(setSelectedMarkerId(markerId));
      },
      'navigation.centerPlayhead': () => centerPlayhead(),
      'navigation.zoomIn': () => zoomIn(),
      'navigation.zoomOut': () => zoomOut(),
      'navigation.resetZoom': () => resetZoom(),
      'navigation.nextMarkerAtPlayhead': () => {
        const markerId = findNextMarkerAtPlayhead(currentVideoTime);
        if (markerId) dispatch(setSelectedMarkerId(markerId));
      },
      'navigation.previousMarkerAtPlayhead': () => {
        const markerId = findPreviousMarkerAtPlayhead(currentVideoTime);
        if (markerId) dispatch(setSelectedMarkerId(markerId));
      },

      // Video Playback
      'video.playPause': () => {
        dispatch(togglePlayPause());
      },

      // Time-based seeking with configurable intervals
      'video.seekSmallBackward': () => {
        const videoConfig = getVideoConfig();
        dispatch(seekToTime(Math.max(0, currentVideoTime - videoConfig.smallSeekTime)));
      },

      'video.seekSmallForward': () => {
        const videoConfig = getVideoConfig();
        dispatch(seekToTime(Math.min(videoDuration || Infinity, currentVideoTime + videoConfig.smallSeekTime)));
      },

      'video.seekMediumBackward': () => {
        const videoConfig = getVideoConfig();
        dispatch(seekToTime(Math.max(0, currentVideoTime - videoConfig.mediumSeekTime)));
      },

      'video.seekMediumForward': () => {
        const videoConfig = getVideoConfig();
        dispatch(seekToTime(Math.min(videoDuration || Infinity, currentVideoTime + videoConfig.mediumSeekTime)));
      },

      'video.seekLongBackward': () => {
        const videoConfig = getVideoConfig();
        dispatch(seekToTime(Math.max(0, currentVideoTime - videoConfig.longSeekTime)));
      },

      'video.seekLongForward': () => {
        const videoConfig = getVideoConfig();
        dispatch(seekToTime(Math.min(videoDuration || Infinity, currentVideoTime + videoConfig.longSeekTime)));
      },

      // Frame-based stepping with configurable frame counts
      'video.frameSmallBackward': () => {
        const frameRate = getFrameRate(scene);
        const videoConfig = getVideoConfig();
        const frameTime = videoConfig.smallFrameStep / frameRate;
        dispatch(seekToTime(Math.max(0, currentVideoTime - frameTime)));
      },

      'video.frameSmallForward': () => {
        const frameRate = getFrameRate(scene);
        const videoConfig = getVideoConfig();
        const frameTime = videoConfig.smallFrameStep / frameRate;
        dispatch(seekToTime(Math.min(videoDuration || Infinity, currentVideoTime + frameTime)));
      },

      'video.frameMediumBackward': () => {
        const frameRate = getFrameRate(scene);
        const videoConfig = getVideoConfig();
        const frameTime = videoConfig.mediumFrameStep / frameRate;
        dispatch(seekToTime(Math.max(0, currentVideoTime - frameTime)));
      },

      'video.frameMediumForward': () => {
        const frameRate = getFrameRate(scene);
        const videoConfig = getVideoConfig();
        const frameTime = videoConfig.mediumFrameStep / frameRate;
        dispatch(seekToTime(Math.min(videoDuration || Infinity, currentVideoTime + frameTime)));
      },

      'video.frameLongBackward': () => {
        const frameRate = getFrameRate(scene);
        const videoConfig = getVideoConfig();
        const frameTime = videoConfig.longFrameStep / frameRate;
        dispatch(seekToTime(Math.max(0, currentVideoTime - frameTime)));
      },

      'video.frameLongForward': () => {
        const frameRate = getFrameRate(scene);
        const videoConfig = getVideoConfig();
        const frameTime = videoConfig.longFrameStep / frameRate;
        dispatch(seekToTime(Math.min(videoDuration || Infinity, currentVideoTime + frameTime)));
      },

      'video.playFromMarker': () => {
        if (!currentMarker) return;
        dispatch(seekToTime(currentMarker.seconds));
        dispatch(playVideo());
      },

      // Video Jump Navigation
      'video.jumpToMarkerStart': () => {
        if (!currentMarker) return;
        dispatch(seekToTime(currentMarker.seconds));
      },

      'video.jumpToSceneStart': () => {
        dispatch(seekToTime(0));
      },

      'video.jumpToMarkerEnd': () => {
        if (!currentMarker) return;
        dispatch(seekToTime(currentMarker.end_seconds || currentMarker.seconds));
      },

      'video.jumpToSceneEnd': () => {
        if (videoDuration) dispatch(seekToTime(videoDuration));
      },

      'video.jumpToPreviousShot': () => jumpToPreviousShot(),
      'video.jumpToNextShot': () => jumpToNextShot(),

      // System Actions

      'system.escape': () => {
        if (editingMarkerId) {
          handleCancelEdit();
        } else if (isCreatingMarker || isDuplicatingMarker) {
          const realMarkers = markers?.filter(m => !m.id.startsWith("temp-"));
          if (realMarkers) {
            dispatch(setMarkers(realMarkers));
          }
          dispatch(setCreatingMarker(false));
          dispatch(setDuplicatingMarker(false));
        }
      },

      'system.deleteRejected': () => {
        handleDeleteRejectedMarkers();
      },

      // Modal shortcuts
      'modal.confirm': () => {
        if (params.isCompletionModalOpen) {
          executeCompletion();
        } else if (params.isDeletingRejected) {
          confirmDeleteRejectedMarkers();
        } else if (params.isCorrespondingTagConversionModalOpen) {
          handleConfirmCorrespondingTagConversion();
        }
        // Note: Collecting modal has no confirm action, only cancel/close
      },

      'modal.cancel': () => {
        if (params.isCompletionModalOpen || params.isDeletingRejected || 
            params.isCorrespondingTagConversionModalOpen || params.isCollectingModalOpen) {
          dispatch(closeModal());
        }
      },
    };
  }, [dispatch, getFrameRate, getVideoConfig, params]);

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

      // Ignore keyboard shortcuts if we're typing in an input field or capturing shortcuts
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.getAttribute('data-keyboard-capture') === 'true')
      ) {
        return;
      }

      // Handle special characters that require Shift but should be treated as single keys
      const specialCharsWithoutShift = [';', ':', '"', "'", '<', '>', '?', '{', '}', '|', '+', '_', '(', ')', '!', '@', '#', '$', '%', '^', '&', '*'];
      const shouldIgnoreShift = specialCharsWithoutShift.includes(event.key) && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;

      // Get action ID from keyboard shortcut service
      let actionId = keyboardShortcutService.getActionForKeyBinding(event.key, {
        ctrl: event.ctrlKey || event.metaKey,
        alt: event.altKey,
        shift: shouldIgnoreShift ? false : event.shiftKey,
        meta: event.metaKey,
      });

      console.log(`Looking for action for key combo: ${event.key} with modifiers:`, {
        ctrl: event.ctrlKey || event.metaKey,
        alt: event.altKey,
        shift: shouldIgnoreShift ? false : event.shiftKey,
        meta: event.metaKey,
      }, `Found actionId: ${actionId}`);

      if (!actionId) {
        return; // No shortcut defined for this key combination
      }

      // Handle Enter key conflict: when no modal is open, Enter should play from marker
      const isAnyModalOpen = params.isCompletionModalOpen || params.isDeletingRejected || 
                              params.isCorrespondingTagConversionModalOpen || params.isCollectingModalOpen;
      if (actionId === 'modal.confirm' && event.key === 'Enter' && !isAnyModalOpen) {
        actionId = 'video.playFromMarker';
      }

      // Handle Escape key conflict: when no modal is open, Escape should handle system escape
      if (actionId === 'modal.cancel' && event.key === 'Escape' && !isAnyModalOpen) {
        actionId = 'system.escape';
      }

      // Get action handler
      const handlers = actionHandlers();
      const handler = handlers[actionId as keyof typeof handlers];

      if (!handler) {
        console.warn(`No handler found for action: ${actionId}`);
        return;
      }

      // Prevent default browser behavior
      event.preventDefault();

      // Execute the action
      try {
        console.log(`Executing action: ${actionId}`);
        handler();
      } catch (error) {
        console.error(`Error executing shortcut action ${actionId}:`, error);
      }
    },
    [actionHandlers, params.isCompletionModalOpen, params.isDeletingRejected, 
     params.isCorrespondingTagConversionModalOpen, params.isCollectingModalOpen]
  );

  // Modal keyboard handler
  const handleModalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isAnyModalOpen = params.isCompletionModalOpen || params.isDeletingRejected || 
                              params.isCorrespondingTagConversionModalOpen || params.isCollectingModalOpen;
      if (!isAnyModalOpen) {
        return;
      }

      // Only handle specific modal shortcuts
      const actionId = keyboardShortcutService.getActionForKeyBinding(event.key, {
        ctrl: event.ctrlKey || event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      });

      if (actionId === 'modal.confirm' || actionId === 'modal.cancel') {
        event.preventDefault();
        event.stopPropagation();

        const handlers = actionHandlers();
        const handler = handlers[actionId];
        if (handler) {
          handler();
        }
      }
    },
    [actionHandlers, params.isCompletionModalOpen, params.isDeletingRejected, 
     params.isCorrespondingTagConversionModalOpen, params.isCollectingModalOpen]
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