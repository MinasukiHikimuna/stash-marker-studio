import { PrismaClient } from '@prisma/client';

/**
 * Validation result for slot definition validation
 */
export type SlotValidationResult = {
  valid: true;
} | {
  valid: false;
  error: string;
  details?: {
    slotDefinitionId: string;
    expectedTagId: number;
    actualTagId: number | null;
  }[];
};

/**
 * Validates that all provided slot definition IDs belong to the specified tag's
 * slot definition set.
 *
 * This enforces referential integrity between markers and their slot assignments:
 * marker.primaryTagId → slot_definition_sets.stashappTagId → slot_definitions.slotDefinitionSetId
 *
 * @param slotDefinitionIds - Array of slot definition IDs to validate
 * @param tagId - The Stashapp tag ID that the slot definitions must belong to
 * @param prisma - Prisma client instance
 * @returns Validation result indicating success or failure with details
 *
 * @example
 * const result = await validateSlotDefinitionsBelongToTag(
 *   ['uuid-1', 'uuid-2'],
 *   5318, // Blowjob tag
 *   prisma
 * );
 * if (!result.valid) {
 *   return NextResponse.json({ error: result.error, details: result.details }, { status: 400 });
 * }
 */
export async function validateSlotDefinitionsBelongToTag(
  slotDefinitionIds: string[],
  tagId: number,
  prisma: PrismaClient
): Promise<SlotValidationResult> {
  // If no slot definitions provided, validation passes
  if (!slotDefinitionIds || slotDefinitionIds.length === 0) {
    return { valid: true };
  }

  // Fetch slot definitions with their sets
  const slotDefinitions = await prisma.slotDefinition.findMany({
    where: { id: { in: slotDefinitionIds } },
    include: { slotDefinitionSet: true },
  });

  // Verify all slot definitions exist
  if (slotDefinitions.length !== slotDefinitionIds.length) {
    const foundIds = slotDefinitions.map(sd => sd.id);
    const missingIds = slotDefinitionIds.filter(id => !foundIds.includes(id));
    return {
      valid: false,
      error: `Slot definitions not found: ${missingIds.join(', ')}`,
    };
  }

  // Verify all belong to the specified tag's slot definition set
  const invalidSlots = slotDefinitions.filter(
    sd => sd.slotDefinitionSet.stashappTagId !== tagId
  );

  if (invalidSlots.length > 0) {
    return {
      valid: false,
      error: `Invalid slot definitions: ${invalidSlots.length} slot(s) do not belong to tag ${tagId}'s slot definition set`,
      details: invalidSlots.map(sd => ({
        slotDefinitionId: sd.id,
        expectedTagId: tagId,
        actualTagId: sd.slotDefinitionSet.stashappTagId,
      })),
    };
  }

  // All validations passed
  return { valid: true };
}
