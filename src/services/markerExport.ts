import { Marker, MarkerAdditionalTag } from '@prisma/client';
import { SceneMarker } from './StashappService';

export interface ExportOperation {
  type: 'create' | 'update' | 'delete';
  localMarker?: Marker & { additionalTags: MarkerAdditionalTag[] };
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
  localMarkers: (Marker & { additionalTags: MarkerAdditionalTag[] })[],
  stashappMarkers: SceneMarker[]
): ExportPreview {
  const operations: ExportOperation[] = [];

  // Build a map of stashappMarkerId -> localMarker for quick lookup
  const localMarkersByStashappId = new Map<number, Marker & { additionalTags: MarkerAdditionalTag[] }>();
  const localMarkersWithoutStashappId: (Marker & { additionalTags: MarkerAdditionalTag[] })[] = [];

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
 * Extracts tag IDs from a marker, with primary tag first, followed by additional tags.
 */
export function extractTagIds(
  additionalTags: MarkerAdditionalTag[],
  primaryTagId?: number | null
): string[] {
  const tagIds: string[] = [];

  // Primary tag always comes first
  if (primaryTagId) {
    tagIds.push(primaryTagId.toString());
  }

  // Add additional tags
  for (const tag of additionalTags) {
    tagIds.push(tag.tagId.toString());
  }

  return tagIds;
}

/**
 * Gets the primary tag ID from marker.primaryTagId field.
 */
export function getPrimaryTagId(
  additionalTags: MarkerAdditionalTag[],
  primaryTagId?: number | null
): string | null {
  // Primary tag is now stored directly in marker.primaryTagId
  if (primaryTagId) {
    return primaryTagId.toString();
  }

  return null;
}
