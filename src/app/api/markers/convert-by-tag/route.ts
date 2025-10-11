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

    // Get all markers with the source tag and check for duplicates
    const markersWithSource = await prisma.markerAdditionalTag.findMany({
      where: { tagId: sourceTagIdInt },
      include: { marker: { select: { primaryTagId: true } } },
    });

    const markerIds = new Set(markersWithSource.map(mt => mt.markerId));

    // Find markers that already have the corresponding tag
    const markersWithBoth = await prisma.markerAdditionalTag.findMany({
      where: {
        markerId: { in: Array.from(markerIds) },
        tagId: correspondingTagIdInt,
      },
      select: { markerId: true },
    });

    const markerIdsWithBoth = new Set(markersWithBoth.map(mt => mt.markerId));

    // Delete source tags where corresponding tag already exists
    if (markerIdsWithBoth.size > 0) {
      await prisma.markerAdditionalTag.deleteMany({
        where: {
          markerId: { in: Array.from(markerIdsWithBoth) },
          tagId: sourceTagIdInt,
        },
      });
    }

    // Update source tag to corresponding tag where no duplicate exists
    const markerIdsToUpdate = Array.from(markerIds).filter(id => !markerIdsWithBoth.has(id));
    if (markerIdsToUpdate.length > 0) {
      await prisma.markerAdditionalTag.updateMany({
        where: {
          markerId: { in: markerIdsToUpdate },
          tagId: sourceTagIdInt,
        },
        data: { tagId: correspondingTagIdInt },
      });
    }

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
