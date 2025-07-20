import { useEffect, useRef } from "react";
import { useConfig } from "@/contexts/ConfigContext";
import { useMarker } from "@/contexts/MarkerContext";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectPendingSeek,
  selectPendingPlayPause,
  setVideoDuration,
  setCurrentVideoTime,
  setVideoPlaying,
  clearPendingSeek,
  clearPendingPlayPause,
} from "@/store/slices/markerSlice";

interface VideoPlayerProps {
  className?: string;
}

export function VideoPlayer({ className = "" }: VideoPlayerProps) {
  const dispatch = useAppDispatch();
  const { state, dispatch: markerDispatch } = useMarker(); // Use MarkerContext for scene during migration
  const pendingSeek = useAppSelector(selectPendingSeek);
  const pendingPlayPause = useAppSelector(selectPendingPlayPause);
  
  const { STASH_URL, STASH_API_KEY } = useConfig();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle pending seek commands from Redux
  useEffect(() => {
    if (pendingSeek && videoRef.current) {
      const video = videoRef.current;
      const clampedTime = Math.max(
        0,
        Math.min(pendingSeek.time, video.duration || pendingSeek.time)
      );
      video.currentTime = clampedTime;
      dispatch(clearPendingSeek());
    }
  }, [pendingSeek, dispatch]);

  // Handle pending play/pause commands from Redux
  useEffect(() => {
    if (pendingPlayPause && videoRef.current) {
      const video = videoRef.current;
      if (pendingPlayPause.action === "play") {
        video.play().catch(console.error);
      } else {
        video.pause();
      }
      dispatch(clearPendingPlayPause());
    }
  }, [pendingPlayPause, dispatch]);

  // Set video element in MarkerContext (for compatibility during migration)
  useEffect(() => {
    if (videoRef.current) {
      markerDispatch({ type: "SET_VIDEO_ELEMENT", payload: videoRef.current });
    }
    return () => {
      markerDispatch({ type: "SET_VIDEO_ELEMENT", payload: null });
    };
  }, [markerDispatch]);

  // Set up video event listeners to dispatch metadata updates to Redux
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      // Update both Redux and MarkerContext during migration period
      dispatch(setVideoDuration(video.duration));
      markerDispatch({ type: "SET_VIDEO_DURATION", payload: video.duration });
    };

    const handleTimeUpdate = () => {
      // Update both Redux and MarkerContext during migration period
      dispatch(setCurrentVideoTime(video.currentTime));
      markerDispatch({ type: "SET_CURRENT_VIDEO_TIME", payload: video.currentTime });
    };

    const handlePlay = () => {
      dispatch(setVideoPlaying(true));
    };

    const handlePause = () => {
      dispatch(setVideoPlaying(false));
    };

    // Add all event listeners
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeking", handleTimeUpdate);
    video.addEventListener("seeked", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    // Cleanup function
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeking", handleTimeUpdate);
      video.removeEventListener("seeked", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [dispatch, markerDispatch]); // Include both dispatchers in dependencies

  if (!state.scene) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      src={`${STASH_URL}/scene/${state.scene.id}/stream?apikey=${STASH_API_KEY}`}
      controls
      className={`w-full h-full object-contain ${className}`}
      tabIndex={-1}
    >
      Your browser does not support the video tag.
    </video>
  );
}
