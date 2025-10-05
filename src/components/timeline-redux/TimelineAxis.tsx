/**
 * TimelineAxis - Renders the time axis with tick marks and shot boundaries
 *
 * This component:
 * - Renders minute tick marks with time labels
 * - Displays shot boundary markers if enabled
 * - Handles click-to-seek functionality
 * - Provides hover feedback for sprite previews (via callbacks)
 */

"use client";

import React, { useCallback, useRef } from "react";
import type { ShotBoundary } from "../../core/shotBoundary/types";

export interface TimelineAxisProps {
  /** Total video duration in seconds */
  videoDuration: number;
  /** Conversion factor from seconds to pixels */
  pixelsPerSecond: number;
  /** Total timeline width in pixels */
  timelineWidth: number;
  /** Whether to show shot boundary markers */
  showShotBoundaries: boolean;
  /** Shot boundaries (separate from markers) */
  shotBoundaries: ShotBoundary[];
  /** Callback when user clicks on the timeline to seek */
  onSeek: (time: number) => void;
  /** Optional callback when mouse moves over timeline (for sprite preview) */
  onTimeHover?: (time: number, x: number, y: number) => void;
  /** Optional callback when mouse leaves timeline */
  onTimeHoverEnd?: () => void;
}

/**
 * Format time in seconds to MM:SS format
 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export const TimelineAxis: React.FC<TimelineAxisProps> = ({
  videoDuration,
  pixelsPerSecond,
  timelineWidth,
  showShotBoundaries,
  shotBoundaries,
  onSeek,
  onTimeHover,
  onTimeHoverEnd,
}) => {
  const axisRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!axisRef.current) return;

      const rect = axisRef.current.getBoundingClientRect();
      const mouseXInDiv = e.clientX - rect.left;
      const time = (mouseXInDiv + axisRef.current.scrollLeft) / pixelsPerSecond;

      const seekTime = Math.max(0, Math.min(time, videoDuration));
      onSeek(seekTime);
    },
    [pixelsPerSecond, videoDuration, onSeek]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!axisRef.current || !onTimeHover) return;

      const rect = axisRef.current.getBoundingClientRect();
      const mouseXInDiv = e.clientX - rect.left;
      const time = (mouseXInDiv + axisRef.current.scrollLeft) / pixelsPerSecond;

      onTimeHover(time, e.clientX, rect.top - 10);
    },
    [pixelsPerSecond, onTimeHover]
  );

  const handleMouseLeave = useCallback(() => {
    if (onTimeHoverEnd) {
      onTimeHoverEnd();
    }
  }, [onTimeHoverEnd]);

  const handleShotBoundaryClick = useCallback(
    (e: React.MouseEvent, time: number) => {
      e.stopPropagation();
      onSeek(time);
    },
    [onSeek]
  );

  // Calculate number of minute markers
  const minuteCount = Math.floor(videoDuration / 60) + 1;

  // Use shot boundaries if enabled
  const visibleShotBoundaries = showShotBoundaries ? shotBoundaries : [];

  return (
    <div style={{ width: `${timelineWidth}px` }}>
      <div
        ref={axisRef}
        className="h-8 bg-gray-700 border-b border-gray-600 relative cursor-pointer overflow-hidden"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        title="Click to seek to time"
      >
        {/* Minute tick marks */}
        {Array.from({ length: minuteCount }).map((_, i) => (
          <div
            key={`minute-${i}`}
            className="absolute top-0 h-full border-l border-gray-600 flex items-center"
            style={{ left: `${i * 60 * pixelsPerSecond}px` }}
          >
            <span className="text-xs text-gray-400 ml-1">
              {formatTime(i * 60)}
            </span>
          </div>
        ))}

        {/* Shot boundaries */}
        {visibleShotBoundaries.map((marker) => (
          <div
            key={`shot-${marker.id}`}
            className="absolute top-0 h-full cursor-pointer group"
            style={{
              left: `${marker.seconds * pixelsPerSecond}px`,
              width: "2px",
            }}
            onClick={(e) => handleShotBoundaryClick(e, marker.seconds)}
            title={`Shot boundary: ${formatTime(marker.seconds)}`}
          >
            {/* Shot boundary line */}
            <div className="w-full h-full bg-orange-400 opacity-60 group-hover:opacity-100 transition-opacity" />

            {/* Small indicator at bottom */}
            <div className="absolute bottom-0 left-0 w-1 h-1 bg-orange-400 transform translate-x-[-50%] rounded-full opacity-80" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineAxis;
