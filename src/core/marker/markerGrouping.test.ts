/**
 * Unit tests for marker grouping logic
 */

// Mock the service with sample env values
const MARKER_SOURCE_MANUAL = "100003";
const MARKER_STATUS_CONFIRMED = "100001";
const MARKER_STATUS_REJECTED = "100002";
const MARKER_SHOT_BOUNDARY = "300001";
const MARKER_AI_REVIEWED = "100004";

jest.mock("../../services/StashappService", () => ({
  stashappService: {
    markerSourceManual: MARKER_SOURCE_MANUAL,
    markerStatusConfirmed: MARKER_STATUS_CONFIRMED,
    markerStatusRejected: MARKER_STATUS_REJECTED,
    markerShotBoundary: MARKER_SHOT_BOUNDARY,
    markerAiReviewed: MARKER_AI_REVIEWED,
  },
}));

import {
  parseSortOrder,
  createSortOrderDescription,
  getMarkerGroupName,
  groupMarkersByTags,
  createMarkersWithTracks,
  getTrackCountsByGroup,
} from "./markerGrouping";
import {
  createTestMarker,
  createMarkerWithTag,
  createMarkerWithCorrespondingTag,
  createMarkerWithMarkerGroup,
  createOverlappingMarkers,
  createConfirmedMarker,
  createRejectedMarker,
} from "./testUtils";

// Suppress console.log from the grouping functions
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("parseSortOrder", () => {
  it("should parse comma-separated tag IDs", () => {
    const description = "Sort Order: 123, 456, 789";
    const result = parseSortOrder(description);
    expect(result).toEqual(["123", "456", "789"]);
  });

  it("should handle whitespace around IDs", () => {
    const description = "Sort Order:  123 ,  456  , 789  ";
    const result = parseSortOrder(description);
    expect(result).toEqual(["123", "456", "789"]);
  });

  it("should handle multiline descriptions", () => {
    const description = "Some text\nSort Order: 123, 456\nMore text";
    const result = parseSortOrder(description);
    expect(result).toEqual(["123", "456"]);
  });

  it("should return empty array when no sort order", () => {
    const description = "No sort order here";
    const result = parseSortOrder(description);
    expect(result).toEqual([]);
  });

  it("should return empty array for null description", () => {
    const result = parseSortOrder(null);
    expect(result).toEqual([]);
  });

  it("should return empty array for empty description", () => {
    const result = parseSortOrder("");
    expect(result).toEqual([]);
  });
});

describe("createSortOrderDescription", () => {
  it("should create sort order line from tag IDs", () => {
    const tagIds = ["123", "456", "789"];
    const result = createSortOrderDescription(tagIds);
    expect(result).toBe("Sort Order: 123, 456, 789");
  });

  it("should append to existing description", () => {
    const tagIds = ["123", "456"];
    const existing = "Existing text";
    const result = createSortOrderDescription(tagIds, existing);
    expect(result).toBe("Existing text\nSort Order: 123, 456");
  });

  it("should replace existing sort order", () => {
    const tagIds = ["999"];
    const existing = "Text\nSort Order: 123, 456\nMore text";
    const result = createSortOrderDescription(tagIds, existing);
    expect(result).toBe("Text\nSort Order: 999\nMore text");
  });
});

