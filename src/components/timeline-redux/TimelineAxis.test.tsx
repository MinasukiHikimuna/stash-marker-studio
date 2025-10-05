/**
 * Tests for TimelineAxis component
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import { TimelineAxis, type TimelineAxisProps } from "./TimelineAxis";
import type { ShotBoundary } from "../../core/shotBoundary/types";

function createShotBoundary(
  id: string,
  startTime: number,
  endTime: number | null = null
): ShotBoundary {
  return {
    id,
    stashappSceneId: 1,
    startTime,
    endTime,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

describe("TimelineAxis", () => {
  const defaultProps: TimelineAxisProps = {
    videoDuration: 300, // 5 minutes
    pixelsPerSecond: 10,
    timelineWidth: 3000,
    showShotBoundaries: false,
    shotBoundaries: [],
    onSeek: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(<TimelineAxis {...defaultProps} />);
      expect(container.querySelector(".bg-gray-700")).toBeInTheDocument();
    });

    it("sets correct timeline width", () => {
      const { container } = render(
        <TimelineAxis {...defaultProps} timelineWidth={2400} />
      );

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveStyle({ width: "2400px" });
    });

    it("renders with clickable cursor style", () => {
      const { container } = render(<TimelineAxis {...defaultProps} />);

      const axis = container.querySelector(".cursor-pointer");
      expect(axis).toBeInTheDocument();
      expect(axis).toHaveAttribute("title", "Click to seek to time");
    });
  });

  describe("Time Tick Marks", () => {
    it("renders minute tick marks for video duration", () => {
      render(<TimelineAxis {...defaultProps} videoDuration={180} />);

      // 180 seconds = 3 minutes, so should have 4 ticks (0, 1, 2, 3)
      expect(screen.getByText("0:00")).toBeInTheDocument();
      expect(screen.getByText("1:00")).toBeInTheDocument();
      expect(screen.getByText("2:00")).toBeInTheDocument();
      expect(screen.getByText("3:00")).toBeInTheDocument();
    });

    it("formats time labels correctly", () => {
      render(<TimelineAxis {...defaultProps} videoDuration={600} />);

      expect(screen.getByText("0:00")).toBeInTheDocument();
      expect(screen.getByText("1:00")).toBeInTheDocument();
      expect(screen.getByText("5:00")).toBeInTheDocument();
      expect(screen.getByText("10:00")).toBeInTheDocument();
    });

    it("positions tick marks at correct pixel locations", () => {
      const { container } = render(
        <TimelineAxis {...defaultProps} pixelsPerSecond={5} videoDuration={120} />
      );

      const ticks = container.querySelectorAll(".border-l.border-gray-600");

      // First tick at 0 minutes (0 pixels)
      expect(ticks[0]).toHaveStyle({ left: "0px" });
      // Second tick at 1 minute (60s * 5px/s = 300px)
      expect(ticks[1]).toHaveStyle({ left: "300px" });
      // Third tick at 2 minutes (120s * 5px/s = 600px)
      expect(ticks[2]).toHaveStyle({ left: "600px" });
    });

    it("handles zero duration gracefully", () => {
      const { container } = render(
        <TimelineAxis {...defaultProps} videoDuration={0} />
      );

      // Should render at least the 0:00 tick
      expect(screen.getByText("0:00")).toBeInTheDocument();

      const ticks = container.querySelectorAll(".border-l.border-gray-600");
      expect(ticks.length).toBeGreaterThanOrEqual(1);
    });

    it("handles very short duration", () => {
      render(<TimelineAxis {...defaultProps} videoDuration={30} />);

      // 30 seconds < 1 minute, so should have tick at 0:00
      // Math.floor(30/60) + 1 = 0 + 1 = 1 tick
      expect(screen.getByText("0:00")).toBeInTheDocument();
      expect(screen.queryByText("1:00")).not.toBeInTheDocument();
    });
  });

  describe("Shot Boundaries", () => {
    it("does not render shot boundaries when disabled", () => {
      const shotBoundaries = [
        createShotBoundary("1", 30),
        createShotBoundary("2", 60),
      ];

      const { container } = render(
        <TimelineAxis
          {...defaultProps}
          shotBoundaries={shotBoundaries}
          showShotBoundaries={false}
        />
      );

      const renderedBoundaries = container.querySelectorAll('[title*="Shot boundary"]');
      expect(renderedBoundaries).toHaveLength(0);
    });

    it("renders shot boundaries when enabled", () => {
      const shotBoundaries = [
        createShotBoundary("1", 30),
        createShotBoundary("2", 60),
      ];

      const { container } = render(
        <TimelineAxis
          {...defaultProps}
          shotBoundaries={shotBoundaries}
          showShotBoundaries={true}
        />
      );

      const renderedBoundaries = container.querySelectorAll('[title*="Shot boundary"]');
      expect(renderedBoundaries).toHaveLength(2);
    });

    it("positions shot boundaries at correct pixel locations", () => {
      const shotBoundaries = [
        createShotBoundary("1", 30),
        createShotBoundary("2", 90),
      ];

      const { container } = render(
        <TimelineAxis
          {...defaultProps}
          shotBoundaries={shotBoundaries}
          showShotBoundaries={true}
          pixelsPerSecond={10}
        />
      );

      const renderedBoundaries = container.querySelectorAll('[title*="Shot boundary"]');
      expect(renderedBoundaries[0]).toHaveStyle({ left: "300px" });
      expect(renderedBoundaries[1]).toHaveStyle({ left: "900px" });
    });

    it("displays shot boundary time in title", () => {
      const shotBoundaries = [createShotBoundary("1", 65)];

      render(
        <TimelineAxis
          {...defaultProps}
          shotBoundaries={shotBoundaries}
          showShotBoundaries={true}
        />
      );

      const shotBoundary = screen.getByTitle("Shot boundary: 1:05");
      expect(shotBoundary).toBeInTheDocument();
    });

    it("calls onSeek when shot boundary is clicked", () => {
      const onSeek = jest.fn();
      const shotBoundaries = [createShotBoundary("1", 45)];

      render(
        <TimelineAxis
          {...defaultProps}
          shotBoundaries={shotBoundaries}
          showShotBoundaries={true}
          onSeek={onSeek}
        />
      );

      const shotBoundary = screen.getByTitle("Shot boundary: 0:45");
      fireEvent.click(shotBoundary);

      expect(onSeek).toHaveBeenCalledWith(45);
    });

    it("prevents event propagation when shot boundary is clicked", () => {
      const onSeek = jest.fn();
      const shotBoundaries = [createShotBoundary("1", 45)];

      render(
        <TimelineAxis
          {...defaultProps}
          shotBoundaries={shotBoundaries}
          showShotBoundaries={true}
          onSeek={onSeek}
        />
      );

      const shotBoundary = screen.getByTitle("Shot boundary: 0:45");
      fireEvent.click(shotBoundary);

      // Should have been called exactly once (not twice - once for shot, once for axis)
      expect(onSeek).toHaveBeenCalledTimes(1);
      expect(onSeek).toHaveBeenCalledWith(45);
    });
  });

  describe("Click-to-Seek", () => {
    it("calls onSeek when timeline is clicked", () => {
      const onSeek = jest.fn();
      const { container } = render(
        <TimelineAxis {...defaultProps} onSeek={onSeek} />
      );

      const axis = container.querySelector(".cursor-pointer")!;

      // Mock getBoundingClientRect
      axis.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        right: 3000,
        bottom: 32,
        width: 3000,
        height: 32,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      // Click at x=500 pixels
      fireEvent.click(axis, { clientX: 500 });

      // 500px / 10px/s = 50s
      expect(onSeek).toHaveBeenCalledWith(50);
    });

    it("clamps seek time to video duration", () => {
      const onSeek = jest.fn();
      const { container } = render(
        <TimelineAxis
          {...defaultProps}
          videoDuration={100}
          pixelsPerSecond={10}
          onSeek={onSeek}
        />
      );

      const axis = container.querySelector(".cursor-pointer")!;
      axis.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 32,
        width: 1000,
        height: 32,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      // Click at x=1500 (which would be 150s, beyond duration)
      fireEvent.click(axis, { clientX: 1500 });

      // Should clamp to duration
      expect(onSeek).toHaveBeenCalledWith(100);
    });

    it("clamps seek time to zero for negative values", () => {
      const onSeek = jest.fn();
      const { container } = render(
        <TimelineAxis {...defaultProps} onSeek={onSeek} />
      );

      const axis = container.querySelector(".cursor-pointer")!;
      axis.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 0,
        right: 3100,
        bottom: 32,
        width: 3000,
        height: 32,
        x: 100,
        y: 0,
        toJSON: () => {},
      }));

      // Click at x=50 (before the axis left edge would result in negative)
      fireEvent.click(axis, { clientX: 50 });

      // Should clamp to 0
      expect(onSeek).toHaveBeenCalledWith(0);
    });
  });


  describe("Hover Callbacks", () => {
    it("calls onTimeHover when mouse moves over axis", () => {
      const onTimeHover = jest.fn();
      const { container } = render(
        <TimelineAxis {...defaultProps} onTimeHover={onTimeHover} />
      );

      const axis = container.querySelector(".cursor-pointer")!;
      axis.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 100,
        right: 3000,
        bottom: 132,
        width: 3000,
        height: 32,
        x: 0,
        y: 100,
        toJSON: () => {},
      }));

      fireEvent.mouseMove(axis, { clientX: 250 });

      // 250px / 10px/s = 25s, y = top - 10 = 90
      expect(onTimeHover).toHaveBeenCalledWith(25, 250, 90);
    });

    it("does not call onTimeHover if not provided", () => {
      const { container } = render(<TimelineAxis {...defaultProps} />);

      const axis = container.querySelector(".cursor-pointer")!;

      // Should not throw
      expect(() => {
        fireEvent.mouseMove(axis, { clientX: 250 });
      }).not.toThrow();
    });

    it("calls onTimeHoverEnd when mouse leaves axis", () => {
      const onTimeHoverEnd = jest.fn();
      const { container } = render(
        <TimelineAxis {...defaultProps} onTimeHoverEnd={onTimeHoverEnd} />
      );

      const axis = container.querySelector(".cursor-pointer")!;
      fireEvent.mouseLeave(axis);

      expect(onTimeHoverEnd).toHaveBeenCalled();
    });

    it("does not call onTimeHoverEnd if not provided", () => {
      const { container } = render(<TimelineAxis {...defaultProps} />);

      const axis = container.querySelector(".cursor-pointer")!;

      // Should not throw
      expect(() => {
        fireEvent.mouseLeave(axis);
      }).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("handles very long video duration", () => {
      render(<TimelineAxis {...defaultProps} videoDuration={7200} />); // 2 hours

      expect(screen.getByText("0:00")).toBeInTheDocument();
      expect(screen.getByText("60:00")).toBeInTheDocument();
      expect(screen.getByText("120:00")).toBeInTheDocument();
    });

    it("handles fractional pixel positions", () => {
      const { container } = render(
        <TimelineAxis {...defaultProps} pixelsPerSecond={3.5} videoDuration={120} />
      );

      const ticks = container.querySelectorAll(".border-l.border-gray-600");

      // First tick at 0 minutes (0 pixels)
      expect(ticks[0]).toHaveStyle({ left: "0px" });
      // Second tick at 1 minute (60s * 3.5px/s = 210px)
      expect(ticks[1]).toHaveStyle({ left: "210px" });
    });

    it("handles empty shot boundary array", () => {
      const { container } = render(
        <TimelineAxis {...defaultProps} shotBoundaries={[]} showShotBoundaries={true} />
      );

      const shotBoundaries = container.querySelectorAll('[title*="Shot boundary"]');
      expect(shotBoundaries).toHaveLength(0);
    });

    it("handles very small pixelsPerSecond", () => {
      const onSeek = jest.fn();
      const { container } = render(
        <TimelineAxis
          {...defaultProps}
          pixelsPerSecond={0.1}
          onSeek={onSeek}
        />
      );

      const axis = container.querySelector(".cursor-pointer")!;
      axis.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        right: 30,
        bottom: 32,
        width: 30,
        height: 32,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.click(axis, { clientX: 10 });

      // 10px / 0.1px/s = 100s
      expect(onSeek).toHaveBeenCalledWith(100);
    });
  });

  describe("Accessibility", () => {
    it("provides title attribute for seekability", () => {
      const { container } = render(<TimelineAxis {...defaultProps} />);

      const axis = container.querySelector(".cursor-pointer");
      expect(axis).toHaveAttribute("title", "Click to seek to time");
    });

    it("provides titles for shot boundaries", () => {
      const shotBoundaries = [
        createShotBoundary("1", 30),
        createShotBoundary("2", 90),
      ];

      render(
        <TimelineAxis
          {...defaultProps}
          shotBoundaries={shotBoundaries}
          showShotBoundaries={true}
        />
      );

      expect(screen.getByTitle("Shot boundary: 0:30")).toBeInTheDocument();
      expect(screen.getByTitle("Shot boundary: 1:30")).toBeInTheDocument();
    });
  });
});
