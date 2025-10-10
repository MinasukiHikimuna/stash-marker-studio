import { DerivedMarkerConfig } from '@/serverConfig';
import { SceneMarker } from '@/services/StashappService';

export interface DerivedMarker {
  derivedTagId: string;
  tags: string[];
  slots: Array<{ label: string; performerId: string }>;
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

      // Map slots from source to derived based on slotMapping
      if (config.slotMapping && marker.slots) {
        for (const slot of marker.slots) {
          const slotLabel = slot.slotLabel;
          if (slotLabel && config.slotMapping[slotLabel]) {
            const derivedSlotLabel = config.slotMapping[slotLabel];
            derivedMarker.slots.push({
              label: derivedSlotLabel,
              performerId: slot.stashappPerformerId?.toString() || '',
            });
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
        const tempMarker: SceneMarker = {
          ...currentMarker,
          primary_tag: {
            id: derived.derivedTagId,
            name: '',
          },
        };

        traverse(tempMarker, currentDepth + 1, currentSourceMarkerId);
      }
    }
  }

  traverse(marker, 0, undefined);
  return allDerived;
}
