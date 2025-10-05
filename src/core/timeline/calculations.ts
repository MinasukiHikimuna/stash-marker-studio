/**
 * Pure calculation functions for timeline positioning and sizing
 * These functions handle all time/pixel conversions and layout calculations
 */

import { SceneMarker } from "../../services/StashappService";

/**
 * Timeline layout constants
 */
export const TIMELINE_CONSTANTS = {
  /** Estimated margin to account for vertical scrollbar in swimlanes container (approximate) */
  SCROLLBAR_ESTIMATE: 20,
  /** Tolerance for width calculations to handle small rounding differences */
  WIDTH_TOLERANCE: 50,
  /** Minimum marker width for clickability */
  MIN_MARKER_WIDTH: 4,
  /** Default duration for markers without end time (for width calculation) */
  DEFAULT_MARKER_DURATION: 0.1,
} as const;

/**
 * Convert time in seconds to pixel position
 */
export function timeToPixels(time: number, pixelsPerSecond: number): number {
  return time * pixelsPerSecond;
}

/**
 * Convert pixel position to time in seconds
 */
export function pixelsToTime(pixels: number, pixelsPerSecond: number): number {
  if (pixelsPerSecond === 0) return 0;
  return pixels / pixelsPerSecond;
}

/**
 * Calculate timeline width and pixels per second based on video duration, zoom, and available space
 * @param zoom - Zoom multiplier relative to fit-to-window (1x = fit to window, 2x = double the detail, etc.)
 */
export function calculateTimelineWidth(
  videoDuration: number,
  zoom: number,
  containerWidth: number,
  labelWidth: number
): { width: number; pixelsPerSecond: number } {
  if (videoDuration <= 0) {
    return { width: 0, pixelsPerSecond: 0 };
  }

  // Calculate base pixels per minute that fits the entire video in the available space
  const availableWidth = containerWidth > 0 ? containerWidth - labelWidth : 0;
  const totalMinutes = videoDuration / 60;
  const baseFitPixelsPerMinute = availableWidth > 0 ? availableWidth / totalMinutes : 300;

  // Apply zoom multiplier to the fit baseline
  const pixelsPerSecond = (baseFitPixelsPerMinute / 60) * zoom;
  const idealWidth = videoDuration * pixelsPerSecond;

  // Smart width constraint: allow timeline to exceed container when zoomed,
  // but constrain to fit when timeline would naturally fit
  let actualWidth = idealWidth;
  if (containerWidth > 0) {
    // Only constrain if timeline would fit naturally (not intentionally zoomed beyond container)
    // Add tolerance for small calculation differences between fit-zoom and actual layout
    if (idealWidth <= availableWidth + TIMELINE_CONSTANTS.WIDTH_TOLERANCE) {
      actualWidth = Math.min(idealWidth, availableWidth);
    }
    // If idealWidth > availableWidth, user is intentionally zoomed in, so allow scrolling
  }

  return {
    width: actualWidth,
    pixelsPerSecond: actualWidth / videoDuration,
  };
}

/**
 * Calculate marker position and width in pixels
 */
export function calculateMarkerPosition(
  marker: SceneMarker,
  pixelsPerSecond: number
): { left: number; width: number } {
  const startTime = marker.seconds || 0;
  const endTime = marker.end_seconds ?? startTime;

  const left = timeToPixels(startTime, pixelsPerSecond);

  // Markers without end time are displayed as narrow clickable bars
  const duration = endTime > startTime ? endTime - startTime : TIMELINE_CONSTANTS.DEFAULT_MARKER_DURATION;
  const width = Math.max(TIMELINE_CONSTANTS.MIN_MARKER_WIDTH, timeToPixels(duration, pixelsPerSecond));

  return { left, width };
}

/**
 * Calculate playhead position in pixels
 */
export function calculatePlayheadPosition(
  currentTime: number,
  pixelsPerSecond: number
): number {
  return timeToPixels(currentTime, pixelsPerSecond);
}

/**
 * Calculate scroll position to center a specific time in the viewport
 */
export function calculateCenterScrollPosition(
  targetTime: number,
  pixelsPerSecond: number,
  labelWidth: number,
  containerWidth: number
): number {
  const pixelPosition = timeToPixels(targetTime, pixelsPerSecond);
  const absolutePosition = labelWidth + pixelPosition;
  const targetScrollLeft = absolutePosition - containerWidth / 2;

  return Math.max(0, targetScrollLeft);
}

/**
 * Check if a marker is visible in the current viewport
 */
export function isMarkerVisible(
  marker: SceneMarker,
  pixelsPerSecond: number,
  labelWidth: number,
  scrollLeft: number,
  containerWidth: number
): boolean {
  const markerStartTime = marker.seconds || 0;
  const markerEndTime = marker.end_seconds || markerStartTime + 1;
  const markerCenterTime = (markerStartTime + markerEndTime) / 2;

  const markerPixelPosition = timeToPixels(markerCenterTime, pixelsPerSecond);
  const markerAbsolutePosition = labelWidth + markerPixelPosition;

  const viewportStart = scrollLeft + labelWidth;
  const viewportEnd = scrollLeft + containerWidth;

  return markerAbsolutePosition >= viewportStart && markerAbsolutePosition <= viewportEnd;
}
