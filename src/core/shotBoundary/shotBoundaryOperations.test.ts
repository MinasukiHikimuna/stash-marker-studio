import {
  planAddShotBoundaryAtPlayhead,
  planRemoveShotBoundaryMarker,
} from "./shotBoundaryOperations";
import { ShotBoundarySource, type ShotBoundary } from "./types";

function makeShotBoundary(
  overrides: Partial<ShotBoundary> & Pick<ShotBoundary, "startTime" | "endTime" | "id">
): ShotBoundary {
  return {
    id: overrides.id,
    startTime: overrides.startTime,
    endTime: overrides.endTime,
    stashappSceneId: overrides.stashappSceneId ?? 1,
    source: overrides.source ?? ShotBoundarySource.MANUAL,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

describe("planAddShotBoundaryAtPlayhead", () => {
  it("plans a split when playhead is inside existing boundary", () => {
    const result = planAddShotBoundaryAtPlayhead({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 0, endTime: 100 }),
      ],
      currentTime: 50,
      videoDuration: 300,
    });

    expect(result).toMatchObject({
      status: "success",
      outcome: "split-existing",
    });
    if (result.status !== "success") {
      throw new Error("Expected success plan");
    }

    expect(result.actions).toHaveLength(2);
    const [updateAction, createAction] = result.actions;

    expect(updateAction).toEqual({
      type: "update",
      boundaryId: "1",
      startTime: 0,
      endTime: 50,
      source: ShotBoundarySource.MANUAL,
    });

    expect(createAction).toEqual({
      type: "create",
      startTime: 50,
      endTime: 100,
    });
  });

  it("creates a new boundary when containing shot lacks end time", () => {
    const result = planAddShotBoundaryAtPlayhead({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 0, endTime: null }),
      ],
      currentTime: 50,
      videoDuration: 300,
    });

    expect(result).toMatchObject({
      status: "success",
      outcome: "extend-previous",
    });
    if (result.status !== "success") {
      throw new Error("Expected success plan");
    }

    expect(result.actions).toEqual([
      { type: "create", startTime: 50, endTime: 300 },
    ]);
  });

  it("plans gap filling when previous boundary ends before playhead", () => {
    const result = planAddShotBoundaryAtPlayhead({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 0, endTime: 40 }),
        makeShotBoundary({ id: "2", startTime: 120, endTime: 200 }),
      ],
      currentTime: 100,
      videoDuration: 240,
    });

    expect(result).toMatchObject({
      status: "success",
      outcome: "fill-gap",
    });
    if (result.status !== "success") {
      throw new Error("Expected success plan");
    }

    expect(result.actions).toEqual([
      { type: "create", startTime: 40, endTime: 100 },
      { type: "create", startTime: 100, endTime: 120 },
    ]);
  });

  it("plans creation from start when playhead precedes all boundaries", () => {
    const result = planAddShotBoundaryAtPlayhead({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 120, endTime: 200 }),
      ],
      currentTime: 60,
      videoDuration: 300,
    });

    expect(result).toMatchObject({
      status: "success",
      outcome: "create-from-start",
    });
    if (result.status !== "success") {
      throw new Error("Expected success plan");
    }

    expect(result.actions).toEqual([
      { type: "create", startTime: 0, endTime: 60 },
      { type: "create", startTime: 60, endTime: 120 },
    ]);
  });

  it("plans gap filling when playhead is after the last boundary end", () => {
    const result = planAddShotBoundaryAtPlayhead({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 0, endTime: 100 }),
      ],
      currentTime: 150,
      videoDuration: 400,
    });

    expect(result).toMatchObject({
      status: "success",
      outcome: "fill-gap",
    });
    if (result.status !== "success") {
      throw new Error("Expected success plan");
    }

    expect(result.actions).toEqual([
      { type: "create", startTime: 100, endTime: 150 },
      { type: "create", startTime: 150, endTime: 400 },
    ]);
  });

  it("falls back to default duration when video duration is unknown", () => {
    const result = planAddShotBoundaryAtPlayhead({
      shotBoundaries: [],
      currentTime: 30,
      videoDuration: null,
    });

    expect(result).toMatchObject({
      status: "success",
      outcome: "create-from-start",
    });
    if (result.status !== "success") {
      throw new Error("Expected success plan");
    }

    expect(result.actions).toEqual([
      { type: "create", startTime: 0, endTime: 30 },
      { type: "create", startTime: 30, endTime: 50 },
    ]);
  });
});

describe("planRemoveShotBoundaryMarker", () => {
  it("returns error when there are no boundaries", () => {
    const result = planRemoveShotBoundaryMarker({
      shotBoundaries: [],
      currentTime: 0,
      videoDuration: 100,
    });

    expect(result).toEqual({
      status: "error",
      message: "No shot boundaries found",
    });
  });

  it("returns error when no boundary matches tolerance", () => {
    const result = planRemoveShotBoundaryMarker({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 10, endTime: 20 }),
      ],
      currentTime: 30,
      videoDuration: 100,
      toleranceSeconds: 0.25,
    });

    expect(result).toEqual({
      status: "error",
      message: "No shot boundary marker found at current playhead position",
    });
  });

  it("plans removal of first boundary by extending next to start", () => {
    const result = planRemoveShotBoundaryMarker({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 0, endTime: 40 }),
        makeShotBoundary({ id: "2", startTime: 40, endTime: 100 }),
      ],
      currentTime: 0.2,
      videoDuration: 120,
    });

    expect(result).toMatchObject({
      status: "success",
      outcome: "remove-first",
    });
    if (result.status !== "success") {
      throw new Error("Expected success plan");
    }

    expect(result.actions).toEqual([
      {
        type: "update",
        boundaryId: "2",
        startTime: 0,
        endTime: 100,
      },
      { type: "delete", boundaryId: "1" },
    ]);
  });

  it("returns error when attempting to remove the only boundary", () => {
    const result = planRemoveShotBoundaryMarker({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 0, endTime: 40 }),
      ],
      currentTime: 0,
      videoDuration: 120,
    });

    expect(result).toEqual({
      status: "error",
      message: "Cannot remove the only shot boundary",
    });
  });

  it("plans merge with previous boundary, using current end time when present", () => {
    const result = planRemoveShotBoundaryMarker({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 0, endTime: 40 }),
        makeShotBoundary({ id: "2", startTime: 40, endTime: 80 }),
      ],
      currentTime: 40,
      videoDuration: 200,
    });

    expect(result).toMatchObject({
      status: "success",
      outcome: "merge-with-previous",
    });
    if (result.status !== "success") {
      throw new Error("Expected success plan");
    }

    expect(result.actions).toEqual([
      {
        type: "update",
        boundaryId: "1",
        startTime: 0,
        endTime: 80,
      },
      { type: "delete", boundaryId: "2" },
    ]);
  });

  it("falls back to video duration when boundary end is undefined", () => {
    const result = planRemoveShotBoundaryMarker({
      shotBoundaries: [
        makeShotBoundary({ id: "1", startTime: 0, endTime: 40 }),
        makeShotBoundary({ id: "2", startTime: 40, endTime: null }),
      ],
      currentTime: 40.4,
      videoDuration: 150,
    });

    expect(result).toMatchObject({
      status: "success",
      outcome: "merge-with-previous",
    });
    if (result.status !== "success") {
      throw new Error("Expected success plan");
    }

    expect(result.actions).toEqual([
      {
        type: "update",
        boundaryId: "1",
        startTime: 0,
        endTime: 150,
      },
      { type: "delete", boundaryId: "2" },
    ]);
  });
});
