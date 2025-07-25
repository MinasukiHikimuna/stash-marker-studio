import { useState, useRef, useEffect, useCallback } from "react";

export interface UseTimelineZoomReturn {
  zoom: number;
  setZoom: (zoom: number) => void;
  timelineContainerWidth: number;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: (uniformTagLabelWidth?: number) => void;
  getMinZoom: (uniformTagLabelWidth?: number) => number;
  calculateFitZoom: (uniformTagLabelWidth?: number) => number;
  setAvailableTimelineWidth: (width: number) => void;
}

export function useTimelineZoom(videoDuration: number | null): UseTimelineZoomReturn {
  // Zoom state
  const [zoom, setZoom] = useState(1);
  const [timelineContainerWidth, setTimelineContainerWidth] = useState(0);
  const [availableTimelineWidth, setAvailableTimelineWidth] = useState<number | null>(null);

  // Timeline container ref for fit-to-window functionality
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Track timeline container width using ResizeObserver
  useEffect(() => {
    const updateContainerWidth = () => {
      if (timelineContainerRef.current) {
        const width = timelineContainerRef.current.clientWidth;
        setTimelineContainerWidth(width);
      }
    };

    // Set initial width
    updateContainerWidth();

    const observer = new ResizeObserver(updateContainerWidth);
    if (timelineContainerRef.current) {
      observer.observe(timelineContainerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Calculate fit-to-window zoom level
  const calculateFitZoom = useCallback((uniformTagLabelWidth?: number) => {
    if (videoDuration && videoDuration > 0) {
      // Base timeline width at 1x zoom is 300px per minute
      const basePixelsPerMinute = 300;
      const totalMinutes = videoDuration / 60;
      const baseTimelineWidth = totalMinutes * basePixelsPerMinute;

      // Use the precise available width from Timeline component if available
      let availableWidth: number;
      if (availableTimelineWidth !== null) {
        availableWidth = availableTimelineWidth;
      } else if (timelineContainerWidth > 0) {
        // Fallback calculation if Timeline hasn't reported width yet
        const labelWidth = uniformTagLabelWidth || 333;
        const scrollbarMargin = 20;
        availableWidth = timelineContainerWidth - labelWidth - scrollbarMargin;
      } else {
        return 1; // No width information available
      }
      
      const fitZoom = Math.max(
        0.01, // Very low minimum to allow extreme zoom out if needed
        Math.min(10, availableWidth / baseTimelineWidth)
      );

      return fitZoom;
    }
    return 1; // Fallback
  }, [videoDuration, timelineContainerWidth, availableTimelineWidth]);

  // Get current minimum zoom (fit-to-window level)
  const getMinZoom = useCallback((uniformTagLabelWidth?: number) => {
    return Math.max(0.01, calculateFitZoom(uniformTagLabelWidth)); // Very low minimum
  }, [calculateFitZoom]);

  const zoomFactor = 2.25;

  // Zoom control functions
  const zoomIn = useCallback(() => {
    setZoom((prevZoom) => {
      const newZoom = Math.min(10, prevZoom * zoomFactor);
      return newZoom;
    });
  }, []);

  const zoomOut = useCallback((uniformTagLabelWidth?: number) => {
    const minZoom = getMinZoom(uniformTagLabelWidth);
    setZoom((prevZoom) => Math.max(minZoom, prevZoom / zoomFactor));
  }, [getMinZoom]);

  const resetZoom = useCallback((uniformTagLabelWidth?: number) => {
    const fitZoom = calculateFitZoom(uniformTagLabelWidth);
    setZoom(fitZoom);
  }, [calculateFitZoom]);

  // Set default zoom to fit-to-window when data becomes available
  useEffect(() => {
    if (videoDuration && videoDuration > 0 && (availableTimelineWidth !== null || timelineContainerWidth > 0)) {
      const fitZoom = calculateFitZoom();
      // Only set if we're still at the initial zoom level (1)
      if (zoom === 1) {
        setZoom(fitZoom);
      }
    }
  }, [videoDuration, timelineContainerWidth, availableTimelineWidth, calculateFitZoom, zoom]);

  // Auto-adjust zoom when container width changes (for window resizing)
  useEffect(() => {
    if (videoDuration && videoDuration > 0 && (availableTimelineWidth !== null || timelineContainerWidth > 0)) {
      const currentMinZoom = calculateFitZoom();

      // If current zoom is at or below the new minimum, update to new fit-to-window level
      // This handles window resizing where the fit level changes
      if (zoom <= currentMinZoom + 0.01) {
        // Small tolerance for floating point comparison
        setZoom(currentMinZoom);
      }
    }
  }, [timelineContainerWidth, availableTimelineWidth, calculateFitZoom, videoDuration, zoom]);

  const updateAvailableTimelineWidth = useCallback((width: number) => {
    setAvailableTimelineWidth(width);
  }, []);

  return {
    zoom,
    setZoom,
    timelineContainerWidth,
    timelineContainerRef,
    zoomIn,
    zoomOut,
    resetZoom,
    getMinZoom,
    calculateFitZoom,
    setAvailableTimelineWidth: updateAvailableTimelineWidth,
  };
}