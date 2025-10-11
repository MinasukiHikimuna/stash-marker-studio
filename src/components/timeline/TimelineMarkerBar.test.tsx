/**
 * Unit tests for TimelineMarkerBar component
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineMarkerBar } from "./TimelineMarkerBar";
import { SceneMarker } from "../../services/StashappService";

const mockDepthMap = new Map<string, number>();

jest.mock("../../store/hooks", () => {
  const actual = jest.requireActual("../../store/hooks");
  return {
    ...actual,
    useAppSelector: jest.fn().mockImplementation(() => mockDepthMap),
  };
});

// Mock the StashappService
const MARKER_STATUS_CONFIRMED = "100001";
const MARKER_STATUS_REJECTED = "100002";

jest.mock("../../services/StashappService", () => {
  const mockService = {
    get markerStatusConfirmed() {
      return MARKER_STATUS_CONFIRMED;
    },
    get markerStatusRejected() {
      return MARKER_STATUS_REJECTED;
    },
  };

  return {
    stashappService: mockService,
  };
});

const createTestMarker = (overrides: Partial<SceneMarker> = {}): SceneMarker => ({
  id: "test-marker-1",
  title: "",
  seconds: 10,
  end_seconds: 15,
  stream: "",
  preview: "",
  screenshot: "",
  scene: { id: "scene-1", title: "" },
  primary_tag: {
    id: "tag-1",
    name: "Test Tag",
    description: null,
    parents: [],
  },
  tags: [],
  ...overrides,
});

const createConfirmedMarker = (): SceneMarker => {
  return createTestMarker({
    tags: [
      { id: MARKER_STATUS_CONFIRMED, name: "MARKER_STATUS_CONFIRMED" },
    ],
  });
};

const createRejectedMarker = (): SceneMarker => {
  return createTestMarker({
    tags: [
      { id: MARKER_STATUS_REJECTED, name: "MARKER_STATUS_REJECTED" },
    ],
  });
};

describe("TimelineMarkerBar", () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
    mockDepthMap.clear();
  });

  describe("Rendering", () => {
    it("should render with correct position and width", () => {
      const marker = createTestMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={100}
          width={50}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      // Position and width are on the parent wrapper div, not the inner colored bar
      const wrapper = element.parentElement;
      expect(wrapper).toHaveStyle({ left: "100px", width: "50px" });
    });

    it("should render with marker ID in data attribute", () => {
      const marker = createTestMarker({ id: "marker-123" });
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      expect(element).toHaveAttribute("data-marker-id", "marker-123");
    });

    it("should render with tooltip showing tag name and time", () => {
      const marker = createTestMarker({
        primary_tag: {
          id: "tag-1",
          name: "Awesome Tag",
          description: null,
          parents: [],
        },
        seconds: 42.5,
      });
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      expect(element).toHaveAttribute("title", "Awesome Tag - 42.5s");
    });
  });

  describe("Visual States", () => {
    it("should apply unprocessed marker colors", () => {
      const marker = createTestMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      expect(element).toHaveClass("bg-yellow-500");
    });

    it("should apply confirmed marker colors", () => {
      const marker = createConfirmedMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      expect(element).toHaveClass("bg-green-600");
    });

    it("should apply rejected marker colors", () => {
      const marker = createRejectedMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      expect(element).toHaveClass("bg-red-600");
    });

    it("should apply selected marker visual indicator when selected", () => {
      const marker = createTestMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={true}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      // Selected markers show a white ring, not a different background color
      expect(element).toHaveClass("ring-2");
      expect(element).toHaveClass("ring-white");
    });

    it("should keep status colors when selected", () => {
      const marker = createConfirmedMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={true}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      // Selected markers keep their status color and add a ring
      expect(element).toHaveClass("bg-green-600");
      expect(element).toHaveClass("ring-2");
      expect(element).toHaveClass("ring-white");
    });

    it("should include transition classes", () => {
      const marker = createTestMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      expect(element).toHaveClass("transition-colors");
      expect(element).toHaveClass("duration-150");
    });

    it("should have cursor pointer", () => {
      const marker = createTestMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      expect(element).toHaveClass("cursor-pointer");
    });
  });

  describe("Interaction", () => {
    it("should call onClick when clicked", () => {
      const marker = createTestMarker({ id: "marker-123" });
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={10}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      fireEvent.click(element);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(marker);
    });

    it("should call onClick with correct marker when multiple markers exist", () => {
      const marker1 = createTestMarker({ id: "marker-1" });
      const marker2 = createTestMarker({ id: "marker-2" });

      const { container } = render(
        <>
          <TimelineMarkerBar
            marker={marker1}
            left={0}
            width={10}
            isSelected={false}
            onClick={mockOnClick}
          />
          <TimelineMarkerBar
            marker={marker2}
            left={20}
            width={10}
            isSelected={false}
            onClick={mockOnClick}
          />
        </>
      );

      const markers = container.querySelectorAll("[data-testid='timeline-marker-bar']");
      fireEvent.click(markers[1]);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(marker2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero width", () => {
      const marker = createTestMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={0}
          width={0}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      const wrapper = element.parentElement;
      expect(wrapper).toHaveStyle({ width: "0px" });
    });

    it("should handle negative left position", () => {
      const marker = createTestMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={-50}
          width={100}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      const wrapper = element.parentElement;
      expect(wrapper).toHaveStyle({ left: "-50px" });
    });

    it("should handle very large positions", () => {
      const marker = createTestMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={999999}
          width={500}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      const wrapper = element.parentElement;
      expect(wrapper).toHaveStyle({ left: "999999px", width: "500px" });
    });

    it("should handle fractional positions", () => {
      const marker = createTestMarker();
      render(
        <TimelineMarkerBar
          marker={marker}
          left={10.5}
          width={25.75}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const element = screen.getByTestId("timeline-marker-bar");
      const wrapper = element.parentElement;
      expect(wrapper).toHaveStyle({ left: "10.5px", width: "25.75px" });
    });
  });
});
