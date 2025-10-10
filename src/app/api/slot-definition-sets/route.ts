import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GenderHint } from '@prisma/client';

// Get all slot definition sets, optionally filtered by tag ID
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get('tagId');

    const slotDefinitionSets = await prisma.slotDefinitionSet.findMany({
      where: tagId
        ? {
            stashappTagId: parseInt(tagId),
          }
        : undefined,
      include: {
        slotDefinitions: {
          include: {
            genderHints: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return NextResponse.json({
      slotDefinitionSets,
    });
  } catch (error) {
    console.error('Error fetching slot definition sets:', error);
    return NextResponse.json({ error: 'Failed to fetch slot definition sets' }, { status: 500 });
  }
}

// Create or update a complete slot definition set for a tag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stashappTagId, allowSamePerformerInMultipleSlots, slots } = body;

    if (!stashappTagId) {
      return NextResponse.json(
        { error: 'stashappTagId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(slots)) {
      return NextResponse.json(
        { error: 'slots must be an array' },
        { status: 400 }
      );
    }

    // Use a transaction to create/update the entire set atomically
    const result = await prisma.$transaction(async (tx) => {
      // Check if a set already exists for this tag
      const existingSet = await tx.slotDefinitionSet.findUnique({
        where: {
          stashappTagId: parseInt(stashappTagId),
        },
        include: {
          slotDefinitions: {
            include: {
              genderHints: true,
            },
          },
        },
      });

      let slotDefinitionSet;

      if (existingSet) {
        // Update existing set
        slotDefinitionSet = await tx.slotDefinitionSet.update({
          where: {
            id: existingSet.id,
          },
          data: {
            allowSamePerformerInMultipleSlots: allowSamePerformerInMultipleSlots ?? false,
          },
        });

        // Delete existing slot definitions and their gender hints (cascades)
        await tx.slotDefinition.deleteMany({
          where: {
            slotDefinitionSetId: existingSet.id,
          },
        });
      } else {
        // Create new set
        slotDefinitionSet = await tx.slotDefinitionSet.create({
          data: {
            stashappTagId: parseInt(stashappTagId),
            allowSamePerformerInMultipleSlots: allowSamePerformerInMultipleSlots ?? false,
          },
        });
      }

      // Create slot definitions with their gender hints
      await Promise.all(
        slots.map(async (slot: { slotLabel: string; genderHints: string[] }, index: number) => {
          const slotDefinition = await tx.slotDefinition.create({
            data: {
              slotDefinitionSetId: slotDefinitionSet.id,
              slotLabel: slot.slotLabel?.trim() || null,
              order: index,
            },
          });

          // Create gender hints if any
          if (slot.genderHints && slot.genderHints.length > 0) {
            await tx.slotDefinitionGenderHint.createMany({
              data: slot.genderHints.map((hint) => ({
                slotDefinitionId: slotDefinition.id,
                genderHint: hint as GenderHint,
              })),
            });
          }

          return slotDefinition;
        })
      );

      // Fetch the complete set with all relations
      return await tx.slotDefinitionSet.findUnique({
        where: {
          id: slotDefinitionSet.id,
        },
        include: {
          slotDefinitions: {
            include: {
              genderHints: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      slotDefinitionSet: result,
    });
  } catch (error) {
    console.error('Error creating/updating slot definition set:', error);
    return NextResponse.json({ error: 'Failed to create/update slot definition set' }, { status: 500 });
  }
}

// Delete a slot definition set (by tag ID)
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get('tagId');

    if (!tagId) {
      return NextResponse.json(
        { error: 'tagId is required' },
        { status: 400 }
      );
    }

    await prisma.slotDefinitionSet.delete({
      where: {
        stashappTagId: parseInt(tagId),
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting slot definition set:', error);
    return NextResponse.json({ error: 'Failed to delete slot definition set' }, { status: 500 });
  }
}
