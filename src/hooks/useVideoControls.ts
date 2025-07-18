import { useCallback } from "react";
import { MarkerContextType } from "../core/marker/types";

export const useVideoControls = ({ state, dispatch }: MarkerContextType) => {
  const updateCurrentTime = useCallback(() => {
    if (state.videoElement) {
      dispatch({
        type: "SET_CURRENT_VIDEO_TIME",
        payload: state.videoElement.currentTime,
      });
    }
  }, [state.videoElement, dispatch]);

  const seekToTime = useCallback(
    (time: number) => {
      if (state.videoElement) {
        state.videoElement.currentTime = Math.max(
          0,
          Math.min(time, state.videoDuration)
        );
        updateCurrentTime();
      }
    },
    [state.videoElement, state.videoDuration, updateCurrentTime]
  );

  const seekRelative = useCallback(
    (offset: number) => {
      if (state.videoElement) {
        seekToTime(state.videoElement.currentTime + offset);
      }
    },
    [state.videoElement, seekToTime]
  );

  const frameStep = useCallback(
    (forward: boolean) => {
      if (state.videoElement) {
        // Assuming 30fps - can be made configurable if needed
        const frameTime = 1 / 30;
        seekRelative(forward ? frameTime : -frameTime);
      }
    },
    [state.videoElement, seekRelative]
  );

  const togglePlayPause = useCallback(() => {
    if (state.videoElement) {
      if (state.videoElement.paused) {
        state.videoElement.play();
      } else {
        state.videoElement.pause();
      }
    }
  }, [state.videoElement]);

  const jumpToMarkerTime = useCallback(
    (seconds: number, endSeconds: number | null) => {
      if (state.videoElement) {
        state.videoElement.pause();
        seekToTime(seconds);
      }
    },
    [state.videoElement, seekToTime]
  );

  const setupVideoEventListeners = useCallback(
    (videoElement: HTMLVideoElement) => {
      const handleLoadedMetadata = () => {
        dispatch({
          type: "SET_VIDEO_DURATION",
          payload: videoElement.duration,
        });
      };

      videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.addEventListener("timeupdate", updateCurrentTime);
      videoElement.addEventListener("seeking", updateCurrentTime);
      videoElement.addEventListener("seeked", updateCurrentTime);

      return () => {
        videoElement.removeEventListener(
          "loadedmetadata",
          handleLoadedMetadata
        );
        videoElement.removeEventListener("timeupdate", updateCurrentTime);
        videoElement.removeEventListener("seeking", updateCurrentTime);
        videoElement.removeEventListener("seeked", updateCurrentTime);
      };
    },
    [dispatch, updateCurrentTime]
  );

  return {
    seekToTime,
    seekRelative,
    frameStep,
    togglePlayPause,
    jumpToMarkerTime,
    setupVideoEventListeners,
    updateCurrentTime,
  };
};
