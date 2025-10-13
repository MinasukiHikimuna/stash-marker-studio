import { DerivedMarkerConfig } from '@/serverConfig';
import { SceneMarker } from '@/services/StashappService';

export interface DerivedMarker {
  derivedTagId: string;
  tags: string[];
  slots: Array<{ slotDefinitionId: string; performerId: string }>;
  depth: number;
  ruleId: string;
  sourceMarkerId?: number; // Ultimate source (root of chain)
  immediateParentMarkerId?: number; // Direct parent that created this marker
}

/**
 * Computes direct derived markers (depth 0) for a given source marker
 */
export function computeDerivedMarkers(
  marker: SceneMarker,
  derivedMarkerConfigs: DerivedMarkerConfig[],
  depth: number = 0,
  sourceMarkerId?: number
): DerivedMarker[] {
  const derivedMarkers: DerivedMarker[] = [];

  // Get the source tag ID
  const sourceTagId = marker.primary_tag.id;

  // Find all derivation rules that apply to this source tag
  const applicableConfigs = derivedMarkerConfigs.filter(
    config => config.sourceTagId === sourceTagId
  );

  for (const config of applicableConfigs) {
    if (config.relationshipType === 'implies') {
      const ruleId = `${config.sourceTagId}->${config.derivedTagId}`;

      // Create a derived marker
      const derivedMarker: DerivedMarker = {
        derivedTagId: config.derivedTagId,
        tags: [config.derivedTagId], // The derived tag becomes the primary tag
        slots: [],
        depth,
        ruleId,
        sourceMarkerId,
      };

      if (config.slotMapping && marker.slots) {
        for (const slot of marker.slots) {
          const sourceSlotDefId = slot.slotDefinitionId;
          if (sourceSlotDefId) {
            // Find all mappings for this source slot (allows one source slot to map to multiple derived slots)
            const mappings = config.slotMapping.filter(m => m.sourceSlotId === sourceSlotDefId);
            for (const mapping of mappings) {
              derivedMarker.slots.push({
                slotDefinitionId: mapping.derivedSlotId,
                performerId: slot.stashappPerformerId?.toString() || '',
              });
            }
          }
        }
      }

      derivedMarkers.push(derivedMarker);
    }
  }

  return derivedMarkers;
}

/**
 * Computes all derived markers using multi-level chaining with depth tracking.
 * Processes derivations in multiple passes, detecting when a derivedTagId matches another rule's sourceTagId.
 *
 * Tracks both immediate parent (who directly created this) and ultimate source (root of chain).
 */
export function computeAllDerivedMarkers(
  marker: SceneMarker,
  derivedMarkerConfigs: DerivedMarkerConfig[],
  maxDepth: number = 3
): DerivedMarker[] {
  const allDerived: DerivedMarker[] = [];
  const visited = new Set<string>();

  function traverse(
    currentMarker: SceneMarker,
    currentDepth: number,
    ultimateSourceMarkerId?: number,
    immediateParentMarkerId?: number
  ) {
    if (currentDepth > maxDepth) {
      return;
    }

    const directDerived = computeDerivedMarkers(
      currentMarker,
      derivedMarkerConfigs,
      currentDepth,
      ultimateSourceMarkerId
    );

    for (const derived of directDerived) {
      if (!visited.has(derived.derivedTagId)) {
        visited.add(derived.derivedTagId);

        // Set immediate parent for this derived marker
        // At depth 0, parent is undefined (this is the direct derivation from source)
        // At depth > 0, parent is the marker ID of the previous level
        derived.immediateParentMarkerId = immediateParentMarkerId;

        allDerived.push(derived);

        // Create a temporary marker to continue traversal
        // IMPORTANT: Include slots from the derived marker so they propagate through the chain
        const tempMarker: SceneMarker = {
          ...currentMarker,
          primary_tag: {
            id: derived.derivedTagId,
            name: '',
          },
          slots: derived.slots.length > 0 ? derived.slots.map(slot => ({
            id: '', // Temporary marker doesn't need real IDs
            slotDefinitionId: slot.slotDefinitionId,
            stashappPerformerId: slot.performerId ? parseInt(slot.performerId) : null,
            slotLabel: null,
            genderHints: [],
            order: 0,
          })) : undefined,
        };

        // For next level:
        // - ultimateSourceMarkerId stays the same (always points to root)
        // - immediateParentMarkerId becomes the current marker's ID (will be set after materialization)
        // Note: We don't know the actual marker ID yet (it's created during materialization),
        // so we pass undefined and let the materialization API handle tracking the parent
        traverse(tempMarker, currentDepth + 1, ultimateSourceMarkerId, undefined);
      }
    }
  }

  traverse(marker, 0, undefined, undefined);
  return allDerived;
}
