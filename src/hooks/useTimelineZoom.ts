import { useState, useRef, useEffect, useCallback } from "react";

const ZOOM_LEVELS = [1.0, 1.5, 3.0, 6.0, 12.0];

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

export function useTimelineZoom(_videoDuration: number | null): UseTimelineZoomReturn {
  // Zoom state - now represents multiplier relative to fit-to-window
  const [zoom, setZoom] = useState(1);
  const [timelineContainerWidth, setTimelineContainerWidth] = useState(0);
  const [_availableTimelineWidth, setAvailableTimelineWidth] = useState<number | null>(null);

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

  // Calculate fit-to-window zoom level (always 1x in the new system)
  const calculateFitZoom = useCallback(() => {
    return 1;
  }, []);

  // Get current minimum zoom (always 1x - fit-to-window)
  const getMinZoom = useCallback(() => {
    return 1;
  }, []);

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

  const zoomOut = useCallback(() => {
    setZoom((prevZoom) => {
      const closestLevel = findClosestZoomLevel(prevZoom);
      const currentIndex = ZOOM_LEVELS.indexOf(closestLevel);
      if (currentIndex <= 0) {
        return ZOOM_LEVELS[0]; // Minimum is 1x (fit-to-window)
      }
      return ZOOM_LEVELS[currentIndex - 1];
    });
  }, [findClosestZoomLevel]);

  const resetZoom = useCallback(() => {
    setZoom(1); // Reset to fit-to-window (1x)
  }, []);

  // Zoom is always initialized to 1 (fit-to-window) and maintained by user actions

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