import { SceneMarker } from "../../services/StashappService";
import { isMarkerManual, isUnprocessed } from "./markerLogic";

// Use the mock service
jest.mock("../../services/StashappService");
import { stashappService } from "../../services/StashappService";

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
          { id: stashappService.MARKER_SOURCE_MANUAL, name: "Manual" },
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
        tags: [
          { id: stashappService.MARKER_STATUS_CONFIRMED, name: "Confirmed" },
        ],
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
        tags: [
          { id: stashappService.MARKER_STATUS_REJECTED, name: "Rejected" },
        ],
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
        tags: [{ id: stashappService.MARKER_SOURCE_MANUAL, name: "Manual" }],
      };

      expect(isUnprocessed(marker)).toBe(false);
    });
  });
});
