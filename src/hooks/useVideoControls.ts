import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  seekToTime as seekToTimeAction,
  togglePlayPause as togglePlayPauseAction,
  pauseVideo,
  selectCurrentVideoTime,
  selectVideoDuration,
} from "../store/slices/markerSlice";

/**
 * Hook that provides video control functions using Redux commands
 * instead of direct video element manipulation.
 *
 * This replaces the old pattern where video controls had direct access
 * to the video element. Now all video operations flow through Redux.
 */
export const useVideoControls = () => {
  const dispatch = useAppDispatch();
  const currentTime = useAppSelector(selectCurrentVideoTime);
  const duration = useAppSelector(selectVideoDuration);

  const seekToTime = useCallback(
    (time: number) => {
      // Clamp time to video duration bounds (if duration is available)
      const clampedTime = duration
        ? Math.max(0, Math.min(time, duration))
        : Math.max(0, time);
      dispatch(seekToTimeAction(clampedTime));
    },
    [dispatch, duration]
  );

  const seekRelative = useCallback(
    (offset: number) => {
      const newTime = currentTime + offset;
      seekToTime(newTime);
    },
    [currentTime, seekToTime]
  );

  const frameStep = useCallback(
    (forward: boolean) => {
      // Assuming 30fps - can be made configurable if needed
      const frameTime = 1 / 30;
      seekRelative(forward ? frameTime : -frameTime);
    },
    [seekRelative]
  );

  const togglePlayPause = useCallback(() => {
    dispatch(togglePlayPauseAction());
  }, [dispatch]);

  const jumpToMarkerTime = useCallback(
    (seconds: number) => {
      // Pause video first, then seek to the marker time
      dispatch(pauseVideo());
      seekToTime(seconds);
    },
    [dispatch, seekToTime]
  );

  return {
    seekToTime,
    seekRelative,
    frameStep,
    togglePlayPause,
    jumpToMarkerTime,
  };
};
