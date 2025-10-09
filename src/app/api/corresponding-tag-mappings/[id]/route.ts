import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/corresponding-tag-mappings/[id] - Get a specific mapping
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const mapping = await prisma.correspondingTagMapping.findUnique({
      where: { id },
    });

    if (!mapping) {
      return NextResponse.json(
        { error: 'Corresponding tag mapping not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(mapping);
  } catch (error) {
    console.error('Error fetching corresponding tag mapping:', error);
    return NextResponse.json(
      { error: 'Failed to fetch corresponding tag mapping' },
      { status: 500 }
    );
  }
}

// PUT /api/corresponding-tag-mappings/[id] - Update a mapping
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { sourceTagId, correspondingTagId } = body;

    if (!sourceTagId || !correspondingTagId) {
      return NextResponse.json(
        { error: 'sourceTagId and correspondingTagId are required' },
        { status: 400 }
      );
    }

    // Check if another mapping exists for this source tag (excluding current)
    const existing = await prisma.correspondingTagMapping.findFirst({
      where: {
        sourceTagId: parseInt(sourceTagId),
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A mapping already exists for this source tag' },
        { status: 409 }
      );
    }

    const mapping = await prisma.correspondingTagMapping.update({
      where: { id },
      data: {
        sourceTagId: parseInt(sourceTagId),
        correspondingTagId: parseInt(correspondingTagId),
      },
    });

    return NextResponse.json(mapping);
  } catch (error) {
    console.error('Error updating corresponding tag mapping:', error);
    return NextResponse.json(
      { error: 'Failed to update corresponding tag mapping' },
      { status: 500 }
    );
  }
}

// DELETE /api/corresponding-tag-mappings/[id] - Delete a mapping
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    await prisma.correspondingTagMapping.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting corresponding tag mapping:', error);
    return NextResponse.json(
      { error: 'Failed to delete corresponding tag mapping' },
      { status: 500 }
    );
  }
}
