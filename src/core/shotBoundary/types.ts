/**
 * Shot Boundary Types
 *
 * Shot boundaries are stored in the local PostgreSQL database and are
 * completely separate from Stashapp markers. They represent video cut
 * points detected by PySceneDetect or manually created by the user.
 */

export type ShotBoundary = {
  id: string;           // UUID from database
  stashappSceneId: number;
  startTime: number;    // seconds
  endTime: number | null;      // seconds (null if open-ended)
  createdAt: string;    // ISO date string for Redux serialization
  updatedAt: string;    // ISO date string for Redux serialization
};

export type ShotBoundaryFromAPI = {
  id: string;
  stashappSceneId: number;
  startTime: string | number;  // May come as Decimal from Prisma
  endTime: string | number | null;
  createdAt: string;
  updatedAt: string;
};

export function shotBoundaryFromAPI(data: ShotBoundaryFromAPI): ShotBoundary {
  return {
    id: data.id,
    stashappSceneId: data.stashappSceneId,
    startTime: typeof data.startTime === 'string' ? parseFloat(data.startTime) : data.startTime,
    endTime:
      data.endTime == null
        ? null
        : typeof data.endTime === 'string'
        ? parseFloat(data.endTime)
        : data.endTime,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
