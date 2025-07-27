import { useState, useRef, useEffect, useCallback } from "react";

const ZOOM_LEVELS = [1.0, 1.5, 3.0, 5.0];

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

  // Find closest zoom level to current zoom
  const findClosestZoomLevel = useCallback((currentZoom: number) => {
    return ZOOM_LEVELS.reduce((prev, curr) => 
      Math.abs(curr - currentZoom) < Math.abs(prev - currentZoom) ? curr : prev
    );
  }, []);

  // Zoom control functions
  const zoomIn = useCallback(() => {
    setZoom((prevZoom) => {
      const closestLevel = findClosestZoomLevel(prevZoom);
      const currentIndex = ZOOM_LEVELS.indexOf(closestLevel);
      if (currentIndex === -1 || currentIndex === ZOOM_LEVELS.length - 1) {
        return ZOOM_LEVELS[ZOOM_LEVELS.length - 1]; // Max zoom
      }
      return ZOOM_LEVELS[currentIndex + 1];
    });
  }, [findClosestZoomLevel]);

  const zoomOut = useCallback((uniformTagLabelWidth?: number) => {
    const minZoom = getMinZoom(uniformTagLabelWidth);
    setZoom((prevZoom) => {
      const closestLevel = findClosestZoomLevel(prevZoom);
      const currentIndex = ZOOM_LEVELS.indexOf(closestLevel);
      if (currentIndex <= 0) {
        return Math.max(minZoom, ZOOM_LEVELS[0]); // Respect minimum zoom (fit-to-window)
      }
      return Math.max(minZoom, ZOOM_LEVELS[currentIndex - 1]);
    });
  }, [getMinZoom, findClosestZoomLevel]);

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