import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Update a marker (times, title, primary tag)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { seconds, endSeconds, primaryTagId } = body;

    // Convert id to number (internal database ID)
    const markerId = parseInt(id);

    if (isNaN(markerId)) {
      return NextResponse.json(
        { error: 'Invalid marker ID' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      seconds?: number;
      endSeconds?: number | null;
      primaryTagId?: number | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (seconds !== undefined) updateData.seconds = seconds;
    if (endSeconds !== undefined) updateData.endSeconds = endSeconds ?? null;
    if (primaryTagId !== undefined) updateData.primaryTagId = primaryTagId ? parseInt(primaryTagId) : null;

    // Update in local database using internal ID
    const updatedMarker = await prisma.marker.update({
      where: { id: markerId },
      data: updateData,
    });

    // If primaryTagId was updated, update the isPrimary flag in marker_tags
    if (primaryTagId !== undefined && updatedMarker.primaryTagId) {
      // Set all tags to non-primary
      await prisma.markerTag.updateMany({
        where: { markerId: updatedMarker.id },
        data: { isPrimary: false },
      });

      // Set the new primary tag
      await prisma.markerTag.updateMany({
        where: {
          markerId: updatedMarker.id,
          tagId: updatedMarker.primaryTagId,
        },
        data: { isPrimary: true },
      });
    }

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

    // Convert id to number (internal database ID)
    const markerId = parseInt(id);

    if (isNaN(markerId)) {
      return NextResponse.json(
        { error: 'Invalid marker ID' },
        { status: 400 }
      );
    }

    // Delete marker tags first (foreign key constraint)
    await prisma.markerTag.deleteMany({
      where: { markerId },
    });

    // Delete from local database using internal ID
    await prisma.marker.delete({
      where: { id: markerId },
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
