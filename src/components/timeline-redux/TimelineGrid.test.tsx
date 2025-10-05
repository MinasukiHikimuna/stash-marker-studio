/**
 * Tests for TimelineGrid component
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimelineGrid } from "./TimelineGrid";
import { TagGroup, MarkerWithTrack } from "../../core/marker/types";
import { SceneMarker, Tag } from "../../services/StashappService";
import { createTestMarker, createTestTag } from "../../core/marker/testUtils";

// Mock the TimelineMarkerBar component
jest.mock("../timeline/TimelineMarkerBar", () => ({
  TimelineMarkerBar: ({ marker, onClick, isSelected }: { marker: { id: string; primary_tag: { name: string } }; onClick: (m: unknown) => void; isSelected: boolean }) => (
    <div
      data-testid={`marker-bar-${marker.id}`}
      data-selected={isSelected}
      onClick={() => onClick(marker)}
    >
      {marker.primary_tag.name}
    </div>
  ),
}));

// Mock the TimelinePlayhead component
jest.mock("./TimelinePlayhead", () => ({
  __esModule: true,
  default: ({ currentTime }: { currentTime: number }) => (
    <div data-testid="playhead" data-current-time={currentTime} />
  ),
}));

// Helper to create mock markers
function createMockMarker(
  id: string,
  seconds: number,
  tagName: string,
  endSeconds?: number,
  tags: Array<{ id: string; name: string }> = []
): SceneMarker {
  return createTestMarker({
    id,
    seconds,
    end_seconds: endSeconds,
    primary_tag: createTestTag({ id: `tag-${id}`, name: tagName }),
    tags,
  });
}

// Helper to create mock marker with track
function createMockMarkerWithTrack(
  id: string,
  seconds: number,
  tagName: string,
  tagGroup: string,
  track: number,
  endSeconds?: number
): MarkerWithTrack {
  return {
    ...createMockMarker(id, seconds, tagName, endSeconds),
    tagGroup,
    track,
    swimlane: 0,
  };
}

// Helper to create tag groups
function createMockTagGroup(
  name: string,
  markers: SceneMarker[],
  tags: Tag[] = []
): TagGroup {
  return {
    name,
    markers,
    tags: tags.length > 0 ? tags : [createTestTag({ id: `tag-${name}`, name })],
    isRejected: false,
  };
}

describe("TimelineGrid", () => {
  const defaultProps = {
    tagGroups: [] as TagGroup[],
    markersWithTracks: [] as MarkerWithTrack[],
    trackCountsByGroup: {},
    pixelsPerSecond: 10,
    timelineWidth: 600,
    currentTime: 30,
    selectedMarkerId: null,
    onMarkerClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders without crashing with empty data", () => {
      render(<TimelineGrid {...defaultProps} />);
      // Should render but with no swimlanes
      expect(screen.queryByTestId("marker-bar-1")).not.toBeInTheDocument();
    });

    it("renders a single swimlane with one marker", () => {
      const marker = createMockMarker("1", 10, "Action");
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [marker]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      expect(screen.getByTestId("marker-bar-1")).toBeInTheDocument();
      expect(screen.getByText("Action")).toBeInTheDocument();
    });

    it("renders multiple swimlanes", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createMockMarker("1", 10, "Action")]),
        createMockTagGroup("Dialog", [createMockMarker("2", 20, "Dialog")]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
        createMockMarkerWithTrack("2", 20, "Dialog", "Dialog", 0),
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1, Dialog: 1 }}
        />
      );

      expect(screen.getByTestId("marker-bar-1")).toBeInTheDocument();
      expect(screen.getByTestId("marker-bar-2")).toBeInTheDocument();
    });
  });

  describe("Multi-Track Swimlanes", () => {
    it("renders multi-track swimlane with correct height", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [
            createMockMarker("1", 10, "Action", 15),
            createMockMarker("2", 12, "Action", 17),
          ]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0, 15),
        createMockMarkerWithTrack("2", 12, "Action", "Action", 1, 17),
      ];

      const { container } = render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 2 }}
        />
      );

      // With 2 tracks: (2 * 24) + ((2-1) * 2) + 4 = 54px
      const swimlane = container.querySelector(".border-b");
      expect(swimlane).toHaveStyle({ height: "54px" });

      expect(screen.getByTestId("marker-bar-1")).toBeInTheDocument();
      expect(screen.getByTestId("marker-bar-2")).toBeInTheDocument();
    });

    it("positions markers on different tracks correctly", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [
            createMockMarker("1", 10, "Action", 15),
            createMockMarker("2", 12, "Action", 17),
            createMockMarker("3", 14, "Action", 19),
          ]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0, 15),
        createMockMarkerWithTrack("2", 12, "Action", "Action", 1, 17),
        createMockMarkerWithTrack("3", 14, "Action", "Action", 2, 19),
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 3 }}
        />
      );

      // Verify all 3 markers are rendered
      expect(screen.getByTestId("marker-bar-1")).toBeInTheDocument();
      expect(screen.getByTestId("marker-bar-2")).toBeInTheDocument();
      expect(screen.getByTestId("marker-bar-3")).toBeInTheDocument();

      // Verify they have different vertical positions
      const marker1Container = screen.getByTestId("marker-bar-1").parentElement;
      const marker2Container = screen.getByTestId("marker-bar-2").parentElement;
      const marker3Container = screen.getByTestId("marker-bar-3").parentElement;

      // Track 0: top = 2px (PADDING/2)
      expect(marker1Container).toHaveStyle({ top: "2px" });
      // Track 1: top = 2 + 1*(24+2) = 28px
      expect(marker2Container).toHaveStyle({ top: "28px" });
      // Track 2: top = 2 + 2*(24+2) = 54px
      expect(marker3Container).toHaveStyle({ top: "54px" });
    });
  });

  describe("Marker Selection", () => {
    it("highlights swimlane containing selected marker", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createMockMarker("1", 10, "Action")]),
        createMockTagGroup("Dialog", [createMockMarker("2", 20, "Dialog")]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
        createMockMarkerWithTrack("2", 20, "Dialog", "Dialog", 0),
      ];

      const { container } = render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1, Dialog: 1 }}
          selectedMarkerId="1"
        />
      );

      const swimlanes = container.querySelectorAll(".border-b");
      // First swimlane (Action) should have bg-gray-700 class
      expect(swimlanes[0]).toHaveClass("bg-gray-700");
      // Second swimlane (Dialog) should have bg-gray-900 class (odd index)
      expect(swimlanes[1]).toHaveClass("bg-gray-900");
    });

    it("passes isSelected prop to TimelineMarkerBar", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [
            createMockMarker("1", 10, "Action"),
            createMockMarker("2", 20, "Action"),
          ]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
        createMockMarkerWithTrack("2", 20, "Action", "Action", 0),
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
          selectedMarkerId="1"
        />
      );

      expect(screen.getByTestId("marker-bar-1")).toHaveAttribute(
        "data-selected",
        "true"
      );
      expect(screen.getByTestId("marker-bar-2")).toHaveAttribute(
        "data-selected",
        "false"
      );
    });
  });

  describe("Marker Click Handling", () => {
    it("calls onMarkerClick when a marker is clicked", () => {
      const onMarkerClick = jest.fn();
      const marker = createMockMarker("1", 10, "Action");
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [marker]),
      ];
      const markerWithTrack = { ...marker, tagGroup: "Action", track: 0, swimlane: 0 };
      const markersWithTracks: MarkerWithTrack[] = [markerWithTrack];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
          onMarkerClick={onMarkerClick}
        />
      );

      fireEvent.click(screen.getByTestId("marker-bar-1"));
      // The markerWithTrack object is passed, not the original marker
      expect(onMarkerClick).toHaveBeenCalledWith(markerWithTrack);
    });
  });

  describe("Playhead Rendering", () => {
    it("renders playhead for each swimlane", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createMockMarker("1", 10, "Action")]),
        createMockTagGroup("Dialog", [createMockMarker("2", 20, "Dialog")]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
        createMockMarkerWithTrack("2", 20, "Dialog", "Dialog", 0),
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1, Dialog: 1 }}
          currentTime={15}
        />
      );

      const playheads = screen.getAllByTestId("playhead");
      expect(playheads).toHaveLength(2);
      playheads.forEach((playhead) => {
        expect(playhead).toHaveAttribute("data-current-time", "15");
      });
    });
  });

  describe("Alternating Row Colors", () => {
    it("alternates background colors for swimlanes", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createMockMarker("1", 10, "Action")]),
        createMockTagGroup("Dialog", [createMockMarker("2", 20, "Dialog")]),
        createMockTagGroup("Scene", [createMockMarker("3", 30, "Scene")]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
        createMockMarkerWithTrack("2", 20, "Dialog", "Dialog", 0),
        createMockMarkerWithTrack("3", 30, "Scene", "Scene", 0),
      ];

      const { container } = render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1, Dialog: 1, Scene: 1 }}
        />
      );

      const swimlanes = container.querySelectorAll(".border-b");
      expect(swimlanes[0]).toHaveClass("bg-gray-800"); // index 0 (even)
      expect(swimlanes[1]).toHaveClass("bg-gray-900"); // index 1 (odd)
      expect(swimlanes[2]).toHaveClass("bg-gray-800"); // index 2 (even)
    });
  });

  describe("Marker Tooltips", () => {
    it("shows tooltip on marker hover", () => {
      const marker = createMockMarker("1", 10, "Action", 15);
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [marker]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        { ...marker, tagGroup: "Action", track: 0, swimlane: 0 },
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      const markerContainer = screen.getByTestId("marker-bar-1").parentElement!;
      fireEvent.mouseEnter(markerContainer, { clientX: 100, clientY: 200 });

      // Tooltip should appear
      expect(screen.getByText(/ID: 1/)).toBeInTheDocument();
      expect(screen.getByText(/0:10 - 0:15/)).toBeInTheDocument();
      // Verify the tooltip title is present (not the marker bar text)
      const tooltipTitle = screen.getAllByText("Action").find(el =>
        el.className.includes("font-bold text-lg")
      );
      expect(tooltipTitle).toBeInTheDocument();
    });

    it("hides tooltip on mouse leave", () => {
      const marker = createMockMarker("1", 10, "Action", 15);
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [marker]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        { ...marker, tagGroup: "Action", track: 0, swimlane: 0 },
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      const markerContainer = screen.getByTestId("marker-bar-1").parentElement!;
      fireEvent.mouseEnter(markerContainer, { clientX: 100, clientY: 200 });
      expect(screen.getByText(/ID: 1/)).toBeInTheDocument();

      fireEvent.mouseLeave(markerContainer);
      expect(screen.queryByText(/ID: 1/)).not.toBeInTheDocument();
    });

    it("displays marker description in tooltip", () => {
      const marker = createMockMarker("1", 10, "Action", 15);
      // Override the primary tag to add description
      marker.primary_tag.description = "Action scene description";
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [marker]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        { ...marker, tagGroup: "Action", track: 0, swimlane: 0 },
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      const markerContainer = screen.getByTestId("marker-bar-1").parentElement!;
      fireEvent.mouseEnter(markerContainer, { clientX: 100, clientY: 200 });

      expect(screen.getByText("Description:")).toBeInTheDocument();
      expect(screen.getByText("Action scene description")).toBeInTheDocument();
    });

    it("displays additional tags in tooltip", () => {
      const marker = createMockMarker("1", 10, "Action", 15, [
        { id: "tag-2", name: "Wide Shot" },
        { id: "tag-3", name: "Day Time" },
      ]);
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [marker]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        { ...marker, tagGroup: "Action", track: 0, swimlane: 0 },
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      const markerContainer = screen.getByTestId("marker-bar-1").parentElement!;
      fireEvent.mouseEnter(markerContainer, { clientX: 100, clientY: 200 });

      expect(screen.getByText("Other Tags:")).toBeInTheDocument();
      expect(screen.getByText("Wide Shot")).toBeInTheDocument();
      expect(screen.getByText("Day Time")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles markers without end time", () => {
      const marker = createMockMarker("1", 10, "Action");
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [marker]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        { ...marker, tagGroup: "Action", track: 0, swimlane: 0 },
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      const markerContainer = screen.getByTestId("marker-bar-1").parentElement!;
      fireEvent.mouseEnter(markerContainer);

      // Tooltip should show only start time
      expect(screen.getByText(/0:10$/)).toBeInTheDocument();
    });

    it("handles zero pixels per second", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createMockMarker("1", 10, "Action")]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
          pixelsPerSecond={0}
        />
      );

      // Should render without crashing
      expect(screen.getByTestId("marker-bar-1")).toBeInTheDocument();
    });

    it("handles empty tag group", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", []),
      ];

      render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={[]}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      // Should render swimlane but no markers
      expect(screen.queryByTestId(/marker-bar-/)).not.toBeInTheDocument();
    });
  });

  describe("Layout Calculations", () => {
    it("calculates correct swimlane height for single track", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createMockMarker("1", 10, "Action")]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
      ];

      const { container } = render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
        />
      );

      // Height = (1 * 24) + ((1-1) * 2) + 4 = 28px
      const swimlane = container.querySelector(".border-b");
      expect(swimlane).toHaveStyle({ height: "28px" });
    });

    it("calculates correct swimlane height for three tracks", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [
            createMockMarker("1", 10, "Action"),
            createMockMarker("2", 11, "Action"),
            createMockMarker("3", 12, "Action"),
          ]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
        createMockMarkerWithTrack("2", 11, "Action", "Action", 1),
        createMockMarkerWithTrack("3", 12, "Action", "Action", 2),
      ];

      const { container } = render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 3 }}
        />
      );

      // Height = (3 * 24) + ((3-1) * 2) + 4 = 80px
      const swimlane = container.querySelector(".border-b");
      expect(swimlane).toHaveStyle({ height: "80px" });
    });

    it("sets correct timeline width", () => {
      const tagGroups: TagGroup[] = [
        createMockTagGroup("Action", [createMockMarker("1", 10, "Action")]),
      ];
      const markersWithTracks: MarkerWithTrack[] = [
        createMockMarkerWithTrack("1", 10, "Action", "Action", 0),
      ];

      const { container } = render(
        <TimelineGrid
          {...defaultProps}
          tagGroups={tagGroups}
          markersWithTracks={markersWithTracks}
          trackCountsByGroup={{ Action: 1 }}
          timelineWidth={1200}
        />
      );

      const timeline = container.querySelector(".relative");
      expect(timeline).toHaveStyle({ width: "1200px" });
    });
  });
});
