import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Add tags to a marker (replace existing tags)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tagIds, primaryTagId } = body;

    if (!Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: 'tagIds must be an array' },
        { status: 400 }
      );
    }

    // Convert id to number (internal database ID)
    const markerId = parseInt(id);

    if (isNaN(markerId)) {
      return NextResponse.json(
        { error: 'Invalid marker ID' },
        { status: 400 }
      );
    }

    const primaryTagIdNum = primaryTagId ? parseInt(primaryTagId) : null;
    const additionalTagIds = tagIds
      .map((id: string) => parseInt(id))
      .filter((tagId: number) => tagId !== primaryTagIdNum); // Exclude primary tag

    // Validate: no additional tag should match primary tag
    if (primaryTagIdNum && additionalTagIds.includes(primaryTagIdNum)) {
      return NextResponse.json(
        { error: 'Primary tag cannot be added as an additional tag' },
        { status: 400 }
      );
    }

    // Update marker and replace all additional tags atomically
    await prisma.marker.update({
      where: { id: markerId },
      data: {
        primaryTagId: primaryTagIdNum,
        additionalTags: {
          deleteMany: {}, // Remove all existing additional tags
          create: additionalTagIds.map((tagId) => ({ tagId })),
        },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating marker tags:', error);
    return NextResponse.json(
      { error: 'Failed to update marker tags' },
      { status: 500 }
    );
  }
}

// Add a single tag to a marker (append, don't replace)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json({ error: 'tagId is required' }, { status: 400 });
    }

    // Convert id to number (internal database ID)
    const markerId = parseInt(id);

    if (isNaN(markerId)) {
      return NextResponse.json(
        { error: 'Invalid marker ID' },
        { status: 400 }
      );
    }

    // Find the marker
    const marker = await prisma.marker.findUnique({
      where: { id: markerId },
      include: { additionalTags: true },
    });

    if (!marker) {
      return NextResponse.json({ error: 'Marker not found' }, { status: 404 });
    }

    // Check if tag already exists
    const tagIdNum = parseInt(tagId);

    // Validate: cannot add primary tag as additional tag
    if (marker.primaryTagId === tagIdNum) {
      return NextResponse.json(
        { error: 'Cannot add primary tag as an additional tag' },
        { status: 400 }
      );
    }

    const existingTag = marker.additionalTags.find((mt) => mt.tagId === tagIdNum);

    if (existingTag) {
      return NextResponse.json({ success: true, message: 'Tag already exists' });
    }

    // Add the tag
    await prisma.markerAdditionalTag.create({
      data: {
        markerId: marker.id,
        tagId: tagIdNum,
      },
    });

    // Update marker timestamp
    await prisma.marker.update({
      where: { id: marker.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding tag to marker:', error);
    return NextResponse.json(
      { error: 'Failed to add tag to marker' },
      { status: 500 }
    );
  }
}

// Remove a single tag from a marker
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get('tagId');

    if (!tagId) {
      return NextResponse.json({ error: 'tagId is required' }, { status: 400 });
    }

    // Convert id to number (internal database ID)
    const markerId = parseInt(id);

    if (isNaN(markerId)) {
      return NextResponse.json(
        { error: 'Invalid marker ID' },
        { status: 400 }
      );
    }

    // Remove the tag from additional tags
    await prisma.markerAdditionalTag.deleteMany({
      where: {
        markerId,
        tagId: parseInt(tagId),
      },
    });

    // Update marker timestamp
    await prisma.marker.update({
      where: { id: markerId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing tag from marker:', error);
    return NextResponse.json(
      { error: 'Failed to remove tag from marker' },
      { status: 500 }
    );
  }
}
