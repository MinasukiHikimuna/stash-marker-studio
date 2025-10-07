/**
 * Gender hint for slot definitions
 */
export type GenderHint = 'MALE' | 'FEMALE' | 'TRANSGENDER_MALE' | 'TRANSGENDER_FEMALE';

/**
 * Slot definition defines a role/position for a marker tag
 * Example: BJ tag might have "giver" and "receiver" slots
 */
export interface SlotDefinition {
  id: string;
  stashappTagId: number;
  slotLabel: string | null;
  genderHint: GenderHint | null;
  displayOrder: number;
  createdAt: string;
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
