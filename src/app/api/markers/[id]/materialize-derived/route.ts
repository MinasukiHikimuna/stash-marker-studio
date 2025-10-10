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

    // Get the source marker with its tags and slots
    const sourceMarker = await prisma.marker.findUnique({
      where: { id: markerId },
      include: {
        markerTags: true,
        markerSlots: true,
      },
    });

    if (!sourceMarker) {
      return NextResponse.json(
        { error: 'Source marker not found' },
        { status: 404 }
      );
    }

    // Extract status tags from source marker (exclude primary tag)
    const statusTagIds = sourceMarker.markerTags
      .filter((mt) => !mt.isPrimary)
      .map((mt) => mt.tagId);

    // Create actual markers for each derived marker
    const createdMarkers = [];

    for (const derivedMarker of derivedMarkers) {
      const { derivedTagId, tags, slots } = derivedMarker;

      // Combine derived tags with status tags from source marker
      const allTagIds = [...tags, ...statusTagIds.map(String)];

      // Look up slot definitions for the derived tag to map slot labels to IDs
      let slotDefinitionsForTag: Array<{ id: string; slotLabel: string | null }> = [];
      if (slots && slots.length > 0) {
        // Fetch slot definition set for the derived tag
        const slotDefinitionSet = await prisma.slotDefinitionSet.findUnique({
          where: { stashappTagId: parseInt(derivedTagId) },
          include: {
            slotDefinitions: {
              select: {
                id: true,
                slotLabel: true,
              },
            },
          },
        });

        if (slotDefinitionSet) {
          slotDefinitionsForTag = slotDefinitionSet.slotDefinitions;
        }
      }

      // Map slot labels to slot definition IDs
      type SlotCreationItem = { slotDefinitionId: string; stashappPerformerId: number | null };
      const slotCreationData: SlotCreationItem[] = slots && slots.length > 0
        ? slots
            .map((slot: { label: string; performerId: string }): SlotCreationItem | null => {
              const slotDef = slotDefinitionsForTag.find((sd) => sd.slotLabel === slot.label);
              if (!slotDef) {
                console.warn(`Slot definition not found for label "${slot.label}" on tag ${derivedTagId}`);
                return null;
              }
              return {
                slotDefinitionId: slotDef.id,
                stashappPerformerId: slot.performerId ? parseInt(slot.performerId) : null,
              };
            })
            .filter((slot: SlotCreationItem | null): slot is SlotCreationItem => slot !== null)
        : [];

      // Create the marker in local database
      const newMarker = await prisma.marker.create({
        data: {
          stashappSceneId: sourceMarker.stashappSceneId,
          seconds: sourceMarker.seconds,
          endSeconds: sourceMarker.endSeconds,
          primaryTagId: parseInt(derivedTagId),
          markerTags: {
            create: allTagIds.map((tagId: string, index: number) => ({
              tagId: parseInt(tagId),
              isPrimary: index === 0, // First tag (derivedTagId) is primary
            })),
          },
          markerSlots: slotCreationData.length > 0
            ? {
                create: slotCreationData,
              }
            : undefined,
        },
        include: {
          markerTags: true,
          markerSlots: true,
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
