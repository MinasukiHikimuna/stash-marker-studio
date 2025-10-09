import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/markers/convert-by-tag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceTagId, correspondingTagId } = body;

    if (!sourceTagId || !correspondingTagId) {
      return NextResponse.json(
        { error: 'sourceTagId and correspondingTagId are required' },
        { status: 400 }
      );
    }

    const sourceTagIdInt = parseInt(sourceTagId);
    const correspondingTagIdInt = parseInt(correspondingTagId);

    // Update all markers with the source tag as primary tag
    const result = await prisma.marker.updateMany({
      where: {
        primaryTagId: sourceTagIdInt,
      },
      data: {
        primaryTagId: correspondingTagIdInt,
      },
    });

    // Also update marker_tags table to change the tag references
    await prisma.markerTag.updateMany({
      where: {
        tagId: sourceTagIdInt,
      },
      data: {
        tagId: correspondingTagIdInt,
      },
    });

    return NextResponse.json({
      success: true,
      convertedCount: result.count,
    });
  } catch (error) {
    console.error('Error converting markers by tag:', error);
    return NextResponse.json(
      { error: 'Failed to convert markers by tag' },
      { status: 500 }
    );
  }
}
