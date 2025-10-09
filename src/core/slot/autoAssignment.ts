import type { SlotDefinition, GenderHint } from "./types";
import type { Performer } from "@/services/StashappService";

export interface AssignmentOption {
  slotDefinitionId: string;
  performerId: string;
}

export interface AssignmentCombination {
  assignments: AssignmentOption[];
  description: string;
}

/**
 * Generates all valid performer assignment combinations for a set of slot definitions.
 * Uses gender hints when available, otherwise allows any performer.
 *
 * @param slotDefinitions - The slot definitions to assign performers to
 * @param scenePerformers - Available performers in the scene
 * @param currentAssignments - Currently assigned performer IDs by slot definition ID
 * @param allowSamePerformerInMultipleSlots - Whether to allow the same performer to be assigned to multiple slots (default: false)
 * @returns Array of valid assignment combinations
 */
export function generateAssignmentCombinations(
  slotDefinitions: SlotDefinition[],
  scenePerformers: Performer[],
  currentAssignments: Map<string, string | null>,
  allowSamePerformerInMultipleSlots = false
): AssignmentCombination[] {
  // Use all slot definitions (with or without gender hints)
  const slots = slotDefinitions;

  if (slots.length === 0 || scenePerformers.length === 0) {
    return [];
  }

  // Build a map of slot -> matching performers
  const slotToPerformers = new Map<string, Performer[]>();
  slots.forEach((slot) => {
    if (slot.genderHints.length > 0) {
      // If gender hints exist, filter by matching genders
      const matching = scenePerformers.filter(
        (p) => slot.genderHints.includes(p.gender as GenderHint)
      );
      slotToPerformers.set(slot.id, matching);
    } else {
      // No gender hints - all performers are valid
      slotToPerformers.set(slot.id, scenePerformers);
    }
  });

  // Generate all valid combinations
  const combinations: AssignmentCombination[] = [];

  function generateCombinations(
    slotIndex: number,
    currentAssignment: AssignmentOption[],
    usedPerformerIds: Set<string>
  ) {
    // Base case: all slots processed
    if (slotIndex === slots.length) {
      // Only add combinations where ALL slots are assigned
      if (currentAssignment.length === slots.length) {
        const description = currentAssignment
          .map((a) => {
            const slot = slots.find((s) => s.id === a.slotDefinitionId);
            const performer = scenePerformers.find((p) => p.id === a.performerId);
            // Only include slot label if it exists
            if (slot?.slotLabel) {
              return `${slot.slotLabel}: ${performer?.name}`;
            }
            return performer?.name || '';
          })
          .filter(Boolean)
          .join(", ");

        combinations.push({
          assignments: [...currentAssignment],
          description,
        });
      }
      return;
    }

    const currentSlot = slots[slotIndex];
    const matchingPerformers = slotToPerformers.get(currentSlot.id) || [];

    // Try assigning each matching performer
    for (const performer of matchingPerformers) {
      // If allowSamePerformerInMultipleSlots is true, skip the uniqueness check
      if (allowSamePerformerInMultipleSlots || !usedPerformerIds.has(performer.id)) {
        const newUsedPerformers = new Set(usedPerformerIds);
        // Only track as used if we're enforcing uniqueness
        if (!allowSamePerformerInMultipleSlots) {
          newUsedPerformers.add(performer.id);
        }

        generateCombinations(
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

  generateCombinations(0, [], new Set());

  // Check if all slots have no labels
  const allSlotsUnlabeled = slots.every((slot) => !slot.slotLabel);

  // If all slots are unlabeled, deduplicate by performer set
  let finalCombinations = combinations;
  if (allSlotsUnlabeled) {
    const seen = new Set<string>();
    finalCombinations = combinations.filter((combo) => {
      // Create a sorted performer ID string as the key
      const performerIds = combo.assignments
        .map((a) => a.performerId)
        .sort()
        .join(',');

      if (seen.has(performerIds)) {
        return false;
      }
      seen.add(performerIds);
      return true;
    });
  }

  // Sort combinations by number of assignments (more complete first)
  finalCombinations.sort((a, b) => b.assignments.length - a.assignments.length);

  // Limit to top 9 combinations (for number keys 1-9)
  return finalCombinations.slice(0, 9);
}
