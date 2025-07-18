import { useEffect, useRef } from "react";
import { useMarker } from "../../../contexts/MarkerContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useVideoControls } from "@/hooks/useVideoControls";

interface VideoPlayerProps {
  className?: string;
}

export function VideoPlayer({ className = "" }: VideoPlayerProps) {
  const { state, dispatch } = useMarker();
  const { STASH_URL, STASH_API_KEY } = useConfig();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { setupVideoEventListeners } = useVideoControls({ state, dispatch });

  useEffect(() => {
    if (videoRef.current && !state.videoElement) {
      dispatch({ type: "SET_VIDEO_ELEMENT", payload: videoRef.current });
    }
  }, [dispatch, state.videoElement]);

  useEffect(() => {
    if (videoRef.current) {
      const cleanup = setupVideoEventListeners(videoRef.current);
      return () => {
        cleanup();
        dispatch({ type: "SET_VIDEO_ELEMENT", payload: null });
      };
    }
  }, [dispatch, setupVideoEventListeners]);

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
