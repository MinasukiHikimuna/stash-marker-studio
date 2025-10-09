/**
 * Gender hint for slot definitions
 */
export type GenderHint = 'MALE' | 'FEMALE' | 'TRANSGENDER_MALE' | 'TRANSGENDER_FEMALE';

/**
 * Slot definition set defines the complete slot structure for a marker primary tag
 * Example: "Pussy Rubbing_AI" tag has a set with allowSamePerformerInMultipleSlots=true
 */
export interface SlotDefinitionSet {
  id: string;
  stashappTagId: number;
  allowSamePerformerInMultipleSlots: boolean;
  createdAt: string;
  updatedAt: string;
  slotDefinitions?: SlotDefinition[];
}

/**
 * Slot definition defines a role/position within a slot definition set
 * Example: BJ tag might have "giver" and "receiver" slots
 */
export interface SlotDefinition {
  id: string;
  slotDefinitionSetId: string;
  slotLabel: string | null;
  genderHints: GenderHint[];
  order: number;
  createdAt: string;
  updatedAt: string;
  slotDefinitionSet?: SlotDefinitionSet;
}

/**
 * Marker slot assigns a performer to a specific slot on a marker
 */
export interface MarkerSlot {
  id: string;
  markerId: number;
  slotDefinitionId: string;
  stashappPerformerId: number | null;
  createdAt: string;
  updatedAt: string;
  slotDefinition?: SlotDefinition;
}

/**
 * Extended marker slot with performer details loaded from Stashapp
 */
export interface MarkerSlotWithPerformer extends MarkerSlot {
  performer?: {
    id: string;
    name: string;
    gender?: string;
  };
}
