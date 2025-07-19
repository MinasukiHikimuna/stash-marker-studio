// Mock the service with sample env values
const MARKER_SOURCE_MANUAL = "100003";
const MARKER_STATUS_CONFIRMED = "100001";
const MARKER_STATUS_REJECTED = "100002";
const MARKER_SHOT_BOUNDARY = "300001";
const MARKER_AI_REVIEWED = "100004";

jest.mock("../../services/StashappService", () => ({
  stashappService: {
    MARKER_SOURCE_MANUAL: MARKER_SOURCE_MANUAL,
    MARKER_STATUS_CONFIRMED: MARKER_STATUS_CONFIRMED,
    MARKER_STATUS_REJECTED: MARKER_STATUS_REJECTED,
    MARKER_SHOT_BOUNDARY: MARKER_SHOT_BOUNDARY,
    MARKER_AI_REVIEWED: MARKER_AI_REVIEWED,
  },
}));

import { type SceneMarker } from "../../services/StashappService";
import {
  isMarkerManual,
  isUnprocessed,
  isProcessed,
  getMarkerStatus,
  filterUnprocessedMarkers,
} from "./markerLogic";
import { MarkerStatus } from "./types";

describe("markerLogic", () => {
  describe("isMarkerManual", () => {
    it("should return true when marker has MARKER_SOURCE_MANUAL tag", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [
          { id: MARKER_SOURCE_MANUAL, name: "Manual" },
          { id: "other-tag", name: "Other Tag" },
        ],
      };

      expect(isMarkerManual(marker)).toBe(true);
    });

    it("should return false when marker does not have MARKER_SOURCE_MANUAL tag", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: "other-tag", name: "Other Tag" }],
      };

      expect(isMarkerManual(marker)).toBe(false);
    });

    it("should return false when marker has no tags", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [],
      };

      expect(isMarkerManual(marker)).toBe(false);
    });

    it("should return false when marker has undefined tags", () => {
      // Create a partial marker object and cast it to unknown first
      const marker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: undefined,
      } as unknown as SceneMarker;

      expect(isMarkerManual(marker)).toBe(false);
    });
  });

  describe("isUnprocessed", () => {
    it("should return true when marker has no status tags", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: "other-tag", name: "Other Tag" }],
      };

      expect(isUnprocessed(marker)).toBe(true);
    });

    it("should return false when marker is confirmed", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: MARKER_STATUS_CONFIRMED, name: "Confirmed" }],
      };

      expect(isUnprocessed(marker)).toBe(false);
    });

    it("should return false when marker is rejected", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: MARKER_STATUS_REJECTED, name: "Rejected" }],
      };

      expect(isUnprocessed(marker)).toBe(false);
    });

    it("should return false when marker is manual", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: MARKER_SOURCE_MANUAL, name: "Manual" }],
      };

      expect(isUnprocessed(marker)).toBe(false);
    });
  });

  describe("isProcessed", () => {
    it("should return true when marker is confirmed", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: MARKER_STATUS_CONFIRMED, name: "Confirmed" }],
      };

      expect(isProcessed(marker)).toBe(true);
    });

    it("should return true when marker is rejected", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: MARKER_STATUS_REJECTED, name: "Rejected" }],
      };

      expect(isProcessed(marker)).toBe(true);
    });

    it("should return true when marker is manual", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: MARKER_SOURCE_MANUAL, name: "Manual" }],
      };

      expect(isProcessed(marker)).toBe(true);
    });

    it("should return false when marker has no status tags", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: "other-tag", name: "Other Tag" }],
      };

      expect(isProcessed(marker)).toBe(false);
    });
  });

  describe("getMarkerStatus", () => {
    it("should return CONFIRMED when marker is confirmed", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: MARKER_STATUS_CONFIRMED, name: "Confirmed" }],
      };

      expect(getMarkerStatus(marker)).toBe(MarkerStatus.CONFIRMED);
    });

    it("should return REJECTED when marker is rejected", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: MARKER_STATUS_REJECTED, name: "Rejected" }],
      };

      expect(getMarkerStatus(marker)).toBe(MarkerStatus.REJECTED);
    });

    it("should return MANUAL when marker is manual", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: MARKER_SOURCE_MANUAL, name: "Manual" }],
      };

      expect(getMarkerStatus(marker)).toBe(MarkerStatus.MANUAL);
    });

    it("should return UNPROCESSED when marker has no status tags", () => {
      const marker: SceneMarker = {
        id: "1",
        title: "Test Marker",
        seconds: 0,
        stream: "",
        screenshot: "",
        preview: "",
        scene: { id: "1", title: "Test Scene" },
        primary_tag: { id: "tag1", name: "Tag 1" },
        tags: [{ id: "other-tag", name: "Other Tag" }],
      };

      expect(getMarkerStatus(marker)).toBe(MarkerStatus.UNPROCESSED);
    });
  });

  describe("filterUnprocessedMarkers", () => {
    it("should return only unprocessed markers", () => {
      const markers: SceneMarker[] = [
        {
          id: "1",
          title: "Unprocessed Marker",
          seconds: 0,
          stream: "",
          screenshot: "",
          preview: "",
          scene: { id: "1", title: "Test Scene" },
          primary_tag: { id: "tag1", name: "Tag 1" },
          tags: [{ id: "other-tag", name: "Other Tag" }],
        },
        {
          id: "2",
          title: "Confirmed Marker",
          seconds: 0,
          stream: "",
          screenshot: "",
          preview: "",
          scene: { id: "1", title: "Test Scene" },
          primary_tag: { id: "tag1", name: "Tag 1" },
          tags: [{ id: "100001", name: "Confirmed" }],
        },
        {
          id: "3",
          title: "Manual Marker",
          seconds: 0,
          stream: "",
          screenshot: "",
          preview: "",
          scene: { id: "1", title: "Test Scene" },
          primary_tag: { id: "tag1", name: "Tag 1" },
          tags: [{ id: "100003", name: "Manual" }],
        },
      ];

      const unprocessedMarkers = filterUnprocessedMarkers(markers);
      expect(unprocessedMarkers).toHaveLength(1);
      expect(unprocessedMarkers[0].id).toBe("1");
    });

    it("should return empty array when all markers are processed", () => {
      const markers: SceneMarker[] = [
        {
          id: "1",
          title: "Confirmed Marker",
          seconds: 0,
          stream: "",
          screenshot: "",
          preview: "",
          scene: { id: "1", title: "Test Scene" },
          primary_tag: { id: "tag1", name: "Tag 1" },
          tags: [{ id: "100001", name: "Confirmed" }],
        },
        {
          id: "2",
          title: "Manual Marker",
          seconds: 0,
          stream: "",
          screenshot: "",
          preview: "",
          scene: { id: "1", title: "Test Scene" },
          primary_tag: { id: "tag1", name: "Tag 1" },
          tags: [{ id: "100003", name: "Manual" }],
        },
      ];

      const unprocessedMarkers = filterUnprocessedMarkers(markers);
      expect(unprocessedMarkers).toHaveLength(0);
    });

    it("should return empty array when input array is empty", () => {
      const markers: SceneMarker[] = [];
      const unprocessedMarkers = filterUnprocessedMarkers(markers);
      expect(unprocessedMarkers).toHaveLength(0);
    });
  });
});
