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

  // Check if all slots are unlabeled
  const allSlotsUnlabeled = slots.every((slot) => !slot.slotLabel);

  // Check if there's a mix of labeled and unlabeled slots
  const hasLabeled = slots.some((slot) => slot.slotLabel);
  const hasUnlabeled = slots.some((slot) => !slot.slotLabel);
  const hasMixedLabels = hasLabeled && hasUnlabeled;

  // If there's a mix of labeled and unlabeled, don't auto-assign
  if (hasMixedLabels) {
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

  // Special case: All slots unlabeled, no gender hints, and exact match with performers
  // Use alphabetical fallback
  const allSlotsHaveNoGenderHints = slots.every((slot) => slot.genderHints.length === 0);
  if (allSlotsUnlabeled && allSlotsHaveNoGenderHints && slots.length === scenePerformers.length && !allowSamePerformerInMultipleSlots) {
    // Sort performers alphabetically by name
    const sortedPerformers = [...scenePerformers].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Sort slots by ID to ensure consistent ordering
    const sortedSlots = [...slots].sort((a, b) => a.id.localeCompare(b.id));

    // Create single combination with alphabetical assignment
    const assignments: AssignmentOption[] = sortedSlots.map((slot, index) => ({
      slotDefinitionId: slot.id,
      performerId: sortedPerformers[index].id,
    }));

    const description = sortedPerformers.map((p) => p.name).join(", ");

    return [{
      assignments,
      description,
    }];
  }

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

  // Deduplicate based on slot labels:
  // - If all slots are unlabeled, deduplicate by performer set
  // - If there are duplicate slot labels, deduplicate within each label group
  let finalCombinations = combinations;

  // Build a deduplication key based on slot labels and performer groupings
  const seen = new Set<string>();
  finalCombinations = combinations.filter((combo) => {
    let key: string;

    if (allSlotsUnlabeled) {
      // All unlabeled: deduplicate by sorted performer IDs
      key = combo.assignments
        .map((a) => a.performerId)
        .sort()
        .join(',');
    } else {
      // Group assignments by slot label
      const labelGroups = new Map<string, string[]>();

      combo.assignments.forEach((assignment) => {
        const slot = slots.find((s) => s.id === assignment.slotDefinitionId);
        const label = slot?.slotLabel || '';

        if (!labelGroups.has(label)) {
          labelGroups.set(label, []);
        }
        labelGroups.get(label)!.push(assignment.performerId);
      });

      // Create a key where performers are sorted within each label group
      // but label groups maintain their order
      const keyParts: string[] = [];
      slots.forEach((slot) => {
        const label = slot.slotLabel || '';
        const performers = labelGroups.get(label);
        if (performers && performers.length > 0) {
          // Only add once per unique label
          if (!keyParts.includes(`${label}:[${performers.sort().join(',')}]`)) {
            keyParts.push(`${label}:[${performers.sort().join(',')}]`);
          }
          // Remove the performers we've added to avoid duplicates
          labelGroups.delete(label);
        }
      });

      key = keyParts.join('|');
    }

    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  // Sort combinations by number of assignments (more complete first)
  finalCombinations.sort((a, b) => b.assignments.length - a.assignments.length);

  // Limit to top 9 combinations (for number keys 1-9)
  return finalCombinations.slice(0, 9);
}
