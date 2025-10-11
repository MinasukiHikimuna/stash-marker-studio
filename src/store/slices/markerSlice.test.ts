import { configureStore } from "@reduxjs/toolkit";
import markerReducer, { splitMarker } from "./markerSlice";

// Mock constants matching test environment
const MARKER_SOURCE_MANUAL = "100003";
const MARKER_STATUS_CONFIRMED = "100001";
const MARKER_STATUS_REJECTED = "100002";

// Mock StashappService
jest.mock("../../services/StashappService", () => ({
  stashappService: {
    markerSourceManual: MARKER_SOURCE_MANUAL,
    markerStatusConfirmed: MARKER_STATUS_CONFIRMED,
    markerStatusRejected: MARKER_STATUS_REJECTED,
    getAllTags: jest.fn(),
  },
  StashappService: jest.fn(),
}));

// Import after mocking
import { stashappService } from "../../services/StashappService";

describe("markerSlice - splitMarker thunk", () => {
  let store: ReturnType<typeof createTestStore>;
  let originalFetch: typeof global.fetch;

  const createTestStore = () => configureStore({
    reducer: {
      marker: markerReducer,
    },
  });

  beforeEach(() => {
    // Create a fresh store for each test
    store = createTestStore();

    // Mock fetch for API calls
    originalFetch = global.fetch;
    global.fetch = jest.fn();

    // Mock stashappService.getAllTags to return deterministic tag data
    (stashappService.getAllTags as jest.Mock).mockResolvedValue({
      findTags: {
        tags: [
          { id: "tag1", name: "Tag 1" },
          { id: "tag2", name: "Tag 2" },
          { id: MARKER_STATUS_CONFIRMED, name: "Confirmed" },
          { id: MARKER_SOURCE_MANUAL, name: "Manual" },
        ],
      },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe("Phase 1: Existing functionality (tags and times)", () => {
    it("should split marker at midpoint with correct times", async () => {
      const sceneId = "scene1";
      const sourceMarkerId = "marker1";
      const splitTime = 50;
      const sourceStartTime = 0;
      const sourceEndTime = 100;

      // Mock PATCH response (update first marker)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Mock POST response (create second marker)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          marker: { id: "marker2" },
        }),
      });

      // Mock GET response for loadMarkers
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ markers: [] }),
      });

      await store.dispatch(
        splitMarker({
          sceneId,
          sourceMarkerId,
          splitTime,
          tagId: "tag1",
          originalTagIds: ["tag1", MARKER_STATUS_CONFIRMED],
          sourceStartTime,
          sourceEndTime,
        })
      );

      // Verify PATCH call (first marker update)
      const patchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(patchCall[0]).toBe(`/api/markers/${sourceMarkerId}`);
      expect(patchCall[1].method).toBe("PATCH");
      const patchBody = JSON.parse(patchCall[1].body);
      expect(patchBody).toEqual({
        seconds: sourceStartTime,
        endSeconds: splitTime,
      });

      // Verify POST call (second marker creation)
      const postCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(postCall[0]).toBe("/api/markers");
      expect(postCall[1].method).toBe("POST");
      const postBody = JSON.parse(postCall[1].body);
      expect(postBody.stashappSceneId).toBe(sceneId);
      expect(postBody.seconds).toBe(splitTime);
      expect(postBody.endSeconds).toBe(sourceEndTime);
      expect(postBody.primaryTagId).toBe("tag1");
    });

    it("should preserve all original tags in second marker", async () => {
      const sceneId = "scene1";
      const sourceMarkerId = "marker1";
      const splitTime = 50;
      const originalTagIds = ["tag1", "tag2", MARKER_STATUS_CONFIRMED, MARKER_SOURCE_MANUAL];

      // Mock all API responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }) // PATCH
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, marker: { id: "marker2" } }) }) // POST
        .mockResolvedValueOnce({ ok: true, json: async () => ({ markers: [] }) }); // GET (loadMarkers)

      await store.dispatch(
        splitMarker({
          sceneId,
          sourceMarkerId,
          splitTime,
          tagId: "tag1",
          originalTagIds,
          sourceStartTime: 0,
          sourceEndTime: 100,
        })
      );

      // Verify POST body includes all original tags
      const postCall = (global.fetch as jest.Mock).mock.calls[1];
      const postBody = JSON.parse(postCall[1].body);
      expect(postBody.tagIds).toEqual(originalTagIds);
    });

    it("should reject split when marker has no end time", async () => {
      const sceneId = "scene1";
      const sourceMarkerId = "marker1";
      const splitTime = 50;

      try {
        await store.dispatch(
          splitMarker({
            sceneId,
            sourceMarkerId,
            splitTime,
            tagId: "tag1",
            originalTagIds: ["tag1"],
            sourceStartTime: 0,
            sourceEndTime: null,
          })
        ).unwrap();
        fail("Expected thunk to reject");
      } catch (error) {
        expect(error).toBe("Cannot split a marker without an end time");
      }

      // No API calls should be made
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should reject split when split time equals start time", async () => {
      const sceneId = "scene1";
      const sourceMarkerId = "marker1";
      const splitTime = 0;
      const sourceStartTime = 0;
      const sourceEndTime = 100;

      try {
        await store.dispatch(
          splitMarker({
            sceneId,
            sourceMarkerId,
            splitTime,
            tagId: "tag1",
            originalTagIds: ["tag1"],
            sourceStartTime,
            sourceEndTime,
          })
        ).unwrap();
        fail("Expected thunk to reject");
      } catch (error) {
        expect(error).toBe("Split time must be within the marker range");
      }

      // No API calls should be made
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should reject split when split time equals end time", async () => {
      const sceneId = "scene1";
      const sourceMarkerId = "marker1";
      const splitTime = 100;
      const sourceStartTime = 0;
      const sourceEndTime = 100;

      try {
        await store.dispatch(
          splitMarker({
            sceneId,
            sourceMarkerId,
            splitTime,
            tagId: "tag1",
            originalTagIds: ["tag1"],
            sourceStartTime,
            sourceEndTime,
          })
        ).unwrap();
        fail("Expected thunk to reject");
      } catch (error) {
        expect(error).toBe("Split time must be within the marker range");
      }

      // No API calls should be made
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Phase 2: Slot copying (TDD - should fail until implemented)", () => {
    it("should copy all slot assignments to second marker", async () => {
      const sceneId = "scene1";
      const sourceMarkerId = "marker1";
      const splitTime = 50;
      const originalSlots = [
        { slotDefinitionId: "slot1", performerId: "123" },
        { slotDefinitionId: "slot2", performerId: "456" },
      ];

      // Mock all API responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }) // PATCH
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, marker: { id: "marker2" } }) }) // POST
        .mockResolvedValueOnce({ ok: true, json: async () => ({ markers: [] }) }); // GET

      await store.dispatch(
        splitMarker({
          sceneId,
          sourceMarkerId,
          splitTime,
          tagId: "tag1",
          originalTagIds: ["tag1"],
          originalSlots,
          sourceStartTime: 0,
          sourceEndTime: 100,
        })
      );

      // CRITICAL: Assert POST body contains slots array
      const postCall = (global.fetch as jest.Mock).mock.calls[1];
      const postBody = JSON.parse(postCall[1].body);

      expect(postBody.slots).toBeDefined();
      expect(postBody.slots).toEqual(originalSlots);
    });

    it("should handle empty slots array", async () => {
      const sceneId = "scene1";
      const sourceMarkerId = "marker1";
      const splitTime = 50;
      const originalSlots: Array<{ slotDefinitionId: string; performerId: string | null }> = [];

      // Mock all API responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, marker: { id: "marker2" } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ markers: [] }) });

      await store.dispatch(
        splitMarker({
          sceneId,
          sourceMarkerId,
          splitTime,
          tagId: "tag1",
          originalTagIds: ["tag1"],
          originalSlots,
          sourceStartTime: 0,
          sourceEndTime: 100,
        })
      );

      // POST body should have empty slots array
      const postCall = (global.fetch as jest.Mock).mock.calls[1];
      const postBody = JSON.parse(postCall[1].body);
      expect(postBody.slots).toEqual([]);
    });

    it("should handle partial slot assignments with null performers", async () => {
      const sceneId = "scene1";
      const sourceMarkerId = "marker1";
      const splitTime = 50;
      const originalSlots = [
        { slotDefinitionId: "slot1", performerId: "123" },  // Assigned
        { slotDefinitionId: "slot2", performerId: null },   // Empty
        { slotDefinitionId: "slot3", performerId: "789" },  // Assigned
      ];

      // Mock all API responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, marker: { id: "marker2" } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ markers: [] }) });

      await store.dispatch(
        splitMarker({
          sceneId,
          sourceMarkerId,
          splitTime,
          tagId: "tag1",
          originalTagIds: ["tag1"],
          originalSlots,
          sourceStartTime: 0,
          sourceEndTime: 100,
        })
      );

      // Verify POST body preserves null performers
      const postCall = (global.fetch as jest.Mock).mock.calls[1];
      const postBody = JSON.parse(postCall[1].body);
      expect(postBody.slots).toEqual(originalSlots);
      expect(postBody.slots[1].performerId).toBeNull();
    });

    it("should not pass slots when originalSlots is undefined", async () => {
      const sceneId = "scene1";
      const sourceMarkerId = "marker1";
      const splitTime = 50;

      // Mock all API responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, marker: { id: "marker2" } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ markers: [] }) });

      await store.dispatch(
        splitMarker({
          sceneId,
          sourceMarkerId,
          splitTime,
          tagId: "tag1",
          originalTagIds: ["tag1"],
          // No originalSlots parameter
          sourceStartTime: 0,
          sourceEndTime: 100,
        })
      );

      // POST body should not have slots field
      const postCall = (global.fetch as jest.Mock).mock.calls[1];
      const postBody = JSON.parse(postCall[1].body);
      expect(postBody.slots).toBeUndefined();
    });
  });
});
