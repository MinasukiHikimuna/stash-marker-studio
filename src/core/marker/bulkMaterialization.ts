import type { DerivedMarkerConfig } from '@/serverConfig';
import type { SceneMarker } from '@/services/StashappService';
import { computeAllDerivedMarkers } from './derivedMarkers';

export interface MarkerMaterialization {
  markerId: string;
  markerTag: string;
  markerTime: string;
  newDerivationsCount: number;
  totalDerivationsCount: number;
  derivedTags: string[];
}

export interface AlreadyMaterializedMarker {
  markerId: string;
  markerTag: string;
  markerTime: string;
  existingDerivationsCount: number;
}

export interface BulkMaterializationResult {
  materializableMarkers: MarkerMaterialization[];
  alreadyMaterializedMarkers: AlreadyMaterializedMarker[];
  skippedMarkers: {
    markerId: string;
    markerTag: string;
    markerTime: string;
    reason: string;
  }[];
}

/**
 * Analyzes all markers to determine which can be materialized, which are already
 * materialized, and which should be skipped.
 *
 * @param markers - All markers in the scene
 * @param derivedMarkerConfigs - Derivation rules from config
 * @param maxDerivationDepth - Maximum depth for chained derivations
 * @param existingDerivationsByMarker - Map of marker IDs to their existing derivation ruleIds
 * @param tagNameMap - Map of tag IDs to tag names for preview display
 */
export function analyzeMaterializableMarkers(
  markers: SceneMarker[],
  derivedMarkerConfigs: DerivedMarkerConfig[],
  maxDerivationDepth: number,
  existingDerivationsByMarker: Map<string, Set<string>>,
  tagNameMap: Map<string, string>
): BulkMaterializationResult {
  const materializableMarkers: MarkerMaterialization[] = [];
  const alreadyMaterializedMarkers: AlreadyMaterializedMarker[] = [];
  const skippedMarkers: BulkMaterializationResult['skippedMarkers'] = [];

  for (const marker of markers) {
    const markerId = marker.id;
    const markerTag = marker.primary_tag.name;
    const markerTime = `${marker.seconds.toFixed(1)}s`;

    // Compute all potential derived markers for this source marker
    const derivedMarkers = computeAllDerivedMarkers(
      marker,
      derivedMarkerConfigs,
      maxDerivationDepth
    );

    if (derivedMarkers.length === 0) {
      // No derivation rules configured for this marker's tag
      skippedMarkers.push({
        markerId,
        markerTag,
        markerTime,
        reason: 'No derivation rules configured',
      });
      continue;
    }

    // Get existing derivations for this marker
    const existingRuleIds = existingDerivationsByMarker.get(markerId) || new Set<string>();

    // Count how many derivations are new vs existing
    const newDerivations = derivedMarkers.filter(
      dm => !existingRuleIds.has(dm.ruleId)
    );

    if (newDerivations.length === 0) {
      // All derivations already exist
      alreadyMaterializedMarkers.push({
        markerId,
        markerTag,
        markerTime,
        existingDerivationsCount: derivedMarkers.length,
      });
    } else {
      // At least some derivations are new
      const derivedTags = newDerivations
        .map(dm => tagNameMap.get(dm.derivedTagId) || `Tag ${dm.derivedTagId}`)
        .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates

      materializableMarkers.push({
        markerId,
        markerTag,
        markerTime,
        newDerivationsCount: newDerivations.length,
        totalDerivationsCount: derivedMarkers.length,
        derivedTags,
      });
    }
  }

  return {
    materializableMarkers,
    alreadyMaterializedMarkers,
    skippedMarkers,
  };
}
