/**
 * Unit tests for timeline calculation functions
 */

import {
  timeToPixels,
  pixelsToTime,
  calculateTimelineWidth,
  calculateMarkerPosition,
  calculatePlayheadPosition,
  calculateCenterScrollPosition,
  isMarkerVisible,
} from './calculations';
import { SceneMarker } from '../../services/StashappService';

describe('Timeline Calculations', () => {
  describe('timeToPixels', () => {
    it('should convert time to pixels correctly', () => {
      expect(timeToPixels(10, 5)).toBe(50);
      expect(timeToPixels(0, 5)).toBe(0);
      expect(timeToPixels(100, 2.5)).toBe(250);
    });

    it('should handle fractional seconds', () => {
      expect(timeToPixels(1.5, 10)).toBe(15);
      expect(timeToPixels(0.1, 100)).toBe(10);
    });

    it('should handle zero pixels per second', () => {
      expect(timeToPixels(10, 0)).toBe(0);
    });

    it('should handle negative time', () => {
      expect(timeToPixels(-5, 10)).toBe(-50);
    });
  });

  describe('pixelsToTime', () => {
    it('should convert pixels to time correctly', () => {
      expect(pixelsToTime(50, 5)).toBe(10);
      expect(pixelsToTime(0, 5)).toBe(0);
      expect(pixelsToTime(250, 2.5)).toBe(100);
    });

    it('should handle fractional pixels', () => {
      expect(pixelsToTime(15, 10)).toBe(1.5);
      expect(pixelsToTime(10, 100)).toBe(0.1);
    });

    it('should handle zero pixels per second', () => {
      expect(pixelsToTime(100, 0)).toBe(0);
    });

    it('should be inverse of timeToPixels', () => {
      const time = 42.5;
      const pps = 7.3;
      expect(pixelsToTime(timeToPixels(time, pps), pps)).toBeCloseTo(time);
    });
  });

  describe('calculateTimelineWidth', () => {
    it('should calculate width for standard zoom', () => {
      const videoDuration = 600; // 10 minutes
      const zoom = 1;
      const containerWidth = 1920;
      const labelWidth = 200;

      const result = calculateTimelineWidth(videoDuration, zoom, containerWidth, labelWidth);

      expect(result.width).toBeGreaterThan(0);
      expect(result.pixelsPerSecond).toBe(result.width / videoDuration);
    });

    it('should handle zero video duration', () => {
      const result = calculateTimelineWidth(0, 1, 1000, 200);
      expect(result.width).toBe(0);
      expect(result.pixelsPerSecond).toBe(0);
    });

    it('should handle negative video duration', () => {
      const result = calculateTimelineWidth(-100, 1, 1000, 200);
      expect(result.width).toBe(0);
      expect(result.pixelsPerSecond).toBe(0);
    });

    it('should scale width with zoom', () => {
      const videoDuration = 600;
      const containerWidth = 10000; // Large enough to not constrain
      const labelWidth = 200;

      const result1x = calculateTimelineWidth(videoDuration, 1, containerWidth, labelWidth);
      const result2x = calculateTimelineWidth(videoDuration, 2, containerWidth, labelWidth);
      const result4x = calculateTimelineWidth(videoDuration, 4, containerWidth, labelWidth);

      expect(result2x.width).toBeCloseTo(result1x.width * 2, 0);
      expect(result4x.width).toBeCloseTo(result1x.width * 4, 0);
    });

    it('should constrain width when timeline fits naturally', () => {
      const videoDuration = 60; // 1 minute
      const zoom = 1;
      const containerWidth = 5000; // Much larger than needed
      const labelWidth = 200;

      const result = calculateTimelineWidth(videoDuration, zoom, containerWidth, labelWidth);

      // At 1x zoom, width should equal available width (fit to window)
      const availableWidth = containerWidth - labelWidth;
      expect(result.width).toBeLessThanOrEqual(availableWidth);
    });

    it('should allow overflow when zoomed beyond container', () => {
      const videoDuration = 600;
      const zoom = 10;
      const containerWidth = 1000;
      const labelWidth = 200;

      const result = calculateTimelineWidth(videoDuration, zoom, containerWidth, labelWidth);

      // Should exceed available width to allow scrolling
      const availableWidth = containerWidth - labelWidth;
      expect(result.width).toBeGreaterThan(availableWidth);
    });

    it('should handle zero container width', () => {
      const result = calculateTimelineWidth(600, 1, 0, 200);
      expect(result.width).toBeGreaterThan(0);
      expect(result.pixelsPerSecond).toBeGreaterThan(0);
    });

    it('should handle extreme zoom levels', () => {
      const videoDuration = 600;
      const containerWidth = 1920;
      const labelWidth = 200;

      const resultTiny = calculateTimelineWidth(videoDuration, 0.1, containerWidth, labelWidth);
      const resultHuge = calculateTimelineWidth(videoDuration, 100, containerWidth, labelWidth);

      expect(resultTiny.width).toBeGreaterThan(0);
      expect(resultHuge.width).toBeGreaterThan(0);
      expect(resultHuge.width).toBeGreaterThan(resultTiny.width);
    });
  });

  describe('calculateMarkerPosition', () => {
    const createMarker = (seconds: number, end_seconds?: number): SceneMarker => ({
      id: 'test-marker',
      title: '',
      seconds,
      end_seconds,
      stream: '',
      preview: '',
      screenshot: '',
      scene: { id: 'scene-1', title: '' },
      primary_tag: {
        id: 'tag-1',
        name: 'Test Tag',
        description: null,
        parents: [],
      },
      tags: [],
    });

    it('should calculate position for marker with start and end time', () => {
      const marker = createMarker(10, 15);
      const pixelsPerSecond = 10;

      const result = calculateMarkerPosition(marker, pixelsPerSecond);

      expect(result.left).toBe(100); // 10s * 10px/s
      expect(result.width).toBe(50); // 5s duration * 10px/s
    });

    it('should handle marker without end time', () => {
      const marker = createMarker(10);
      const pixelsPerSecond = 10;

      const result = calculateMarkerPosition(marker, pixelsPerSecond);

      expect(result.left).toBe(100);
      expect(result.width).toBeGreaterThanOrEqual(4); // Minimum clickable width
    });

    it('should handle marker with same start and end time', () => {
      const marker = createMarker(10, 10);
      const pixelsPerSecond = 10;

      const result = calculateMarkerPosition(marker, pixelsPerSecond);

      expect(result.left).toBe(100);
      expect(result.width).toBeGreaterThanOrEqual(4); // Minimum clickable width
    });

    it('should enforce minimum width for very short markers', () => {
      const marker = createMarker(10, 10.001); // 0.001s duration
      const pixelsPerSecond = 1000;

      const result = calculateMarkerPosition(marker, pixelsPerSecond);

      expect(result.width).toBeGreaterThanOrEqual(4); // Enforced minimum
    });

    it('should handle marker at time zero', () => {
      const marker = createMarker(0, 5);
      const pixelsPerSecond = 10;

      const result = calculateMarkerPosition(marker, pixelsPerSecond);

      expect(result.left).toBe(0);
      expect(result.width).toBe(50);
    });

    it('should handle fractional times', () => {
      const marker = createMarker(1.5, 3.7);
      const pixelsPerSecond = 100;

      const result = calculateMarkerPosition(marker, pixelsPerSecond);

      expect(result.left).toBe(150); // 1.5s * 100px/s
      expect(result.width).toBeCloseTo(220, 1); // 2.2s duration * 100px/s
    });
  });

  describe('calculatePlayheadPosition', () => {
    it('should calculate playhead position correctly', () => {
      expect(calculatePlayheadPosition(10, 5)).toBe(50);
      expect(calculatePlayheadPosition(0, 10)).toBe(0);
      expect(calculatePlayheadPosition(100, 2.5)).toBe(250);
    });

    it('should handle fractional current time', () => {
      expect(calculatePlayheadPosition(1.5, 10)).toBe(15);
      expect(calculatePlayheadPosition(0.1, 100)).toBe(10);
    });
  });

  describe('calculateCenterScrollPosition', () => {
    it('should calculate scroll position to center a time', () => {
      const targetTime = 100;
      const pixelsPerSecond = 5;
      const labelWidth = 200;
      const containerWidth = 1000;

      const scrollPos = calculateCenterScrollPosition(
        targetTime,
        pixelsPerSecond,
        labelWidth,
        containerWidth
      );

      // Playhead at 100s = 500px, absolute position = 700px (200 + 500)
      // Center in 1000px container = 700 - 500 = 200
      expect(scrollPos).toBe(200);
    });

    it('should not scroll below zero', () => {
      const targetTime = 1;
      const pixelsPerSecond = 5;
      const labelWidth = 200;
      const containerWidth = 1000;

      const scrollPos = calculateCenterScrollPosition(
        targetTime,
        pixelsPerSecond,
        labelWidth,
        containerWidth
      );

      expect(scrollPos).toBe(0);
    });

    it('should handle centering at time zero', () => {
      const scrollPos = calculateCenterScrollPosition(0, 5, 200, 1000);
      expect(scrollPos).toBe(0);
    });

    it('should calculate different scroll positions for different times', () => {
      const pixelsPerSecond = 5;
      const labelWidth = 200;
      const containerWidth = 1000;

      const scroll50 = calculateCenterScrollPosition(50, pixelsPerSecond, labelWidth, containerWidth);
      const scroll100 = calculateCenterScrollPosition(100, pixelsPerSecond, labelWidth, containerWidth);
      const scroll150 = calculateCenterScrollPosition(150, pixelsPerSecond, labelWidth, containerWidth);

      expect(scroll100).toBeGreaterThan(scroll50);
      expect(scroll150).toBeGreaterThan(scroll100);
    });
  });

  describe('isMarkerVisible', () => {
    const createMarker = (seconds: number, end_seconds?: number): SceneMarker => ({
      id: 'test-marker',
      title: '',
      seconds,
      end_seconds,
      stream: '',
      preview: '',
      screenshot: '',
      scene: { id: 'scene-1', title: '' },
      primary_tag: {
        id: 'tag-1',
        name: 'Test Tag',
        description: null,
        parents: [],
      },
      tags: [],
    });

    it('should detect marker in center of viewport', () => {
      const marker = createMarker(100, 110);
      const pixelsPerSecond = 5;
      const labelWidth = 200;
      const scrollLeft = 300;
      const containerWidth = 1000;

      const visible = isMarkerVisible(
        marker,
        pixelsPerSecond,
        labelWidth,
        scrollLeft,
        containerWidth
      );

      expect(visible).toBe(true);
    });

    it('should detect marker before viewport', () => {
      const marker = createMarker(10, 20);
      const pixelsPerSecond = 5;
      const labelWidth = 200;
      const scrollLeft = 500;
      const containerWidth = 1000;

      const visible = isMarkerVisible(
        marker,
        pixelsPerSecond,
        labelWidth,
        scrollLeft,
        containerWidth
      );

      expect(visible).toBe(false);
    });

    it('should detect marker after viewport', () => {
      const marker = createMarker(500, 510);
      const pixelsPerSecond = 5;
      const labelWidth = 200;
      const scrollLeft = 0;
      const containerWidth = 1000;

      const visible = isMarkerVisible(
        marker,
        pixelsPerSecond,
        labelWidth,
        scrollLeft,
        containerWidth
      );

      expect(visible).toBe(false);
    });

    it('should handle marker at viewport edge', () => {
      const marker = createMarker(100, 110);
      const pixelsPerSecond = 10;
      const labelWidth = 200;
      // Marker center at 105s = 1050px absolute
      // Viewport starts at scrollLeft + labelWidth
      const scrollLeft = 850; // viewport starts at 1050
      const containerWidth = 1000;

      const visible = isMarkerVisible(
        marker,
        pixelsPerSecond,
        labelWidth,
        scrollLeft,
        containerWidth
      );

      expect(visible).toBe(true);
    });

    it('should handle marker without end time', () => {
      const marker = createMarker(100);
      const pixelsPerSecond = 5;
      const labelWidth = 200;
      const scrollLeft = 300;
      const containerWidth = 1000;

      const visible = isMarkerVisible(
        marker,
        pixelsPerSecond,
        labelWidth,
        scrollLeft,
        containerWidth
      );

      expect(visible).toBe(true);
    });
  });
});
