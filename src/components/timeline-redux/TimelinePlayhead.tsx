import React from 'react';
import { calculatePlayheadPosition } from '../../core/timeline/calculations';

export interface TimelinePlayheadProps {
  /** Current playback time in seconds */
  currentTime: number;
  /** Conversion factor from seconds to pixels */
  pixelsPerSecond: number;
  /** Height of the swimlane area in pixels */
  swimlaneHeight: number;
}

/**
 * TimelinePlayhead renders a vertical line indicator showing the current playback position.
 * It is rendered within each swimlane area only (not in the header).
 *
 * The playhead is positioned absolutely based on the current time and pixels per second ratio.
 * It uses red color to match the original Timeline implementation.
 */
const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  currentTime,
  pixelsPerSecond,
  swimlaneHeight,
}) => {
  const playheadPosition = calculatePlayheadPosition(currentTime, pixelsPerSecond);

  return (
    <div
      className="absolute top-0 w-0.5 bg-red-500 pointer-events-none z-10"
      style={{
        left: `${playheadPosition}px`,
        height: `${swimlaneHeight}px`,
        transform: 'translateX(-50%)',
      }}
      aria-hidden="true"
    />
  );
};

TimelinePlayhead.displayName = 'TimelinePlayhead';

export default TimelinePlayhead;
