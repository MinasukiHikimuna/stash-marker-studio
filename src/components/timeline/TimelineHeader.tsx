"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { type SceneMarker, type SpriteFrame, type Scene, stashappService } from "../../services/StashappService";
import { useAppDispatch } from "../../store/hooks";
import { seekToTime } from "../../store/slices/markerSlice";
import { isShotBoundaryMarker } from "../../core/marker/markerLogic";
import SpritePreview from "../SpritePreview";

type TimelineHeaderProps = {
  markers: SceneMarker[];
  videoDuration: number;
  currentTime: number;
  showShotBoundaries: boolean;
  timelineWidth: { width: number; pixelsPerSecond: number };
  scene?: Scene;
};

const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  markers,
  videoDuration,
  currentTime,
  showShotBoundaries,
  timelineWidth,
  scene,
}) => {
  const dispatch = useAppDispatch();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [spriteFrames, setSpriteFrames] = useState<SpriteFrame[]>([]);
  const [previewSprite, setPreviewSprite] = useState<{
    frame: SpriteFrame;
    x: number;
    y: number;
  } | null>(null);

  // Fetch sprite frames for the scene using direct Stashapp URLs
  useEffect(() => {
    let isCancelled = false;

    const fetchSpriteFrames = async () => {
      if (scene?.paths?.vtt) {
        try {
          console.log("Fetching sprite frames for VTT:", scene.paths.vtt);
          const frames = await stashappService.fetchSpriteFrames(
            scene.paths.vtt
          );
          if (!isCancelled) {
            setSpriteFrames(frames);
            console.log("Loaded", frames.length, "sprite frames");
          }
        } catch (error) {
          if (!isCancelled) {
            console.error("Error loading sprite frames:", error);
            setSpriteFrames([]);
          }
        }
      } else {
        if (!isCancelled) {
          setSpriteFrames([]);
        }
      }
    };

    fetchSpriteFrames();

    return () => {
      isCancelled = true;
    };
  }, [scene?.paths?.vtt]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const mouseXInDiv = e.clientX - rect.left;
      const time = (mouseXInDiv + timelineRef.current.scrollLeft) / timelineWidth.pixelsPerSecond;

      const seekTime = Math.max(0, Math.min(time, videoDuration));
      dispatch(seekToTime(seekTime));
    },
    [timelineWidth.pixelsPerSecond, videoDuration, dispatch]
  );

  const handleHeaderMouseMoveForPreview = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || spriteFrames.length === 0) {
        setPreviewSprite(null);
        return;
      }

      const rect = timelineRef.current.getBoundingClientRect();
      const mouseXInDiv = e.clientX - rect.left;
      const time = (mouseXInDiv + timelineRef.current.scrollLeft) / timelineWidth.pixelsPerSecond;

      const frame = spriteFrames.find(
        (f) => time >= f.startTime && time < f.endTime
      );

      if (frame) {
        setPreviewSprite({
          frame: frame,
          x: e.clientX,
          y: rect.top - 10, // show it a bit above the timeline
        });
      } else {
        setPreviewSprite(null);
      }
    },
    [timelineWidth.pixelsPerSecond, spriteFrames]
  );

  const handleHeaderMouseLeaveForPreview = useCallback(() => {
    setPreviewSprite(null);
  }, []);

  return (
    <div className="flex">
      {/* Left header */}
      <div className="flex-shrink-0 w-48 bg-gray-700 border-r border-gray-600 border-b border-gray-600">
        <div className="h-8 flex items-center px-3">
          <span className="text-xs text-gray-400">Tags</span>
        </div>
      </div>
      
      {/* Right header - timeline */}
      <div 
        ref={timelineRef}
        className="flex-1 overflow-x-auto"
      >
        <div style={{ width: `${timelineWidth.width}px` }}>
          <div 
            className="h-8 bg-gray-700 border-b border-gray-600 relative cursor-pointer"
            onClick={handleTimelineClick}
            onMouseMove={handleHeaderMouseMoveForPreview}
            onMouseLeave={handleHeaderMouseLeaveForPreview}
            title="Click to seek to time"
          >
            {/* Minute markers */}
            {Array.from({ length: Math.floor(videoDuration / 60) + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-l border-gray-600 flex items-center"
                style={{ left: `${i * 60 * timelineWidth.pixelsPerSecond}px` }}
              >
                <span className="text-xs text-gray-400 ml-1">
                  {formatTime(i * 60)}
                </span>
              </div>
            ))}
            
            {/* Shot boundaries integrated into time header */}
            {showShotBoundaries &&
              markers &&
              markers.filter(isShotBoundaryMarker).map((marker) => (
                <div
                  key={`shot-${marker.id}`}
                  className="absolute top-0 h-full cursor-pointer group"
                  style={{
                    left: `${marker.seconds * timelineWidth.pixelsPerSecond}px`,
                    width: "2px",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(seekToTime(marker.seconds));
                  }}
                  title={`Shot boundary: ${formatTime(marker.seconds)}`}
                >
                  {/* Shot boundary line */}
                  <div className="w-full h-full bg-orange-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Small indicator at bottom */}
                  <div className="absolute bottom-0 left-0 w-1 h-1 bg-orange-400 transform translate-x-[-50%] rounded-full opacity-80" />
                </div>
              ))}
            
            {/* Current time indicator */}
            <div
              className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
              style={{ left: `${currentTime * timelineWidth.pixelsPerSecond}px` }}
            />
          </div>
        </div>
      </div>
      
      {/* Sprite preview */}
      {previewSprite && (
        <SpritePreview
          visible={true}
          x={previewSprite.x}
          y={previewSprite.y}
          currentFrame={previewSprite.frame}
          getSpriteUrlWithApiKey={stashappService.getSpriteUrlWithApiKey}
          spriteFrames={[]}
          currentTime={0}
        />
      )}
    </div>
  );
};

export default TimelineHeader;