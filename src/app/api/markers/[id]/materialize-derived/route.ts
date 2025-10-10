import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Materialize derived markers for a source marker by creating actual markers
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { derivedMarkers } = body;

    // Convert id to number (internal database ID)
    const markerId = parseInt(id);

    if (isNaN(markerId)) {
      return NextResponse.json(
        { error: 'Invalid marker ID' },
        { status: 400 }
      );
    }

    if (!derivedMarkers || !Array.isArray(derivedMarkers)) {
      return NextResponse.json(
        { error: 'derivedMarkers array is required' },
        { status: 400 }
      );
    }

    // Get the source marker
    const sourceMarker = await prisma.marker.findUnique({
      where: { id: markerId },
    });

    if (!sourceMarker) {
      return NextResponse.json(
        { error: 'Source marker not found' },
        { status: 404 }
      );
    }

    // Create actual markers for each derived marker
    const createdMarkers = [];

    for (const derivedMarker of derivedMarkers) {
      const { derivedTagId, tags } = derivedMarker;

      // Create the marker in local database
      const newMarker = await prisma.marker.create({
        data: {
          stashappSceneId: sourceMarker.stashappSceneId,
          seconds: sourceMarker.seconds,
          endSeconds: sourceMarker.endSeconds,
          primaryTagId: parseInt(derivedTagId),
          markerTags: {
            create: tags.map((tagId: string, index: number) => ({
              tagId: parseInt(tagId),
              isPrimary: index === 0, // First tag (derivedTagId) is primary
            })),
          },
        },
        include: {
          markerTags: true,
        },
      });

      createdMarkers.push(newMarker);
    }

    return NextResponse.json({
      success: true,
      markers: createdMarkers,
      count: createdMarkers.length,
    });
  } catch (error) {
    console.error('Error materializing derived markers:', error);
    return NextResponse.json(
      { error: 'Failed to materialize derived markers' },
      { status: 500 }
    );
  }
}
