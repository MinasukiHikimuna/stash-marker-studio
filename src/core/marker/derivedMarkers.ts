import { DerivedMarkerConfig } from '@/serverConfig';
import { SceneMarker } from '@/services/StashappService';

export interface DerivedMarker {
  derivedTagId: string;
  tags: string[];
  slots: Array<{ slotDefinitionId: string; performerId: string }>;
  depth: number;
  ruleId: string;
  sourceMarkerId?: number;
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
 */
export function computeAllDerivedMarkers(
  marker: SceneMarker,
  derivedMarkerConfigs: DerivedMarkerConfig[],
  maxDepth: number = 3
): DerivedMarker[] {
  const allDerived: DerivedMarker[] = [];
  const visited = new Set<string>();

  function traverse(currentMarker: SceneMarker, currentDepth: number, currentSourceMarkerId?: number) {
    if (currentDepth > maxDepth) {
      return;
    }

    const directDerived = computeDerivedMarkers(
      currentMarker,
      derivedMarkerConfigs,
      currentDepth,
      currentSourceMarkerId
    );

    for (const derived of directDerived) {
      if (!visited.has(derived.derivedTagId)) {
        visited.add(derived.derivedTagId);
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

        traverse(tempMarker, currentDepth + 1, currentSourceMarkerId);
      }
    }
  }

  traverse(marker, 0, undefined);
  return allDerived;
}