describe("getMarkerGroupName", () => {
  const MARKER_GROUP_PARENT_ID = "marker-groups-parent";

  it("should extract marker group name", () => {
    const marker = createMarkerWithMarkerGroup(
      "Test Tag",
      "Group A",
      MARKER_GROUP_PARENT_ID,
      0
    );

    const result = getMarkerGroupName(marker, MARKER_GROUP_PARENT_ID);
    expect(result).toEqual({
      fullName: "Marker Group: Group A",
      displayName: "Group A",
    });
  });

  it("should remove number prefix from display name", () => {
    const marker = createMarkerWithMarkerGroup(
      "Test Tag",
      "1. First Group",
      MARKER_GROUP_PARENT_ID,
      0
    );

    const result = getMarkerGroupName(marker, MARKER_GROUP_PARENT_ID);
    expect(result).toEqual({
      fullName: "Marker Group: 1. First Group",
      displayName: "First Group",
    });
  });

  it("should return null when no parents", () => {
    const marker = createMarkerWithTag("Test Tag", 0);
    const result = getMarkerGroupName(marker, MARKER_GROUP_PARENT_ID);
    expect(result).toBeNull();
  });

  it("should return null when parent is not marker group", () => {
    const marker = createTestMarker({
      primary_tag: {
        id: "tag-1",
        name: "Test Tag",
        description: null,
        parents: [
          {
            id: "other-parent",
            name: "Other Parent",
            parents: [],
          },
        ],
      },
    });

    const result = getMarkerGroupName(marker, MARKER_GROUP_PARENT_ID);
    expect(result).toBeNull();
  });
});

