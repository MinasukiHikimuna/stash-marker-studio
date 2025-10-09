import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ sourceTagId: string }>;
};

// GET /api/corresponding-tag-mappings/by-source-tag/[sourceTagId] - Get mapping by source tag ID
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { sourceTagId } = await context.params;

    const mapping = await prisma.correspondingTagMapping.findUnique({
      where: { sourceTagId: parseInt(sourceTagId) },
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

// PATCH /api/corresponding-tag-mappings/by-source-tag/[sourceTagId] - Update mapping
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { sourceTagId } = await context.params;
    const body = await request.json();
    const { correspondingTagId } = body;

    if (!correspondingTagId) {
      return NextResponse.json(
        { error: 'correspondingTagId is required' },
        { status: 400 }
      );
    }

    const mapping = await prisma.correspondingTagMapping.update({
      where: {
        sourceTagId: parseInt(sourceTagId),
      },
      data: {
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

// DELETE /api/corresponding-tag-mappings/by-source-tag/[sourceTagId] - Delete mapping
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { sourceTagId } = await context.params;

    await prisma.correspondingTagMapping.delete({
      where: {
        sourceTagId: parseInt(sourceTagId),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Check if error is "Record not found"
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }

    console.error('Error deleting corresponding tag mapping:', error);
    return NextResponse.json(
      { error: 'Failed to delete corresponding tag mapping' },
      { status: 500 }
    );
  }
}
