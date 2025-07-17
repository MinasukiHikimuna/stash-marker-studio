"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { SpriteFrame } from "../services/StashappService";

type SpritePreviewProps = {
  spriteFrames: SpriteFrame[];
  currentTime: number;
  visible: boolean;
  x: number;
  y: number;
  currentFrame?: SpriteFrame | null; // Optional pre-calculated frame for optimization
  getSpriteUrlWithApiKey: (spritePath: string) => string;
};

export default function SpritePreview({
  spriteFrames,
  currentTime,
  visible,
  x,
  y,
  currentFrame,
  getSpriteUrlWithApiKey,
}: SpritePreviewProps) {
  const [activeFrame, setActiveFrame] = useState<SpriteFrame | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentSpriteUrl, setCurrentSpriteUrl] = useState<string>("");
  const imageRef = useRef<HTMLImageElement>(null);

  // Find the current sprite frame based on time or use provided frame
  useEffect(() => {
    // If currentFrame is provided, use it directly (optimized path)
    if (currentFrame) {
      setActiveFrame((prevFrame) => {
        const isDifferentFrame =
          !prevFrame ||
          prevFrame.spriteUrl !== currentFrame.spriteUrl ||
          prevFrame.x !== currentFrame.x ||
          prevFrame.y !== currentFrame.y ||
          prevFrame.width !== currentFrame.width ||
          prevFrame.height !== currentFrame.height;

        if (isDifferentFrame) {
          const newSpriteUrl = getSpriteUrlWithApiKey(currentFrame.spriteUrl);
          setCurrentSpriteUrl(newSpriteUrl);

          // Only reset image loaded state when the sprite URL actually changes
          const spriteUrlChanged =
            !prevFrame || prevFrame.spriteUrl !== currentFrame.spriteUrl;
          if (spriteUrlChanged) {
            setImageLoaded(false);
          }

          return currentFrame;
        }
        return prevFrame; // Keep the same frame
      });
      return;
    }

    // Fallback: search through spriteFrames (legacy path)
    if (spriteFrames.length === 0) {
      setActiveFrame(null);
      return;
    }

    const frame = spriteFrames.find(
      (frame) => currentTime >= frame.startTime && currentTime < frame.endTime
    );

    setActiveFrame((prevFrame) => {
      // Only update if we have a frame and it's actually different
      if (frame) {
        const isDifferentFrame =
          !prevFrame ||
          prevFrame.spriteUrl !== frame.spriteUrl ||
          prevFrame.x !== frame.x ||
          prevFrame.y !== frame.y ||
          prevFrame.width !== frame.width ||
          prevFrame.height !== frame.height;

        if (isDifferentFrame) {
          const newSpriteUrl = getSpriteUrlWithApiKey(frame.spriteUrl);
          setCurrentSpriteUrl(newSpriteUrl);

          // Only reset image loaded state when the sprite URL actually changes
          const spriteUrlChanged =
            !prevFrame || prevFrame.spriteUrl !== frame.spriteUrl;
          if (spriteUrlChanged) {
            setImageLoaded(false);
          }

          return frame;
        }
        return prevFrame; // Keep the same frame
      } else {
        // Clear frame if no frame found for current time
        if (prevFrame) {
          setImageLoaded(false);
        }
        return null;
      }
    });
  }, [currentTime, currentFrame, spriteFrames, getSpriteUrlWithApiKey]);

  // Handle image load - only set loaded if it's for the current sprite URL
  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const loadedImageSrc = e.currentTarget.src;
      if (loadedImageSrc === currentSpriteUrl) {
        setImageLoaded(true);
      }
    },
    [currentSpriteUrl]
  );

  if (!visible || !activeFrame) {
    return null;
  }

  const spriteUrl = getSpriteUrlWithApiKey(activeFrame.spriteUrl);

  return (
    <div
      className="fixed pointer-events-none z-50 bg-black border border-gray-400 shadow-lg"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        width: activeFrame.width,
        height: activeFrame.height,
        opacity: imageLoaded ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
      }}
    >
      <Image
        ref={imageRef}
        src={spriteUrl}
        alt="Video preview"
        onLoad={handleImageLoad}
        className="absolute top-0 left-0"
        width={activeFrame.width}
        height={activeFrame.height}
        style={{
          objectFit: "none",
          objectPosition: `-${activeFrame.x}px -${activeFrame.y}px`,
          width: activeFrame.width,
          height: activeFrame.height,
        }}
        unoptimized // Since we're dealing with dynamic sprite URLs
      />
      {/* Time indicator */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs text-center py-1">
        {formatTime(
          currentFrame
            ? (activeFrame.startTime + activeFrame.endTime) / 2
            : currentTime
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
