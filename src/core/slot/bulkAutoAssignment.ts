import type { SlotDefinition, GenderHint } from "./types";
import type { Performer, SceneMarker } from "@/services/StashappService";

export interface MarkerAutoAssignment {
  markerId: string;
  markerTag: string;
  markerTime: string;
  assignments: {
    slotDefinitionId: string;
    slotLabel: string | null;
    performerId: string;
    performerName: string;
  }[];
}

export interface BulkAutoAssignmentResult {
  assignableMarkers: MarkerAutoAssignment[];
  skippedMarkers: {
    markerId: string;
    markerTag: string;
    markerTime: string;
    reason: string;
  }[];
}

/**
 * Find all markers that have exactly one valid performer assignment combination
 * and can be auto-assigned without ambiguity.
 */
export async function findAutoAssignableMarkers(
  markers: SceneMarker[],
  scenePerformers: Performer[]
): Promise<BulkAutoAssignmentResult> {
  const assignableMarkers: MarkerAutoAssignment[] = [];
  const skippedMarkers: BulkAutoAssignmentResult["skippedMarkers"] = [];

  for (const marker of markers) {
    const markerId = marker.id;
    const markerTag = marker.primary_tag.name;
    const markerTime = `${marker.seconds.toFixed(1)}s`;

    // Check if marker already has slots assigned
    if (marker.slots && marker.slots.length > 0) {
      const hasAssignedPerformers = marker.slots.some(
        (slot) => slot.stashappPerformerId !== null
      );
      if (hasAssignedPerformers) {
        skippedMarkers.push({
          markerId,
          markerTag,
          markerTime,
          reason: "Already has performer assignments",
        });
        continue;
      }
    }

    // Fetch slot definitions for this marker's tag
    try {
      const response = await fetch(
        `/api/slot-definition-sets?tagId=${marker.primary_tag.id}`
      );
      if (!response.ok) {
        skippedMarkers.push({
          markerId,
          markerTag,
          markerTime,
          reason: "Failed to load slot definitions",
        });
        continue;
      }

      const data = await response.json();
      type ApiSlotDefinitionSet = {
        id: string;
        stashappTagId: number;
        allowSamePerformerInMultipleSlots: boolean;
        createdAt: string;
        updatedAt: string;
        slotDefinitions: {
          id: string;
          slotDefinitionSetId: string;
          slotLabel: string | null;
          order: number;
          createdAt: string;
          updatedAt: string;
          genderHints: {
            id: string;
            slotDefinitionId: string;
            genderHint: GenderHint;
            createdAt: string;
            updatedAt: string;
          }[];
        }[];
      };

      const sets = (data.slotDefinitionSets as ApiSlotDefinitionSet[]) || [];

      if (sets.length === 0) {
        skippedMarkers.push({
          markerId,
          markerTag,
          markerTime,
          reason: "No slot definitions configured",
        });
        continue;
      }

      const slotDefinitions: SlotDefinition[] = sets[0].slotDefinitions.map(
        (slot) => ({
          id: slot.id,
          slotDefinitionSetId: slot.slotDefinitionSetId,
          slotLabel: slot.slotLabel,
          genderHints: slot.genderHints.map((gh) => gh.genderHint),
          order: slot.order,
          createdAt: slot.createdAt,
          updatedAt: slot.updatedAt,
        })
      );

      const allowSamePerformerInMultipleSlots =
        sets[0].allowSamePerformerInMultipleSlots;

      // Check if there's a mix of labeled and unlabeled slots
      const hasLabeled = slotDefinitions.some((slot) => slot.slotLabel);
      const hasUnlabeled = slotDefinitions.some((slot) => !slot.slotLabel);
      const hasMixedLabels = hasLabeled && hasUnlabeled;

      // If there's a mix of labeled and unlabeled, skip auto-assign
      if (hasMixedLabels) {
        skippedMarkers.push({
          markerId,
          markerTag,
          markerTime,
          reason: "Mix of labeled and unlabeled slots",
        });
        continue;
      }

      // Build slot -> matching performers map
      const slotToPerformers = new Map<string, Performer[]>();
      for (const slot of slotDefinitions) {
        if (slot.genderHints.length > 0) {
          const matching = scenePerformers.filter((p) =>
            slot.genderHints.includes(p.gender as GenderHint)
          );
          slotToPerformers.set(slot.id, matching);
        } else {
          slotToPerformers.set(slot.id, scenePerformers);
        }
      }

      // Check if there's exactly one valid combination
      const validCombinations = generateValidCombinations(
        slotDefinitions,
        slotToPerformers,
        allowSamePerformerInMultipleSlots,
        scenePerformers
      );

      if (validCombinations.length === 0) {
        skippedMarkers.push({
          markerId,
          markerTag,
          markerTime,
          reason: "No valid performer combinations",
        });
      } else if (validCombinations.length === 1) {
        // Exactly one valid combination - can auto-assign!
        const combination = validCombinations[0];
        assignableMarkers.push({
          markerId,
          markerTag,
          markerTime,
          assignments: combination.map((assignment) => {
            const slot = slotDefinitions.find(
              (s) => s.id === assignment.slotDefinitionId
            );
            const performer = scenePerformers.find(
              (p) => p.id === assignment.performerId
            );
            return {
              slotDefinitionId: assignment.slotDefinitionId,
              slotLabel: slot?.slotLabel || null,
              performerId: assignment.performerId,
              performerName: performer?.name || "Unknown",
            };
          }),
        });
      } else {
        skippedMarkers.push({
          markerId,
          markerTag,
          markerTime,
          reason: `Multiple valid combinations (${validCombinations.length})`,
        });
      }
    } catch (error) {
      console.error(
        `Error processing marker ${markerId}:`,
        error
      );
      skippedMarkers.push({
        markerId,
        markerTag,
        markerTime,
        reason: "Error processing marker",
      });
    }
  }

  return { assignableMarkers, skippedMarkers };
}

