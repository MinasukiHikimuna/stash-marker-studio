import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Get a specific slot definition
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const slotDefinition = await prisma.slotDefinition.findUnique({
      where: {
        id,
      },
      include: {
        slotDefinitionSet: true,
        genderHints: true,
      },
    });

    if (!slotDefinition) {
      return NextResponse.json({ error: 'Slot definition not found' }, { status: 404 });
    }

    return NextResponse.json({
      slotDefinition,
    });
  } catch (error) {
    console.error('Error fetching slot definition:', error);
    return NextResponse.json({ error: 'Failed to fetch slot definition' }, { status: 500 });
  }
}

// TODO: This endpoint needs to be redesigned for SlotDefinitionSet structure
// Update a slot definition
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    return NextResponse.json(
      { error: 'This endpoint is being redesigned for the new SlotDefinitionSet structure' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error updating slot definition:', error);
    return NextResponse.json({ error: 'Failed to update slot definition' }, { status: 500 });
  }
}

// Delete a slot definition
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await prisma.slotDefinition.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting slot definition:', error);
    return NextResponse.json({ error: 'Failed to delete slot definition' }, { status: 500 });
  }
}
