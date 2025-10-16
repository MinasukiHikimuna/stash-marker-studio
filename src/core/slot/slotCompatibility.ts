import type { SlotDefinitionSet } from './types';

/**
 * Slot mapping result type
 */
export type SlotMappingResult = Array<{
  slotDefinitionId: string;
  performerId: string | null;
}> | null;

/**
 * Source slot information needed for mapping
 */
export type SourceSlot = {
  slotDefinitionId: string;
  slotLabel: string | null;
  stashappPerformerId: number | null;
  order: number;
};

/**
 * Maps performer assignments from source slots to target tag's slot definitions
 * when slot structures are compatible (same count and matching labels).
 *
 * @param sourceSlots - Array of slots from the source marker with labels and order
 * @param targetTagId - Stashapp tag ID for the target marker's primary tag
 * @returns Mapped slots if compatible, null if incompatible
 *
 * @example
 * // Source marker has BJ tag with slots: [{ label: "giver", performer: 123 }, { label: "receiver", performer: 456 }]
 * // Target marker has Handjob tag with slots: [{ label: "giver", ... }, { label: "receiver", ... }]
 * // Result: Performers are mapped to the new slot definition IDs with matching labels
 *
 * @example
 * // Source marker has BJ tag with slots: [{ label: "giver", ... }, { label: "receiver", ... }]
 * // Target marker has Solo tag with slots: [{ label: "performer", ... }]
 * // Result: null (incompatible - different slot count and labels)
 */
export async function mapCompatibleSlots(
  sourceSlots: SourceSlot[],
  targetTagId: string
): Promise<SlotMappingResult> {
  console.log('[mapCompatibleSlots] Called with:', {
    sourceSlotCount: sourceSlots?.length || 0,
    sourceSlots: sourceSlots?.map(s => ({ label: s.slotLabel, order: s.order })),
    targetTagId
  });

  if (!sourceSlots || sourceSlots.length === 0) {
    console.log('[mapCompatibleSlots] No source slots, returning null');
    return null;
  }

  try {
    // Fetch target tag's slot definition set
    const response = await fetch(`/api/slot-definition-sets?tagId=${targetTagId}`);

    if (!response.ok) {
      console.warn(`[mapCompatibleSlots] Failed to fetch slot definition set for tag ${targetTagId}`);
      return null;
    }

    const data = await response.json();
    const targetSlotSet: SlotDefinitionSet | null = data.slotDefinitionSet;
    console.log('[mapCompatibleSlots] Target slot set:', {
      hasSet: !!targetSlotSet,
      slotCount: targetSlotSet?.slotDefinitions?.length || 0,
      slots: targetSlotSet?.slotDefinitions?.map(s => ({ label: s.slotLabel, order: s.order }))
    });

    // If target tag has no slot definitions, slots are incompatible
    if (!targetSlotSet || !targetSlotSet.slotDefinitions || targetSlotSet.slotDefinitions.length === 0) {
      console.log('[mapCompatibleSlots] Target tag has no slot definitions - clearing slots');
      return null;
    }

    const targetSlots = targetSlotSet.slotDefinitions;

    // Check if slot counts match
    if (sourceSlots.length !== targetSlots.length) {
      console.log(`[mapCompatibleSlots] Slot count mismatch: source has ${sourceSlots.length}, target has ${targetSlots.length} - clearing slots`);
      return null;
    }

    // Sort both arrays by order to ensure correct mapping
    const sortedSourceSlots = [...sourceSlots].sort((a, b) => a.order - b.order);
    const sortedTargetSlots = [...targetSlots].sort((a, b) => a.order - b.order);

    // Check if all slot labels match in order
    for (let i = 0; i < sortedSourceSlots.length; i++) {
      const sourceLabel = sortedSourceSlots[i].slotLabel;
      const targetLabel = sortedTargetSlots[i].slotLabel;

      // Both must have labels and they must match
      if (!sourceLabel || !targetLabel || sourceLabel !== targetLabel) {
        console.log(`[mapCompatibleSlots] Slot label mismatch at position ${i}: source="${sourceLabel}", target="${targetLabel}" - clearing slots`);
        return null;
      }
    }

    // Slots are compatible - map performers to new slot definition IDs
    console.log(`[mapCompatibleSlots] Slots are compatible (${sourceSlots.length} matching labels) - remapping performers`);

    const mappedSlots = sortedSourceSlots.map((sourceSlot, index) => ({
      slotDefinitionId: sortedTargetSlots[index].id,
      performerId: sourceSlot.stashappPerformerId !== null
        ? sourceSlot.stashappPerformerId.toString()
        : null,
    }));

    console.log('[mapCompatibleSlots] Returning mapped slots:', mappedSlots);
    return mappedSlots;
  } catch (error) {
    console.error('[mapCompatibleSlots] Error mapping compatible slots:', error);
    return null; // On error, clear slots to be safe
  }
}
