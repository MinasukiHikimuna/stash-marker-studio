import type { ShotBoundary } from "./types";
import { ShotBoundarySource } from "./types";

export type ShotBoundaryPlanAction =
  | {
      type: "update";
      boundaryId: string;
      startTime: number;
      endTime: number | null;
      source?: ShotBoundarySource;
    }
  | {
      type: "create";
      startTime: number;
      endTime: number | null;
    }
  | {
      type: "delete";
      boundaryId: string;
    };

type PlanLog = {
  message: string;
  data: Record<string, unknown>;
};

export type PlanSuccess<TOutcome extends string> = {
  status: "success";
  outcome: TOutcome;
  actions: ShotBoundaryPlanAction[];
  log?: PlanLog;
};

export type PlanError = {
  status: "error";
  message: string;
};

export type AddShotBoundaryOutcome =
  | "split-existing"
  | "fill-gap"
  | "create-from-start"
  | "extend-previous"
  | "create-in-empty";

export type RemoveShotBoundaryOutcome =
  | "remove-first"
  | "merge-with-previous";

export function planAddShotBoundaryAtPlayhead(params: {
  shotBoundaries: ShotBoundary[];
  currentTime: number;
  videoDuration: number | null | undefined;
}): PlanSuccess<AddShotBoundaryOutcome> | PlanError {
  const sortedBoundaries = [...params.shotBoundaries].sort(
    (a, b) => a.startTime - b.startTime
  );
  const currentTime = params.currentTime;

  const containingShot = sortedBoundaries.find(
    (shot) =>
      shot.startTime <= currentTime &&
      shot.endTime !== null &&
      shot.endTime !== undefined &&
      shot.endTime > currentTime
  );

  if (containingShot) {
    if (
      containingShot.endTime === null ||
      containingShot.endTime === undefined
    ) {
      return {
        status: "error",
        message: "Cannot split shot boundary without end time",
      };
    }

    return {
      status: "success",
      outcome: "split-existing",
      actions: [
        {
          type: "update",
          boundaryId: containingShot.id,
          startTime: containingShot.startTime,
          endTime: currentTime,
          source: ShotBoundarySource.MANUAL,
        },
        {
          type: "create",
          startTime: currentTime,
          endTime: containingShot.endTime,
        },
      ],
      log: {
        message: "Splitting shot boundary at playhead",
        data: {
          shotId: containingShot.id,
          originalStart: containingShot.startTime,
          originalEnd: containingShot.endTime,
          splitTime: currentTime,
        },
      },
    };
  }

  const nextShot = sortedBoundaries.find(
    (shot) => shot.startTime > currentTime
  );
  const endTime =
    nextShot?.startTime ?? params.videoDuration ?? currentTime + 20;

  const previousShot = [...sortedBoundaries]
    .reverse()
    .find((shot) => shot.startTime < currentTime);

  if (
    previousShot &&
    previousShot.endTime !== null &&
    previousShot.endTime !== undefined &&
    previousShot.endTime < currentTime
  ) {
    return {
      status: "success",
      outcome: "fill-gap",
      actions: [
        {
          type: "create",
          startTime: previousShot.endTime,
          endTime: currentTime,
        },
        {
          type: "create",
          startTime: currentTime,
          endTime,
        },
      ],
      log: {
        message: "Creating shot boundaries to fill gap",
        data: {
          gapStart: previousShot.endTime,
          splitPoint: currentTime,
          gapEnd: endTime,
        },
      },
    };
  }

  if (!previousShot) {
    return {
      status: "success",
      outcome: "create-from-start",
      actions: [
        {
          type: "create",
          startTime: 0,
          endTime: currentTime,
        },
        {
          type: "create",
          startTime: currentTime,
          endTime,
        },
      ],
      log: {
        message: "Creating shot boundaries from start",
        data: {
          firstShotEnd: currentTime,
          secondShotEnd: endTime,
        },
      },
    };
  }

  return {
    status: "success",
    outcome: sortedBoundaries.length === 0 ? "create-in-empty" : "extend-previous",
    actions: [
      {
        type: "create",
        startTime: currentTime,
        endTime,
      },
    ],
  };
}

export function planRemoveShotBoundaryMarker(params: {
  shotBoundaries: ShotBoundary[];
  currentTime: number;
  videoDuration: number | null | undefined;
  toleranceSeconds?: number;
}): PlanSuccess<RemoveShotBoundaryOutcome> | PlanError {
  const sortedBoundaries = [...params.shotBoundaries].sort(
    (a, b) => a.startTime - b.startTime
  );
  const tolerance = params.toleranceSeconds ?? 0.5;

  if (sortedBoundaries.length === 0) {
    return {
      status: "error",
      message: "No shot boundaries found",
    };
  }

  const currentShotBoundary = sortedBoundaries.find(
    (shot) => Math.abs(shot.startTime - params.currentTime) <= tolerance
  );

  if (!currentShotBoundary) {
    return {
      status: "error",
      message: "No shot boundary marker found at current playhead position",
    };
  }

  const previousShotBoundary = [...sortedBoundaries]
    .reverse()
    .find((shot) => shot.startTime < currentShotBoundary.startTime);

  const nextShotBoundary = sortedBoundaries.find(
    (shot) => shot.startTime > currentShotBoundary.startTime
  );

  if (!previousShotBoundary) {
    if (!nextShotBoundary) {
      return {
        status: "error",
        message: "Cannot remove the only shot boundary",
      };
    }

    return {
      status: "success",
      outcome: "remove-first",
      actions: [
        {
          type: "update",
          boundaryId: nextShotBoundary.id,
          startTime: 0,
          endTime: nextShotBoundary.endTime ?? null,
        },
        {
          type: "delete",
          boundaryId: currentShotBoundary.id,
        },
      ],
      log: {
        message: "Removing first shot boundary",
        data: {
          currentShotId: currentShotBoundary.id,
          nextShotId: nextShotBoundary.id,
          nextShotOldStart: nextShotBoundary.startTime,
        },
      },
    };
  }

  const newEndTime =
    currentShotBoundary.endTime ??
    params.videoDuration ??
    params.currentTime + 20;

  return {
    status: "success",
    outcome: "merge-with-previous",
    actions: [
      {
        type: "update",
        boundaryId: previousShotBoundary.id,
        startTime: previousShotBoundary.startTime,
        endTime: newEndTime,
      },
      {
        type: "delete",
        boundaryId: currentShotBoundary.id,
      },
    ],
    log: {
      message: "Removing shot boundary marker",
      data: {
        currentShotId: currentShotBoundary.id,
        currentShotStart: currentShotBoundary.startTime,
        previousShotId: previousShotBoundary.id,
        previousShotStart: previousShotBoundary.startTime,
        previousShotOldEnd: previousShotBoundary.endTime,
        newEndTime,
      },
    },
  };
}
