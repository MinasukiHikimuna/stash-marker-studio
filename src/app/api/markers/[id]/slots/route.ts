import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Get all slots for a marker
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const markerSlots = await prisma.markerSlot.findMany({
      where: {
        markerId: parseInt(id),
      },
      include: {
        slotDefinition: {
          include: {
            genderHints: true,
            slotDefinitionSet: true,
          },
        },
      },
      orderBy: {
        slotDefinition: {
          order: 'asc',
        },
      },
    });

    return NextResponse.json({
      markerSlots,
    });
  } catch (error) {
    console.error('Error fetching marker slots:', error);
    return NextResponse.json({ error: 'Failed to fetch marker slots' }, { status: 500 });
  }
}

// Create or update marker slots for a marker
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { slots } = body;

    if (!Array.isArray(slots)) {
      return NextResponse.json({ error: 'slots must be an array' }, { status: 400 });
    }

    // Use a transaction to update slots atomically
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing slots for this marker
      await tx.markerSlot.deleteMany({
        where: {
          markerId: parseInt(id),
        },
      });

      // Create new slots
      const createdSlots = await Promise.all(
        slots.map((slot: { slotDefinitionId: string; stashappPerformerId?: number }) =>
          tx.markerSlot.create({
            data: {
              markerId: parseInt(id),
              slotDefinitionId: slot.slotDefinitionId,
              stashappPerformerId: slot.stashappPerformerId ?? null,
            },
            include: {
              slotDefinition: {
                include: {
                  genderHints: true,
                  slotDefinitionSet: true,
                },
              },
            },
          })
        )
      );

      return createdSlots;
    });

    return NextResponse.json({
      success: true,
      markerSlots: result,
    });
  } catch (error) {
    console.error('Error updating marker slots:', error);
    return NextResponse.json({ error: 'Failed to update marker slots' }, { status: 500 });
  }
}
