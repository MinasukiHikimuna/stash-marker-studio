import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Update a marker
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { seconds, endSeconds } = body;

    // Update in local database
    const updatedMarker = await prisma.marker.update({
      where: {
        stashappMarkerId: parseInt(id),
      },
      data: {
        seconds,
        endSeconds: endSeconds ?? null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      marker: updatedMarker,
    });
  } catch (error) {
    console.error('Error updating marker in local database:', error);
    return NextResponse.json(
      { error: 'Failed to update marker in local database' },
      { status: 500 }
    );
  }
}

// Delete a marker
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete from local database
    await prisma.marker.delete({
      where: {
        stashappMarkerId: parseInt(id),
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting marker from local database:', error);
    return NextResponse.json(
      { error: 'Failed to delete marker from local database' },
      { status: 500 }
    );
  }
}
