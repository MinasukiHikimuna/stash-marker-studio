import type { SlotDefinition as PrismaSlotDefinition, SlotDefinitionGenderHint } from '@prisma/client';
import type { SlotDefinition, GenderHint } from '@/core/slot/types';

type PrismaSlotWithRelations = PrismaSlotDefinition & {
  genderHints: SlotDefinitionGenderHint[];
};

/**
 * Transform Prisma SlotDefinition with genderHints relation to our domain SlotDefinition type
 */
export function transformSlotDefinition(prismaSlot: PrismaSlotWithRelations): SlotDefinition {
  return {
    id: prismaSlot.id,
    slotDefinitionSetId: prismaSlot.slotDefinitionSetId,
    slotLabel: prismaSlot.slotLabel,
    genderHints: prismaSlot.genderHints.map(gh => gh.genderHint as GenderHint),
    order: prismaSlot.order,
    createdAt: prismaSlot.createdAt.toISOString(),
    updatedAt: prismaSlot.updatedAt.toISOString(),
  };
}
