import { validateSlotDefinitionsBelongToTag, SlotValidationResult } from './slotValidation';
import { PrismaClient } from '@prisma/client';

type MockSlotDefinition = {
  id: string;
  slotDefinitionSet: { stashappTagId: number };
};

type TestCase = {
  description: string;
  input: {
    slotDefinitionIds: string[];
    tagId: number;
  };
  mockResponse?: MockSlotDefinition[] | Error;
  expectedResult: SlotValidationResult;
  shouldCallPrisma?: boolean;
  shouldThrow?: boolean;
};

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

  const validationTestCases: TestCase[] = [
    // Empty input cases
    {
      description: 'should return valid:true when no slot definitions provided',
      input: {
        slotDefinitionIds: [],
        tagId: 5318,
      },
      expectedResult: { valid: true },
      shouldCallPrisma: false,
    },

    // Success cases
    {
      description: 'should return valid:true when all slot definitions belong to the specified tag',
      input: {
        slotDefinitionIds: ['slot-uuid-1', 'slot-uuid-2'],
        tagId: 5318,
      },
      mockResponse: [
        { id: 'slot-uuid-1', slotDefinitionSet: { stashappTagId: 5318 } },
        { id: 'slot-uuid-2', slotDefinitionSet: { stashappTagId: 5318 } },
      ],
      expectedResult: { valid: true },
      shouldCallPrisma: true,
    },
    {
      description: 'should validate single slot definition correctly',
      input: {
        slotDefinitionIds: ['slot-uuid-1'],
        tagId: 5318,
      },
      mockResponse: [
        { id: 'slot-uuid-1', slotDefinitionSet: { stashappTagId: 5318 } },
      ],
      expectedResult: { valid: true },
      shouldCallPrisma: true,
    },

    // Missing slot definition cases
    {
      description: 'should return error when some slot definitions do not exist',
      input: {
        slotDefinitionIds: ['slot-uuid-1', 'slot-uuid-2', 'slot-uuid-3'],
        tagId: 5318,
      },
      mockResponse: [
        { id: 'slot-uuid-1', slotDefinitionSet: { stashappTagId: 5318 } },
        { id: 'slot-uuid-2', slotDefinitionSet: { stashappTagId: 5318 } },
      ],
      expectedResult: {
        valid: false,
        error: 'Slot definitions not found: slot-uuid-3',
      },
      shouldCallPrisma: true,
    },
    {
      description: 'should return error when multiple slot definitions do not exist',
      input: {
        slotDefinitionIds: ['slot-uuid-1', 'slot-uuid-2', 'slot-uuid-3'],
        tagId: 5318,
      },
      mockResponse: [
        { id: 'slot-uuid-1', slotDefinitionSet: { stashappTagId: 5318 } },
      ],
      expectedResult: {
        valid: false,
        error: 'Slot definitions not found: slot-uuid-2, slot-uuid-3',
      },
      shouldCallPrisma: true,
    },

    // Tag mismatch cases
    {
      description: 'should return error when slot definition belongs to different tag',
      input: {
        slotDefinitionIds: ['slot-uuid-1'],
        tagId: 5318,
      },
      mockResponse: [
        { id: 'slot-uuid-1', slotDefinitionSet: { stashappTagId: 6263 } },
      ],
      expectedResult: {
        valid: false,
        error: "Invalid slot definitions: 1 slot(s) do not belong to tag 5318's slot definition set",
        details: [
          {
            slotDefinitionId: 'slot-uuid-1',
            expectedTagId: 5318,
            actualTagId: 6263,
          },
        ],
      },
      shouldCallPrisma: true,
    },
    {
      description: 'should return error when multiple slot definitions belong to different tags',
      input: {
        slotDefinitionIds: ['slot-uuid-1', 'slot-uuid-2', 'slot-uuid-3'],
        tagId: 5318,
      },
      mockResponse: [
        { id: 'slot-uuid-1', slotDefinitionSet: { stashappTagId: 5318 } },
        { id: 'slot-uuid-2', slotDefinitionSet: { stashappTagId: 6263 } },
        { id: 'slot-uuid-3', slotDefinitionSet: { stashappTagId: 5720 } },
      ],
      expectedResult: {
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
      },
      shouldCallPrisma: true,
    },

    // Mixed error case - missing takes precedence
    {
      description: 'should handle mixed scenario: some slots missing and some belong to wrong tag',
      input: {
        slotDefinitionIds: ['slot-uuid-1', 'slot-uuid-2', 'slot-uuid-3'],
        tagId: 5318,
      },
      mockResponse: [
        { id: 'slot-uuid-1', slotDefinitionSet: { stashappTagId: 5318 } },
        { id: 'slot-uuid-2', slotDefinitionSet: { stashappTagId: 6263 } },
      ],
      expectedResult: {
        valid: false,
        error: 'Slot definitions not found: slot-uuid-3',
      },
      shouldCallPrisma: true,
    },
  ];

  // Run all validation test cases
  test.each(validationTestCases)('$description', async (testCase) => {
    const { input, mockResponse, expectedResult, shouldCallPrisma } = testCase;

    // Setup mock if response provided
    if (mockResponse && !(mockResponse instanceof Error)) {
      (mockPrisma.slotDefinition.findMany as jest.Mock).mockResolvedValue(mockResponse);
    }

    // Execute validation
    const result = await validateSlotDefinitionsBelongToTag(
      input.slotDefinitionIds,
      input.tagId,
      mockPrisma
    );

    // Assert result
    expect(result).toEqual(expectedResult);

    // Assert Prisma was called correctly
    if (shouldCallPrisma) {
      expect(mockPrisma.slotDefinition.findMany).toHaveBeenCalledWith({
        where: { id: { in: input.slotDefinitionIds } },
        include: { slotDefinitionSet: true },
      });
    } else {
      expect(mockPrisma.slotDefinition.findMany).not.toHaveBeenCalled();
    }
  });

  // Error handling test case (needs separate handling due to rejection)
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
