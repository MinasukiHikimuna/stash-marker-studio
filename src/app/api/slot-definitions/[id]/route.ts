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

// Update a slot definition
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { slotLabel, genderHint, displayOrder } = body;

    const slotDefinition = await prisma.slotDefinition.update({
      where: {
        id,
      },
      data: {
        ...(slotLabel !== undefined && { slotLabel: slotLabel?.trim() || null }),
        ...(genderHint !== undefined && { genderHint: genderHint ?? null }),
        ...(displayOrder !== undefined && { displayOrder }),
      },
    });

    return NextResponse.json({
      success: true,
      slotDefinition,
    });
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
