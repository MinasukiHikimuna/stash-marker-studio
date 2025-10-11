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
    const tagsToCreate = new Set(tagIds.map((id: string) => parseInt(id)));

    // Ensure primary tag is always included
    if (primaryTagIdNum && !tagsToCreate.has(primaryTagIdNum)) {
      tagsToCreate.add(primaryTagIdNum);
    }

    // Get current marker state
    const currentMarker = await prisma.marker.findUnique({
      where: { id: markerId },
      select: { primaryTagId: true },
    });

    // Step 1: If we're changing the primary tag, temporarily set it to null to allow deletion
    if (currentMarker?.primaryTagId && currentMarker.primaryTagId !== primaryTagIdNum) {
      await prisma.marker.update({
        where: { id: markerId },
        data: { primaryTagId: null },
      });
    }

    // Step 2: Delete all existing tags (now safe since primary_tag_id is null or unchanged)
    await prisma.markerTag.deleteMany({
      where: { markerId },
    });

    // Step 3: Create all new tags
    if (tagsToCreate.size > 0) {
      await prisma.markerTag.createMany({
        data: Array.from(tagsToCreate).map((tagId) => ({
          markerId,
          tagId,
          isPrimary: primaryTagIdNum === tagId,
        })),
      });
    }

    // Step 4: Set the primary tag ID (trigger will validate it exists in marker_tags)
    await prisma.marker.update({
      where: { id: markerId },
      data: {
        primaryTagId: primaryTagIdNum,
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
      include: { markerTags: true },
    });

    if (!marker) {
      return NextResponse.json({ error: 'Marker not found' }, { status: 404 });
    }

    // Check if tag already exists
    const tagIdNum = parseInt(tagId);
    const existingTag = marker.markerTags.find((mt) => mt.tagId === tagIdNum);

    if (existingTag) {
      return NextResponse.json({ success: true, message: 'Tag already exists' });
    }

    // Add the tag
    await prisma.markerTag.create({
      data: {
        markerId: marker.id,
        tagId: tagIdNum,
        isPrimary: false,
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

    // Remove the tag
    await prisma.markerTag.deleteMany({
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
