import { Marker, MarkerTag } from '@prisma/client';
import { SceneMarker } from './StashappService';

export interface ExportOperation {
  type: 'create' | 'update' | 'delete';
  localMarker?: Marker & { markerTags: MarkerTag[] };
  stashappMarker?: SceneMarker;
}

export interface ExportPreview {
  creates: number;
  updates: number;
  deletes: number;
  operations: ExportOperation[];
}

/**
 * Classifies markers into create, update, and delete operations for export to Stashapp.
 *
 * Logic:
 * - Create: Local markers without stashappMarkerId (new markers)
 * - Update: Local markers with stashappMarkerId that matches a Stashapp marker
 * - Delete: Stashapp markers not present in local database
 */
export function classifyExportOperations(
  localMarkers: (Marker & { markerTags: MarkerTag[] })[],
  stashappMarkers: SceneMarker[]
): ExportPreview {
  const operations: ExportOperation[] = [];

  // Build a map of stashappMarkerId -> localMarker for quick lookup
  const localMarkersByStashappId = new Map<number, Marker & { markerTags: MarkerTag[] }>();
  const localMarkersWithoutStashappId: (Marker & { markerTags: MarkerTag[] })[] = [];

  for (const localMarker of localMarkers) {
    if (localMarker.stashappMarkerId) {
      localMarkersByStashappId.set(localMarker.stashappMarkerId, localMarker);
    } else {
      localMarkersWithoutStashappId.push(localMarker);
    }
  }

  // Build set of stashapp marker IDs that exist in local database
  const localStashappMarkerIds = new Set(localMarkersByStashappId.keys());

  // Identify creates (local markers without stashappMarkerId)
  for (const localMarker of localMarkersWithoutStashappId) {
    operations.push({
      type: 'create',
      localMarker,
    });
  }

  // Identify updates and deletes
  for (const stashappMarker of stashappMarkers) {
    const stashappMarkerId = parseInt(stashappMarker.id);

    if (localStashappMarkerIds.has(stashappMarkerId)) {
      // This marker exists in both places - update it
      const localMarker = localMarkersByStashappId.get(stashappMarkerId)!;
      operations.push({
        type: 'update',
        localMarker,
        stashappMarker,
      });
    } else {
      // This Stashapp marker is not in our database - delete it
      operations.push({
        type: 'delete',
        stashappMarker,
      });
    }
  }

  // Calculate counts
  const creates = operations.filter(op => op.type === 'create').length;
  const updates = operations.filter(op => op.type === 'update').length;
  const deletes = operations.filter(op => op.type === 'delete').length;

  return {
    creates,
    updates,
    deletes,
    operations,
  };
}

/**
 * Extracts tag IDs from a marker's tags, with primary tag first.
 * Ensures primary tag is included even if not present in markerTags.
 */
export function extractTagIds(
  markerTags: MarkerTag[],
  fallbackPrimaryTagId?: number | null
): string[] {
  // Sort to ensure primary tag is first
  const sorted = [...markerTags].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return 0;
  });

  const tagIds = sorted.map(mt => mt.tagId.toString());

  // If no primary tag in markerTags but fallback exists, add it first
  if (!markerTags.some(mt => mt.isPrimary) && fallbackPrimaryTagId) {
    const fallbackId = fallbackPrimaryTagId.toString();
    // Only add if not already in the list
    if (!tagIds.includes(fallbackId)) {
      tagIds.unshift(fallbackId);
    }
  }

  return tagIds;
}

/**
 * Finds the primary tag ID from a marker's tags, falling back to marker.primaryTagId if needed.
 */
export function getPrimaryTagId(
  markerTags: MarkerTag[],
  fallbackPrimaryTagId?: number | null
): string | null {
  const primaryTag = markerTags.find(mt => mt.isPrimary);
  if (primaryTag) {
    return primaryTag.tagId.toString();
  }

  // Fallback to the marker's primaryTagId field if no primary tag found in markerTags
  if (fallbackPrimaryTagId) {
    return fallbackPrimaryTagId.toString();
  }

  return null;
}
