/**
 * Test utilities for creating marker test data
 */

import { SceneMarker } from "../../services/StashappService";

export type Tag = {
  id: string;
  name: string;
  description?: string | null;
  parents?: Array<{
    id: string;
    name: string;
    description?: string | null;
    parents?: Array<{
      id: string;
      name: string;
      description?: string | null;
      parents?: unknown[];
    }>;
  }>;
};

// Mock tag IDs matching the pattern in markerLogic.test.ts
export const MARKER_SOURCE_MANUAL = "100003";
export const MARKER_STATUS_CONFIRMED = "100001";
export const MARKER_STATUS_REJECTED = "100002";
export const MARKER_SHOT_BOUNDARY = "300001";
export const MARKER_AI_REVIEWED = "100004";

/**
 * Create a test marker with sensible defaults
 */
export function createTestMarker(overrides: Partial<SceneMarker> = {}): SceneMarker {
  return {
    id: "test-marker-1",
    title: "Test Marker",
    seconds: 0,
    end_seconds: undefined,
    stream: "",
    screenshot: "",
    preview: "",
    scene: { id: "test-scene-1", title: "Test Scene" },
    primary_tag: {
      id: "test-tag-1",
      name: "Test Tag",
      description: null,
      parents: [],
    },
    tags: [],
    ...overrides,
  };
}

/**
 * Create a test tag with sensible defaults
 */
export function createTestTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: "test-tag-1",
    name: "Test Tag",
    description: null,
    parents: [],
    ...overrides,
  };
}

/**
 * Create a confirmed marker
 */
export function createConfirmedMarker(overrides: Partial<SceneMarker> = {}): SceneMarker {
  return createTestMarker({
    tags: [{ id: MARKER_STATUS_CONFIRMED, name: "Confirmed" }],
    ...overrides,
  });
}

/**
 * Create a rejected marker
 */
export function createRejectedMarker(overrides: Partial<SceneMarker> = {}): SceneMarker {
  return createTestMarker({
    tags: [{ id: MARKER_STATUS_REJECTED, name: "Rejected" }],
    ...overrides,
  });
}

/**
 * Create an unprocessed marker
 */
export function createUnprocessedMarker(overrides: Partial<SceneMarker> = {}): SceneMarker {
  return createTestMarker({
    tags: [],
    ...overrides,
  });
}

/**
 * Create a marker with a specific primary tag
 */
export function createMarkerWithTag(
  tagName: string,
  seconds: number,
  overrides: Partial<SceneMarker> = {}
): SceneMarker {
  return createTestMarker({
    primary_tag: createTestTag({ name: tagName, id: `tag-${tagName.toLowerCase()}` }),
    seconds,
    ...overrides,
  });
}

/**
 * Create a marker with a corresponding tag in description
 */
export function createMarkerWithCorrespondingTag(
  tagName: string,
  correspondingTagName: string,
  seconds: number,
  overrides: Partial<SceneMarker> = {}
): SceneMarker {
  return createTestMarker({
    primary_tag: createTestTag({
      name: tagName,
      id: `tag-${tagName.toLowerCase()}`,
      description: `Corresponding Tag: ${correspondingTagName}`,
    }),
    seconds,
    ...overrides,
  });
}

/**
 * Create a marker with a marker group parent
 */
export function createMarkerWithMarkerGroup(
  tagName: string,
  markerGroupName: string,
  markerGroupParentId: string,
  seconds: number,
  overrides: Partial<SceneMarker> = {}
): SceneMarker {
  return createTestMarker({
    primary_tag: createTestTag({
      name: tagName,
      id: `tag-${tagName.toLowerCase()}`,
      parents: [
        {
          id: `marker-group-${markerGroupName.toLowerCase()}`,
          name: `Marker Group: ${markerGroupName}`,
          description: null,
          parents: [
            {
              id: markerGroupParentId,
              name: "Marker Groups",
              description: null,
              parents: [],
            },
          ],
        },
      ],
    }),
    seconds,
    ...overrides,
  });
}

/**
 * Create overlapping markers for track assignment testing
 */
export function createOverlappingMarkers(
  tagName: string,
  timeRanges: Array<{ start: number; end?: number }>
): SceneMarker[] {
  return timeRanges.map((range, index) =>
    createTestMarker({
      id: `marker-${index}`,
      primary_tag: createTestTag({ name: tagName, id: `tag-${tagName.toLowerCase()}` }),
      seconds: range.start,
      end_seconds: range.end,
    })
  );
}
