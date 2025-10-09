import { generateAssignmentCombinations } from './autoAssignment';
import type { SlotDefinition, GenderHint } from './types';
import type { Performer } from '@/services/StashappService';

describe('generateAssignmentCombinations', () => {
  const createSlotDefinition = (
    id: string,
    slotLabel: string | null,
    genderHint: GenderHint | null
  ): SlotDefinition => ({
    id,
    stashappTagId: 1,
    slotLabel,
    genderHint,
    displayOrder: 0,
    createdAt: '2025-01-01T00:00:00Z',
  });

  const createPerformer = (
    id: string,
    name: string,
    gender: '' | 'MALE' | 'FEMALE' | 'TRANSGENDER_MALE' | 'TRANSGENDER_FEMALE' | 'INTERSEX' | 'NON_BINARY'
  ): Performer => ({
    id,
    name,
    gender,
  });

  it('should generate combinations when slots have labels and no gender hints', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Slot 1', null),
      createSlotDefinition('slot2', 'Slot 2', null),
    ];
    const performers = [
      createPerformer('p1', 'Performer 1', 'MALE'),
      createPerformer('p2', 'Performer 2', 'FEMALE'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    // Should generate 2 combinations:
    // P1->Slot1, P2->Slot2 and P2->Slot1, P1->Slot2
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      assignments: [
        { slotDefinitionId: 'slot1', performerId: 'p1' },
        { slotDefinitionId: 'slot2', performerId: 'p2' },
      ],
      description: 'Slot 1: Performer 1, Slot 2: Performer 2',
    });
    expect(result).toContainEqual({
      assignments: [
        { slotDefinitionId: 'slot1', performerId: 'p2' },
        { slotDefinitionId: 'slot2', performerId: 'p1' },
      ],
      description: 'Slot 1: Performer 2, Slot 2: Performer 1',
    });
  });

  it('should deduplicate combinations when all slots have no labels', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', null, null),
      createSlotDefinition('slot2', null, null),
    ];
    const performers = [
      createPerformer('p1', 'Performer 1', 'MALE'),
      createPerformer('p2', 'Performer 2', 'FEMALE'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    // Should generate only 1 combination (deduplicated by performer set)
    // since order doesn't matter when there are no labels
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Performer 1, Performer 2');

    // Should contain both performers
    const performerIds = result[0].assignments.map((a) => a.performerId).sort();
    expect(performerIds).toEqual(['p1', 'p2']);
  });

  it('should generate single combination for two slots with matching performers', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Giver', 'FEMALE'),
      createSlotDefinition('slot2', 'Receiver', 'MALE'),
    ];
    const performers = [
      createPerformer('p1', 'Jane Doe', 'FEMALE'),
      createPerformer('p2', 'John Doe', 'MALE'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    expect(result).toHaveLength(1);
    expect(result[0].assignments).toEqual([
      { slotDefinitionId: 'slot1', performerId: 'p1' },
      { slotDefinitionId: 'slot2', performerId: 'p2' },
    ]);
    expect(result[0].description).toBe('Giver: Jane Doe, Receiver: John Doe');
  });

  it('should generate multiple combinations when multiple performers match same gender hint', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Giver', 'FEMALE'),
      createSlotDefinition('slot2', 'Receiver', 'FEMALE'),
    ];
    const performers = [
      createPerformer('p1', 'Jane Doe', 'FEMALE'),
      createPerformer('p2', 'Mary Smith', 'FEMALE'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    expect(result).toHaveLength(2);
    // Should have: Jane->Giver, Mary->Receiver AND Mary->Giver, Jane->Receiver
    expect(result).toContainEqual({
      assignments: [
        { slotDefinitionId: 'slot1', performerId: 'p1' },
        { slotDefinitionId: 'slot2', performerId: 'p2' },
      ],
      description: 'Giver: Jane Doe, Receiver: Mary Smith',
    });
    expect(result).toContainEqual({
      assignments: [
        { slotDefinitionId: 'slot1', performerId: 'p2' },
        { slotDefinitionId: 'slot2', performerId: 'p1' },
      ],
      description: 'Giver: Mary Smith, Receiver: Jane Doe',
    });
  });

  it('should not assign same performer to multiple slots', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Person 1', 'MALE'),
      createSlotDefinition('slot2', 'Person 2', 'MALE'),
    ];
    const performers = [createPerformer('p1', 'John Doe', 'MALE')];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    // Should return empty because we can't fill both slots with one performer
    expect(result).toEqual([]);
  });

  it('should return empty array when no performers match gender hints', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Giver', 'FEMALE'),
      createSlotDefinition('slot2', 'Receiver', 'MALE'),
    ];
    const performers = [createPerformer('p1', 'Person', 'NON_BINARY')];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    expect(result).toEqual([]);
  });

  it('should only return complete combinations (all slots filled)', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Giver', 'FEMALE'),
      createSlotDefinition('slot2', 'Receiver', 'MALE'),
    ];
    const performers = [
      createPerformer('p1', 'Jane Doe', 'FEMALE'),
      // No male performer
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    // Should return empty because we can't fill all slots
    expect(result).toEqual([]);
  });

  it('should handle mixed slots with and without gender hints', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Giver', 'FEMALE'),
      createSlotDefinition('slot2', 'Receiver', 'MALE'),
      createSlotDefinition('slot3', 'Other', null), // No gender hint - accepts any
    ];
    const performers = [
      createPerformer('p1', 'Jane Doe', 'FEMALE'),
      createPerformer('p2', 'John Doe', 'MALE'),
      createPerformer('p3', 'Alex Smith', 'NON_BINARY'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    // Should generate combinations with all 3 slots filled
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.assignments.length === 3)).toBe(true);

    // Slot1 should always be assigned to Jane (only FEMALE)
    expect(result.every((r) =>
      r.assignments.some((a) => a.slotDefinitionId === 'slot1' && a.performerId === 'p1')
    )).toBe(true);

    // Slot2 should always be assigned to John (only MALE)
    expect(result.every((r) =>
      r.assignments.some((a) => a.slotDefinitionId === 'slot2' && a.performerId === 'p2')
    )).toBe(true);

    // Slot3 should always be assigned to Alex (only remaining performer)
    expect(result.every((r) =>
      r.assignments.some((a) => a.slotDefinitionId === 'slot3' && a.performerId === 'p3')
    )).toBe(true);
  });

  it('should generate combinations even when slots are already assigned', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Giver', 'FEMALE'),
      createSlotDefinition('slot2', 'Receiver', 'MALE'),
    ];
    const performers = [
      createPerformer('p1', 'Jane Doe', 'FEMALE'),
      createPerformer('p2', 'John Doe', 'MALE'),
    ];
    const currentAssignments = new Map<string, string | null>([
      ['slot1', 'p1'],
      ['slot2', 'p2'],
    ]);

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    // Should still generate the combination
    expect(result).toHaveLength(1);
    expect(result[0].assignments).toEqual([
      { slotDefinitionId: 'slot1', performerId: 'p1' },
      { slotDefinitionId: 'slot2', performerId: 'p2' },
    ]);
  });

  it('should limit results to 9 combinations', () => {
    // Create 4 slots with FEMALE gender hint and 4 female performers
    // This should generate 4! = 24 permutations, but we limit to 9
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Person 1', 'FEMALE'),
      createSlotDefinition('slot2', 'Person 2', 'FEMALE'),
      createSlotDefinition('slot3', 'Person 3', 'FEMALE'),
      createSlotDefinition('slot4', 'Person 4', 'FEMALE'),
    ];
    const performers = [
      createPerformer('p1', 'Person A', 'FEMALE'),
      createPerformer('p2', 'Person B', 'FEMALE'),
      createPerformer('p3', 'Person C', 'FEMALE'),
      createPerformer('p4', 'Person D', 'FEMALE'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    expect(result).toHaveLength(9);
  });

  it('should handle transgender gender hints', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Person 1', 'TRANSGENDER_MALE'),
      createSlotDefinition('slot2', 'Person 2', 'TRANSGENDER_FEMALE'),
    ];
    const performers = [
      createPerformer('p1', 'Trans Man', 'TRANSGENDER_MALE'),
      createPerformer('p2', 'Trans Woman', 'TRANSGENDER_FEMALE'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    expect(result).toHaveLength(1);
    expect(result[0].assignments).toEqual([
      { slotDefinitionId: 'slot1', performerId: 'p1' },
      { slotDefinitionId: 'slot2', performerId: 'p2' },
    ]);
  });

  it('should handle three-way scenarios with multiple valid combinations', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Female 1', 'FEMALE'),
      createSlotDefinition('slot2', 'Female 2', 'FEMALE'),
      createSlotDefinition('slot3', 'Male', 'MALE'),
    ];
    const performers = [
      createPerformer('p1', 'Jane', 'FEMALE'),
      createPerformer('p2', 'Mary', 'FEMALE'),
      createPerformer('p3', 'John', 'MALE'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    // Should have 2 combinations:
    // Jane->Female1, Mary->Female2, John->Male
    // Mary->Female1, Jane->Female2, John->Male
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.assignments.length === 3)).toBe(true);
    expect(
      result.every((r) =>
        r.assignments.some((a) => a.performerId === 'p3' && a.slotDefinitionId === 'slot3')
      )
    ).toBe(true);
  });

  it('should generate combinations for 2 slots with 3 performers (with labels, no gender hints)', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', 'Person 1', null),
      createSlotDefinition('slot2', 'Person 2', null),
    ];
    const performers = [
      createPerformer('p1', 'Alice', 'FEMALE'),
      createPerformer('p2', 'Bob', 'MALE'),
      createPerformer('p3', 'Charlie', 'MALE'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    // Should have 6 combinations (3P2 = 3!/(3-2)! = 6):
    // Alice-Bob, Alice-Charlie, Bob-Alice, Bob-Charlie, Charlie-Alice, Charlie-Bob
    expect(result).toHaveLength(6);
    expect(result.every((r) => r.assignments.length === 2)).toBe(true);

    // Check all combinations exist
    const combinations = result.map((r) => ({
      slot1: r.assignments.find((a) => a.slotDefinitionId === 'slot1')?.performerId,
      slot2: r.assignments.find((a) => a.slotDefinitionId === 'slot2')?.performerId,
    }));

    expect(combinations).toContainEqual({ slot1: 'p1', slot2: 'p2' });
    expect(combinations).toContainEqual({ slot1: 'p1', slot2: 'p3' });
    expect(combinations).toContainEqual({ slot1: 'p2', slot2: 'p1' });
    expect(combinations).toContainEqual({ slot1: 'p2', slot2: 'p3' });
    expect(combinations).toContainEqual({ slot1: 'p3', slot2: 'p1' });
    expect(combinations).toContainEqual({ slot1: 'p3', slot2: 'p2' });
  });

  it('should deduplicate combinations for 2 unlabeled slots with 3 performers', () => {
    const slotDefinitions = [
      createSlotDefinition('slot1', null, null),
      createSlotDefinition('slot2', null, null),
    ];
    const performers = [
      createPerformer('p1', 'Alice', 'FEMALE'),
      createPerformer('p2', 'Bob', 'MALE'),
      createPerformer('p3', 'Charlie', 'MALE'),
    ];
    const currentAssignments = new Map<string, string | null>();

    const result = generateAssignmentCombinations(
      slotDefinitions,
      performers,
      currentAssignments
    );

    // Should have 3 combinations (C(3,2) = 3) after deduplication:
    // Alice+Bob, Alice+Charlie, Bob+Charlie
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.assignments.length === 2)).toBe(true);

    // Extract sorted performer ID sets
    const performerSets = result.map((r) =>
      r.assignments.map((a) => a.performerId).sort().join(',')
    );

    expect(performerSets).toContainEqual('p1,p2');
    expect(performerSets).toContainEqual('p1,p3');
    expect(performerSets).toContainEqual('p2,p3');
  });
});
