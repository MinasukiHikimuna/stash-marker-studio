import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectPendingSeek,
  selectPendingPlayPause,
  selectScene,
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
  const scene = useAppSelector(selectScene);
  const pendingSeek = useAppSelector(selectPendingSeek);
  const pendingPlayPause = useAppSelector(selectPendingPlayPause);
  
  const stashUrl = useAppSelector((state) => state.config.stashUrl);
  const stashApiKey = useAppSelector((state) => state.config.stashApiKey);
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

  // Video element stays local - following Redux migration architecture decision

  // Set up video event listeners to dispatch metadata updates to Redux
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      // Update Redux only - MarkerContext removed
      dispatch(setVideoDuration(video.duration));
    };

    const handleTimeUpdate = () => {
      // Update Redux only - MarkerContext removed
      dispatch(setCurrentVideoTime(video.currentTime));
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
  }, [dispatch]); // Redux dispatch for video metadata updates

  if (!scene) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      src={`${stashUrl}/scene/${scene.id}/stream?apikey=${stashApiKey}`}
      controls
      className={`w-full h-full object-contain ${className}`}
      tabIndex={-1}
    >
      Your browser does not support the video tag.
    </video>
  );
}
