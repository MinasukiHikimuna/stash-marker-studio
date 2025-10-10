import { DerivedMarkerConfig } from '@/serverConfig';
import { SceneMarker } from '@/services/StashappService';

export interface DerivedMarker {
  derivedTagId: string;
  tags: string[];
  slots: Array<{ label: string; performerId: string }>;
}

/**
 * Computes all derived markers for a given source marker based on the ontology configuration
 */
export function computeDerivedMarkers(
  marker: SceneMarker,
  derivedMarkerConfigs: DerivedMarkerConfig[]
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
      // Create a derived marker
      const derivedMarker: DerivedMarker = {
        derivedTagId: config.derivedTagId,
        tags: [config.derivedTagId], // The derived tag becomes the primary tag
        slots: [],
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
 * Recursively traverse the ontology graph upward to find all implied derived markers
 */
export function computeAllDerivedMarkers(
  marker: SceneMarker,
  derivedMarkerConfigs: DerivedMarkerConfig[]
): DerivedMarker[] {
  const allDerived: DerivedMarker[] = [];
  const visited = new Set<string>();

  function traverse(currentMarker: SceneMarker) {
    const directDerived = computeDerivedMarkers(currentMarker, derivedMarkerConfigs);

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

        traverse(tempMarker);
      }
    }
  }

  traverse(marker);
  return allDerived;
}
