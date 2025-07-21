import { useState, useRef, useEffect, useCallback } from "react";

export interface UseTimelineZoomReturn {
  zoom: number;
  setZoom: (zoom: number) => void;
  timelineContainerWidth: number;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  getMinZoom: () => number;
  calculateFitZoom: () => number;
}

export function useTimelineZoom(videoDuration: number | null): UseTimelineZoomReturn {
  // Zoom state
  const [zoom, setZoom] = useState(1);
  const [timelineContainerWidth, setTimelineContainerWidth] = useState(0);

  // Timeline container ref for fit-to-window functionality
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Track timeline container width for fit-to-window
  useEffect(() => {
    if (!timelineContainerRef.current) {
      // Fallback: use window width minus estimated sidebar and padding
      const fallbackWidth = window.innerWidth - 192 - 48; // sidebar + padding
      setTimelineContainerWidth(fallbackWidth);
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setTimelineContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(timelineContainerRef.current);

    // Also set initial width
    const initialWidth = timelineContainerRef.current.clientWidth;
    if (initialWidth > 0) {
      setTimelineContainerWidth(initialWidth);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Additional fallback: listen for window resize to update container width estimate
  useEffect(() => {
    const handleWindowResize = () => {
      if (!timelineContainerRef.current) {
        const fallbackWidth = window.innerWidth - 192 - 48; // sidebar + padding
        console.log("Window resize fallback, setting width to:", fallbackWidth);
        setTimelineContainerWidth(fallbackWidth);
      }
    };

    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  // Set up ResizeObserver to track container width
  useEffect(() => {
    const updateContainerWidth = () => {
      if (timelineContainerRef.current) {
        const width = timelineContainerRef.current.offsetWidth;
        console.log("Container width from ref:", width);
        setTimelineContainerWidth(width);
      } else {
        // Fallback calculation
        const fallbackWidth = window.innerWidth - 192 - 48;
        console.log("Using fallback width calculation:", {
          windowInnerWidth: window.innerWidth,
          fallbackWidth: fallbackWidth,
          calculation: `${window.innerWidth} - 192 - 48 = ${fallbackWidth}`,
        });
        setTimelineContainerWidth(fallbackWidth);
      }
    };

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
  const calculateFitZoom = useCallback(() => {
    if (videoDuration && videoDuration > 0 && timelineContainerWidth > 0) {
      // Base timeline width at 1x zoom is 300px per minute
      const basePixelsPerMinute = 300;
      const totalMinutes = videoDuration / 60;
      const baseTimelineWidth = totalMinutes * basePixelsPerMinute;

      // The timelineContainerWidth already accounts for sidebar being outside
      // We just need some padding for scrollbars and margins
      const availableWidth = timelineContainerWidth - 32; // Reduced padding for better fit
      const fitZoom = Math.max(
        0.01, // Very low minimum to allow extreme zoom out if needed
        Math.min(10, availableWidth / baseTimelineWidth)
      );

      // Temporary debugging
      console.log("FIT-TO-WINDOW DEBUG (FIXED):", {
        videoDuration: videoDuration,
        totalMinutes: totalMinutes.toFixed(2),
        baseTimelineWidth: baseTimelineWidth.toFixed(0),
        timelineContainerWidth: timelineContainerWidth,
        padding: 32,
        availableWidth: availableWidth,
        calculatedFitZoom: fitZoom.toFixed(3),
        expectedTimelineWidth: (baseTimelineWidth * fitZoom).toFixed(0),
        windowInnerWidth: window.innerWidth,
      });

      return fitZoom;
    }
    return 1; // Fallback
  }, [videoDuration, timelineContainerWidth]);

  // Get current minimum zoom (fit-to-window level)
  const getMinZoom = useCallback(() => {
    return Math.max(0.01, calculateFitZoom()); // Very low minimum
  }, [calculateFitZoom]);

  const zoomFactor = 2.25;

  // Zoom control functions
  const zoomIn = useCallback(() => {
    setZoom((prevZoom) => Math.min(10, prevZoom * zoomFactor));
  }, []);

  const zoomOut = useCallback(() => {
    const minZoom = getMinZoom();
    setZoom((prevZoom) => Math.max(minZoom, prevZoom / zoomFactor));
  }, [getMinZoom]);

  const resetZoom = useCallback(() => {
    const fitZoom = calculateFitZoom();
    console.log("Resetting zoom to fit-to-window:", fitZoom);
    setZoom(fitZoom);
  }, [calculateFitZoom]);

  // Set default zoom to fit-to-window when data becomes available
  useEffect(() => {
    if (videoDuration && videoDuration > 0 && timelineContainerWidth > 0) {
      const fitZoom = calculateFitZoom();
      // Only set if we're still at the initial zoom level (1)
      if (zoom === 1) {
        setZoom(fitZoom);
      }
    }
  }, [videoDuration, timelineContainerWidth, calculateFitZoom, zoom]);

  // Auto-adjust zoom when container width changes (for window resizing)
  useEffect(() => {
    if (videoDuration && videoDuration > 0 && timelineContainerWidth > 0) {
      const currentMinZoom = calculateFitZoom();

      // If current zoom is at or below the new minimum, update to new fit-to-window level
      // This handles window resizing where the fit level changes
      if (zoom <= currentMinZoom + 0.01) {
        // Small tolerance for floating point comparison
        setZoom(currentMinZoom);
      }
    }
  }, [timelineContainerWidth, calculateFitZoom, videoDuration, zoom]); // Include all dependencies

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
  };
}