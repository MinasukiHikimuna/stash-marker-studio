/**
 * Tests for TimelineLabels component
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Import test constants first, before mocking
import {
  MARKER_STATUS_CONFIRMED,
  MARKER_STATUS_REJECTED,
} from "../../core/marker/testUtils";

// Mock the stashappService to provide marker status tag IDs
jest.mock("../../services/StashappService", () => ({
  ...jest.requireActual("../../services/StashappService"),
  stashappService: {
    markerStatusConfirmed: MARKER_STATUS_CONFIRMED,
    markerStatusRejected: MARKER_STATUS_REJECTED,
    markerShotBoundary: "300001",
  },
}));

import { TimelineLabels } from "./TimelineLabels";
import { TagGroup } from "../../core/marker/types";
import { SceneMarker } from "../../services/StashappService";
import {
  createTestMarker,
  createTestTag,
  createConfirmedMarker,
  createRejectedMarker,
  createUnprocessedMarker,
  createMarkerWithMarkerGroup,
} from "../../core/marker/testUtils";

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Helper to create tag groups
function createMockTagGroup(
  name: string,
  markers: SceneMarker[],
  isRejected = false
): TagGroup {
  return {
    name,
    markers,
    tags: [createTestTag({ id: `tag-${name}`, name })],
    isRejected,
  };
}

describe("TimelineLabels", () => {
  const defaultProps = {
    tagGroups: [] as TagGroup[],
    trackCountsByGroup: {},
    labelWidth: 200,
    selectedMarkerId: null,
    markerGroupParentId: null,
  };

  describe("Basic Rendering", () => {
    it("renders without crashing with empty data", () => {
      const { container } = render(<TimelineLabels {...defaultProps} />);
      expect(container.querySelector("div")).toBeInTheDocument();
    });

    it("renders a single label row", () => {
      const marker = createTestMarker({ id: "1", seconds: 10 });
      const tagGroups: TagGroup[] = [createMockTagGroup("Action", [marker])];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.getByText("Action")).toBeInTheDocument();
    });

    it("renders multiple label rows", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
        createMockTagGroup("Dialog", [createTestMarker({ id: "2", seconds: 20 })]),
      ];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1, Dialog: 1 }}
        />
      );

      expect(screen.getByText("Action")).toBeInTheDocument();
      expect(screen.getByText("Dialog")).toBeInTheDocument();
    });

    it("sets correct label width", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
      ];

      const { container } = render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
          labelWidth={250}
        />
      );

      const labelColumn = container.querySelector(".flex-shrink-0");
      expect(labelColumn).toHaveStyle({ width: "250px" });
    });
  });

  describe("Status Counts", () => {
    it("displays confirmed marker count", () => {
      const markers = [
        createConfirmedMarker({ id: "1", seconds: 10 }),
        createConfirmedMarker({ id: "2", seconds: 20 }),
      ];
      const tagGroups: TagGroup[] = [createMockTagGroup("Action", markers)];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.getByText("✓2")).toBeInTheDocument();
    });

    it("displays rejected marker count", () => {
      const markers = [
        createRejectedMarker({ id: "1", seconds: 10 }),
        createRejectedMarker({ id: "2", seconds: 20 }),
        createRejectedMarker({ id: "3", seconds: 30 }),
      ];
      const tagGroups: TagGroup[] = [createMockTagGroup("Action", markers)];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.getByText("✗3")).toBeInTheDocument();
    });

    it("displays pending (unprocessed) marker count", () => {
      const markers = [
        createUnprocessedMarker({ id: "1", seconds: 10 }),
        createUnprocessedMarker({ id: "2", seconds: 20 }),
      ];
      const tagGroups: TagGroup[] = [createMockTagGroup("Action", markers)];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.getByText("?2")).toBeInTheDocument();
    });

    it("displays mixed status counts", () => {
      const markers = [
        createConfirmedMarker({ id: "1", seconds: 10 }),
        createConfirmedMarker({ id: "2", seconds: 20 }),
        createRejectedMarker({ id: "3", seconds: 30 }),
        createUnprocessedMarker({ id: "4", seconds: 40 }),
        createUnprocessedMarker({ id: "5", seconds: 50 }),
        createUnprocessedMarker({ id: "6", seconds: 60 }),
      ];
      const tagGroups: TagGroup[] = [createMockTagGroup("Action", markers)];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.getByText("✓2")).toBeInTheDocument();
      expect(screen.getByText("✗1")).toBeInTheDocument();
      expect(screen.getByText("?3")).toBeInTheDocument();
    });

    it("hides counts when all markers have zero count", () => {
      const tagGroups: TagGroup[] = [createMockTagGroup("Action", [])];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.queryByText(/✓/)).not.toBeInTheDocument();
      expect(screen.queryByText(/✗/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\?/)).not.toBeInTheDocument();
    });
  });

  describe("Multi-Track Swimlanes", () => {
    it("renders multiple track rows with correct height", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
      ];

      const { container } = render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 3 }}
        />
      );

      // Select track rows by their specific combination of classes
      const trackRows = container.querySelectorAll("div.flex.items-center.px-3");
      expect(trackRows).toHaveLength(3);
    });

    it("displays label only on first track", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
      ];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 2 }}
        />
      );

      // The label "Action (2)" should only appear once, not on each track
      expect(screen.getByText(/Action \(2\)/)).toBeInTheDocument();
      // Should not have multiple instances
      const labels = screen.getAllByText(/Action/);
      expect(labels).toHaveLength(1);
    });

    it("shows track count indicator for multi-track swimlanes", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
      ];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 3 }}
        />
      );

      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });

    it("does not show track count for single-track swimlanes", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
      ];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
    });
  });

  describe("Marker Group Display", () => {
    it("displays marker group prefix for tagged markers", () => {
      const MARKER_GROUP_PARENT_ID = "marker-groups-parent";
      const marker = createMarkerWithMarkerGroup(
        "Kissing",
        "Romance",
        MARKER_GROUP_PARENT_ID,
        10
      );
      const tagGroups: TagGroup[] = [createMockTagGroup("Kissing", [marker])];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Kissing: 1 }}
          markerGroupParentId={MARKER_GROUP_PARENT_ID}
        />
      );

      expect(screen.getByText("Romance:")).toBeInTheDocument();
      expect(screen.getByText("Kissing")).toBeInTheDocument();
    });

    it("shows marker group only on first occurrence", () => {
      const MARKER_GROUP_PARENT_ID = "marker-groups-parent";
      const marker1 = createMarkerWithMarkerGroup(
        "Kissing",
        "Romance",
        MARKER_GROUP_PARENT_ID,
        10
      );
      const marker2 = createMarkerWithMarkerGroup(
        "Hugging",
        "Romance",
        MARKER_GROUP_PARENT_ID,
        20
      );

      const tagGroups: TagGroup[] = [
        createMockTagGroup("Kissing", [marker1]),
        createMockTagGroup("Hugging", [marker2]),
      ];

      const { container } = render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Kissing: 1, Hugging: 1 }}
          markerGroupParentId={MARKER_GROUP_PARENT_ID}
        />
      );

      const romanceLabels = container.querySelectorAll(".text-blue-300");
      expect(romanceLabels).toHaveLength(1);
      expect(romanceLabels[0]).toHaveTextContent("Romance:");

      // Second occurrence should be transparent
      const transparentLabels = container.querySelectorAll(".text-transparent");
      expect(transparentLabels.length).toBeGreaterThan(0);
    });

    it("does not display marker group when markerGroupParentId is null", () => {
      const MARKER_GROUP_PARENT_ID = "marker-groups-parent";
      const marker = createMarkerWithMarkerGroup(
        "Kissing",
        "Romance",
        MARKER_GROUP_PARENT_ID,
        10
      );
      const tagGroups: TagGroup[] = [createMockTagGroup("Kissing", [marker])];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Kissing: 1 }}
          markerGroupParentId={null}
        />
      );

      expect(screen.queryByText("Romance:")).not.toBeInTheDocument();
      expect(screen.getByText("Kissing")).toBeInTheDocument();
    });
  });

  describe("Selection Highlighting", () => {
    it("highlights label when marker is selected", () => {
      const marker = createTestMarker({ id: "1", seconds: 10 });
      const tagGroups: TagGroup[] = [createMockTagGroup("Action", [marker])];

      const { container } = render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
          selectedMarkerId="1"
        />
      );

      // Find the track row element
      const trackRow = container.querySelector("div.px-3");
      expect(trackRow).toHaveClass("bg-gray-700");

      // The span containing "Action" should have font-bold
      const labelSpan = screen.getByText("Action");
      expect(labelSpan).toHaveClass("font-bold");
    });

    it("does not highlight when different marker is selected", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
        createMockTagGroup("Dialog", [createTestMarker({ id: "2", seconds: 20 })]),
      ];

      const { container } = render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1, Dialog: 1 }}
          selectedMarkerId="2"
        />
      );

      const trackRows = container.querySelectorAll("div.px-3");
      expect(trackRows[0]).not.toHaveClass("bg-gray-700");
      expect(trackRows[1]).toHaveClass("bg-gray-700");
    });
  });

  describe("Rejected Tag Groups", () => {
    it("displays (R) suffix for rejected groups", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })], true),
      ];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.getByText(/Action \(R\)/)).toBeInTheDocument();
    });

    it("applies red background for rejected groups", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })], true),
      ];

      const { container } = render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      const trackRow = container.querySelector("div.px-3");
      expect(trackRow).toHaveClass("bg-red-900/40");
    });

    it("does not show (R) for non-rejected groups", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })], false),
      ];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.queryByText(/\(R\)/)).not.toBeInTheDocument();
    });
  });

  describe("Reassignment Icon", () => {
    it("shows reassignment icon on hover when callback provided", () => {
      const onReassignClick = jest.fn();
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
      ];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
          onReassignClick={onReassignClick}
        />
      );

      // Find button by title attribute since it doesn't have an accessible name
      const button = screen.getByTitle("Reassign to different marker group and set corresponding tag");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("⚙️");
    });

    it("does not show reassignment icon when callback not provided", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
      ];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      const button = screen.queryByRole("button");
      expect(button).not.toBeInTheDocument();
    });

    it("calls onReassignClick when icon is clicked", () => {
      const onReassignClick = jest.fn();
      const marker = createTestMarker({ id: "1", seconds: 10 });
      const tagGroup = createMockTagGroup("Action", [marker]);
      const tagGroups: TagGroup[] = [tagGroup];

      render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
          onReassignClick={onReassignClick}
        />
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(onReassignClick).toHaveBeenCalledWith("Action", tagGroup);
    });
  });

  describe("Alternating Row Colors", () => {
    it("alternates background colors for swimlanes", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
        createMockTagGroup("Dialog", [createTestMarker({ id: "2", seconds: 20 })]),
        createMockTagGroup("Scene", [createTestMarker({ id: "3", seconds: 30 })]),
      ];

      const { container } = render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1, Dialog: 1, Scene: 1 }}
        />
      );

      // Select the specific track row divs
      const trackRows = container.querySelectorAll("div.px-3.text-sm");
      expect(trackRows[0]).toHaveClass("bg-gray-800"); // index 0 (even)
      expect(trackRows[1]).toHaveClass("bg-gray-900"); // index 1 (odd)
      expect(trackRows[2]).toHaveClass("bg-gray-800"); // index 2 (even)
    });
  });

  describe("Layout Calculations", () => {
    it("calculates correct height for single track", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
      ];

      const { container } = render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      // Height = 24 (TRACK_HEIGHT) + 4 (SWIMLANE_PADDING) = 28px
      const trackRow = container.querySelector("div.px-3");
      expect(trackRow).toHaveStyle({ height: "28px" });
    });

    it("calculates correct height for multiple tracks", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createTestMarker({ id: "1", seconds: 10 })]),
      ];

      const { container } = render(
        <TimelineLabels
          {...defaultProps}
          tagGroups={tagGroups}
          trackCountsByGroup={{ Action: 3 }}
        />
      );

      const trackRows = container.querySelectorAll("div.px-3.text-sm");
      // First two tracks: 24 + 2 (TRACK_SPACING) = 26px
      expect(trackRows[0]).toHaveStyle({ height: "26px" });
      expect(trackRows[1]).toHaveStyle({ height: "26px" });
      // Last track: 24 + 4 (SWIMLANE_PADDING) = 28px
      expect(trackRows[2]).toHaveStyle({ height: "28px" });
    });
  });
});