describe("groupMarkersByTags", () => {
  const MARKER_GROUP_PARENT_ID = "marker-groups-parent";

  it("should group markers by tag name", () => {
    const markers = [
      createMarkerWithTag("Tag A", 0),
      createMarkerWithTag("Tag A", 5),
      createMarkerWithTag("Tag B", 3),
    ];

    const result = groupMarkersByTags(markers, MARKER_GROUP_PARENT_ID);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Tag A");
    expect(result[0].markers).toHaveLength(2);
    expect(result[1].name).toBe("Tag B");
    expect(result[1].markers).toHaveLength(1);
  });

  it("should sort markers within groups by time", () => {
    const markers = [
      createMarkerWithTag("Tag A", 10),
      createMarkerWithTag("Tag A", 2),
      createMarkerWithTag("Tag A", 5),
    ];

    const result = groupMarkersByTags(markers, MARKER_GROUP_PARENT_ID);

    expect(result[0].markers[0].seconds).toBe(2);
    expect(result[0].markers[1].seconds).toBe(5);
    expect(result[0].markers[2].seconds).toBe(10);
  });

  it("should group by corresponding tag when specified", () => {
    const markers = [
      createMarkerWithCorrespondingTag("Blowjob_AI", "Blowjob", 0),
      createMarkerWithTag("Blowjob", 5),
    ];

    const result = groupMarkersByTags(markers, MARKER_GROUP_PARENT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Blowjob");
    expect(result[0].markers).toHaveLength(2);
  });

  it("should mark group as rejected only when all markers are rejected", () => {
    const markers = [
      createRejectedMarker({ primary_tag: { id: "tag-a", name: "Tag A", description: null, parents: [] }, seconds: 0 }),
      createRejectedMarker({ primary_tag: { id: "tag-a", name: "Tag A", description: null, parents: [] }, seconds: 5 }),
    ];

    const result = groupMarkersByTags(markers, MARKER_GROUP_PARENT_ID);

    expect(result[0].isRejected).toBe(true);
  });

  it("should not mark group as rejected when some markers are confirmed", () => {
    const markers = [
      createRejectedMarker({ primary_tag: { id: "tag-a", name: "Tag A", description: null, parents: [] }, seconds: 0 }),
      createConfirmedMarker({ primary_tag: { id: "tag-a", name: "Tag A", description: null, parents: [] }, seconds: 5 }),
    ];

    const result = groupMarkersByTags(markers, MARKER_GROUP_PARENT_ID);

    expect(result[0].isRejected).toBe(false);
  });

  it("should sort groups alphabetically when no marker groups", () => {
    const markers = [
      createMarkerWithTag("Zebra", 0),
      createMarkerWithTag("Apple", 0),
      createMarkerWithTag("Banana", 0),
    ];

    const result = groupMarkersByTags(markers, MARKER_GROUP_PARENT_ID);

    expect(result[0].name).toBe("Apple");
    expect(result[1].name).toBe("Banana");
    expect(result[2].name).toBe("Zebra");
  });

  it("should sort by marker group name when present", () => {
    const markers = [
      createMarkerWithMarkerGroup("Tag A", "2. Group B", MARKER_GROUP_PARENT_ID, 0),
      createMarkerWithMarkerGroup("Tag B", "1. Group A", MARKER_GROUP_PARENT_ID, 0),
    ];

    const result = groupMarkersByTags(markers, MARKER_GROUP_PARENT_ID);

    expect(result[0].name).toBe("Tag B");
    expect(result[1].name).toBe("Tag A");
  });

  it("should use tag sorting within same marker group", () => {
    const markerGroupId = "marker-group-1";
    const markerGroups = [
      { id: markerGroupId, name: "Marker Group: Group A", description: null },
    ];
    const tagSorting = {
      [markerGroupId]: ["tag-tag2", "tag-tag1"],
    };

    const markers = [
      createMarkerWithMarkerGroup("Tag1", "Group A", MARKER_GROUP_PARENT_ID, 0),
      createMarkerWithMarkerGroup("Tag2", "Group A", MARKER_GROUP_PARENT_ID, 5),
    ];

    const result = groupMarkersByTags(markers, MARKER_GROUP_PARENT_ID, markerGroups, tagSorting);

    expect(result[0].name).toBe("Tag2");
    expect(result[1].name).toBe("Tag1");
  });
});

describe("createMarkersWithTracks", () => {
  it("should assign swimlane numbers matching group order", () => {
    const markers = [
      createMarkerWithTag("Tag A", 0),
      createMarkerWithTag("Tag B", 0),
    ];

    const tagGroups = groupMarkersByTags(markers, "parent-id");
    const result = createMarkersWithTracks(tagGroups);

    expect(result[0].swimlane).toBe(0);
    expect(result[0].tagGroup).toBe("Tag A");
    expect(result[1].swimlane).toBe(1);
    expect(result[1].tagGroup).toBe("Tag B");
  });

  it("should assign track 0 to non-overlapping markers", () => {
    const markers = [
      createMarkerWithTag("Tag A", 0, { end_seconds: 2 }),
      createMarkerWithTag("Tag A", 5, { end_seconds: 7 }),
    ];

    const tagGroups = groupMarkersByTags(markers, "parent-id");
    const result = createMarkersWithTracks(tagGroups);

    expect(result[0].track).toBe(0);
    expect(result[1].track).toBe(0);
  });

  it("should assign different tracks to overlapping markers", () => {
    const markers = createOverlappingMarkers("Tag A", [
      { start: 0, end: 5 },
      { start: 3, end: 8 },
      { start: 6, end: 10 },
    ]);

    const tagGroups = groupMarkersByTags(markers, "parent-id");
    const result = createMarkersWithTracks(tagGroups);

    expect(result[0].track).toBe(0);
    expect(result[1].track).toBe(1);
    expect(result[2].track).toBe(0); // Can reuse track 0 since it doesn't overlap with first
  });
});

describe("getTrackCountsByGroup", () => {
  it("should return track count for single marker", () => {
    const markers = [createMarkerWithTag("Tag A", 0)];
    const tagGroups = groupMarkersByTags(markers, "parent-id");

    const result = getTrackCountsByGroup(tagGroups);

    expect(result["Tag A"]).toBe(1);
  });

  it("should return track count for overlapping markers", () => {
    const markers = createOverlappingMarkers("Tag A", [
      { start: 0, end: 5 },
      { start: 3, end: 8 },
      { start: 4, end: 9 },
    ]);

    const tagGroups = groupMarkersByTags(markers, "parent-id");
    const result = getTrackCountsByGroup(tagGroups);

    expect(result["Tag A"]).toBe(3);
  });

  it("should handle multiple groups", () => {
    const markers = [
      ...createOverlappingMarkers("Tag A", [
        { start: 0, end: 5 },
        { start: 3, end: 8 },
      ]),
      createMarkerWithTag("Tag B", 0),
    ];

    const tagGroups = groupMarkersByTags(markers, "parent-id");
    const result = getTrackCountsByGroup(tagGroups);

    expect(result["Tag A"]).toBe(2);
    expect(result["Tag B"]).toBe(1);
  });
});
