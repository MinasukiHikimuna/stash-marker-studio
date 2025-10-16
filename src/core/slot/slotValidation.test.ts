import { validateSlotDefinitionsBelongToTag } from './slotValidation';
import { PrismaClient } from '@prisma/client';

describe('validateSlotDefinitionsBelongToTag', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Create a mock Prisma client with typed methods
    mockPrisma = {
      slotDefinition: {
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return valid:true when no slot definitions provided', async () => {
    const result = await validateSlotDefinitionsBelongToTag([], 5318, mockPrisma);

    expect(result).toEqual({ valid: true });
    expect(mockPrisma.slotDefinition.findMany).not.toHaveBeenCalled();
  });

  it('should return valid:true when empty array provided', async () => {
    const result = await validateSlotDefinitionsBelongToTag([], 5318, mockPrisma);

    expect(result).toEqual({ valid: true });
    expect(mockPrisma.slotDefinition.findMany).not.toHaveBeenCalled();
  });

  it('should return valid:true when all slot definitions belong to the specified tag', async () => {
    const slotDefinitionIds = ['slot-uuid-1', 'slot-uuid-2'];
    const tagId = 5318;

    // Mock Prisma response - all slots belong to tag 5318
    (mockPrisma.slotDefinition.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'slot-uuid-1',
        slotDefinitionSet: { stashappTagId: 5318 },
      },
      {
        id: 'slot-uuid-2',
        slotDefinitionSet: { stashappTagId: 5318 },
      },
    ]);

    const result = await validateSlotDefinitionsBelongToTag(slotDefinitionIds, tagId, mockPrisma);

    expect(result).toEqual({ valid: true });
    expect(mockPrisma.slotDefinition.findMany).toHaveBeenCalledWith({
      where: { id: { in: slotDefinitionIds } },
      include: { slotDefinitionSet: true },
    });
  });

  it('should return error when some slot definitions do not exist', async () => {
    const slotDefinitionIds = ['slot-uuid-1', 'slot-uuid-2', 'slot-uuid-3'];
    const tagId = 5318;

    // Mock Prisma response - only 2 of 3 slots found
    (mockPrisma.slotDefinition.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'slot-uuid-1',
        slotDefinitionSet: { stashappTagId: 5318 },
      },
      {
        id: 'slot-uuid-2',
        slotDefinitionSet: { stashappTagId: 5318 },
      },
    ]);

    const result = await validateSlotDefinitionsBelongToTag(slotDefinitionIds, tagId, mockPrisma);

    expect(result).toEqual({
      valid: false,
      error: 'Slot definitions not found: slot-uuid-3',
    });
  });

  it('should return error when multiple slot definitions do not exist', async () => {
    const slotDefinitionIds = ['slot-uuid-1', 'slot-uuid-2', 'slot-uuid-3'];
    const tagId = 5318;

    // Mock Prisma response - only 1 of 3 slots found
    (mockPrisma.slotDefinition.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'slot-uuid-1',
        slotDefinitionSet: { stashappTagId: 5318 },
      },
    ]);

    const result = await validateSlotDefinitionsBelongToTag(slotDefinitionIds, tagId, mockPrisma);

    expect(result).toEqual({
      valid: false,
      error: 'Slot definitions not found: slot-uuid-2, slot-uuid-3',
    });
  });

  it('should return error when slot definition belongs to different tag', async () => {
    const slotDefinitionIds = ['slot-uuid-1'];
    const tagId = 5318; // Blowjob tag

    // Mock Prisma response - slot belongs to different tag (6263 - Kissing)
    (mockPrisma.slotDefinition.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'slot-uuid-1',
        slotDefinitionSet: { stashappTagId: 6263 }, // Wrong tag!
      },
    ]);

    const result = await validateSlotDefinitionsBelongToTag(slotDefinitionIds, tagId, mockPrisma);

    expect(result).toEqual({
      valid: false,
      error: "Invalid slot definitions: 1 slot(s) do not belong to tag 5318's slot definition set",
      details: [
        {
          slotDefinitionId: 'slot-uuid-1',
          expectedTagId: 5318,
          actualTagId: 6263,
        },
      ],
    });
  });

  it('should return error when multiple slot definitions belong to different tags', async () => {
    const slotDefinitionIds = ['slot-uuid-1', 'slot-uuid-2', 'slot-uuid-3'];
    const tagId = 5318; // Expected tag

    // Mock Prisma response - 2 slots belong to wrong tags
    (mockPrisma.slotDefinition.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'slot-uuid-1',
        slotDefinitionSet: { stashappTagId: 5318 }, // Correct
      },
      {
        id: 'slot-uuid-2',
        slotDefinitionSet: { stashappTagId: 6263 }, // Wrong tag!
      },
      {
        id: 'slot-uuid-3',
        slotDefinitionSet: { stashappTagId: 5720 }, // Wrong tag!
      },
    ]);

    const result = await validateSlotDefinitionsBelongToTag(slotDefinitionIds, tagId, mockPrisma);

    expect(result).toEqual({
      valid: false,
      error: "Invalid slot definitions: 2 slot(s) do not belong to tag 5318's slot definition set",
      details: [
        {
          slotDefinitionId: 'slot-uuid-2',
          expectedTagId: 5318,
          actualTagId: 6263,
        },
        {
          slotDefinitionId: 'slot-uuid-3',
          expectedTagId: 5318,
          actualTagId: 5720,
        },
      ],
    });
  });

  it('should handle mixed scenario: some slots missing and some belong to wrong tag', async () => {
    const slotDefinitionIds = ['slot-uuid-1', 'slot-uuid-2', 'slot-uuid-3'];
    const tagId = 5318;

    // Mock Prisma response - only 2 slots found (missing check happens first)
    (mockPrisma.slotDefinition.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'slot-uuid-1',
        slotDefinitionSet: { stashappTagId: 5318 },
      },
      {
        id: 'slot-uuid-2',
        slotDefinitionSet: { stashappTagId: 6263 }, // Wrong tag
      },
    ]);

    const result = await validateSlotDefinitionsBelongToTag(slotDefinitionIds, tagId, mockPrisma);

    // Should fail on "not found" check first, before tag mismatch check
    expect(result).toEqual({
      valid: false,
      error: 'Slot definitions not found: slot-uuid-3',
    });
  });

  it('should validate single slot definition correctly', async () => {
    const slotDefinitionIds = ['slot-uuid-1'];
    const tagId = 5318;

    (mockPrisma.slotDefinition.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'slot-uuid-1',
        slotDefinitionSet: { stashappTagId: 5318 },
      },
    ]);

    const result = await validateSlotDefinitionsBelongToTag(slotDefinitionIds, tagId, mockPrisma);

    expect(result).toEqual({ valid: true });
  });

  it('should handle database errors gracefully', async () => {
    const slotDefinitionIds = ['slot-uuid-1'];
    const tagId = 5318;

    // Mock database error
    (mockPrisma.slotDefinition.findMany as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    await expect(
      validateSlotDefinitionsBelongToTag(slotDefinitionIds, tagId, mockPrisma)
    ).rejects.toThrow('Database connection failed');
  });
});