/**
 * Generate all valid performer assignment combinations for slot definitions
 */
function generateValidCombinations(
  slotDefinitions: SlotDefinition[],
  slotToPerformers: Map<string, Performer[]>,
  allowSamePerformerInMultipleSlots: boolean,
  scenePerformers: Performer[]
): Array<{ slotDefinitionId: string; performerId: string }[]> {
  // Check if all slots are unlabeled
  const allSlotsUnlabeled = slotDefinitions.every((slot) => !slot.slotLabel);

  // Special case: All slots unlabeled, no gender hints, and exact match with performers
  // Use alphabetical fallback
  const allSlotsHaveNoGenderHints = slotDefinitions.every((slot) => slot.genderHints.length === 0);
  if (allSlotsUnlabeled && allSlotsHaveNoGenderHints && slotDefinitions.length === scenePerformers.length && !allowSamePerformerInMultipleSlots) {
    // Sort performers alphabetically by name
    const sortedPerformers = [...scenePerformers].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Sort slots by ID to ensure consistent ordering
    const sortedSlots = [...slotDefinitions].sort((a, b) => a.id.localeCompare(b.id));

    // Create single combination with alphabetical assignment
    return [sortedSlots.map((slot, index) => ({
      slotDefinitionId: slot.id,
      performerId: sortedPerformers[index].id,
    }))];
  }

  const combinations: Array<
    { slotDefinitionId: string; performerId: string }[]
  > = [];

  function generate(
    slotIndex: number,
    currentAssignment: { slotDefinitionId: string; performerId: string }[],
    usedPerformerIds: Set<string>
  ) {
    if (slotIndex === slotDefinitions.length) {
      // All slots assigned
      if (currentAssignment.length === slotDefinitions.length) {
        combinations.push([...currentAssignment]);
      }
      return;
    }

    const currentSlot = slotDefinitions[slotIndex];
    const matchingPerformers = slotToPerformers.get(currentSlot.id) || [];

    for (const performer of matchingPerformers) {
      if (
        allowSamePerformerInMultipleSlots ||
        !usedPerformerIds.has(performer.id)
      ) {
        const newUsedPerformers = new Set(usedPerformerIds);
        if (!allowSamePerformerInMultipleSlots) {
          newUsedPerformers.add(performer.id);
        }

        generate(
          slotIndex + 1,
          [
            ...currentAssignment,
            {
              slotDefinitionId: currentSlot.id,
              performerId: performer.id,
            },
          ],
          newUsedPerformers
        );
      }
    }
  }

  generate(0, [], new Set());
  return combinations;
}
