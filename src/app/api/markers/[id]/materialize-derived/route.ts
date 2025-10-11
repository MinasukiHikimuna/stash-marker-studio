import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { type AppConfig } from '@/serverConfig';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'app-config.json');

async function loadConfig(): Promise<AppConfig> {
  const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
  return JSON.parse(configData) as AppConfig;
}

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

    // Load configuration to get the derived source tag
    const config = await loadConfig();
    const derivedSourceTagId = config.markerConfig.sourceDerived;

    // Extract status tags from source marker (exclude primary tag)
    const statusTagIds = sourceMarker.markerTags
      .filter((mt) => !mt.isPrimary)
      .map((mt) => mt.tagId);

    // Create actual markers for each derived marker
    const createdMarkers = [];

    for (const derivedMarker of derivedMarkers) {
      const { derivedTagId, tags, slots, depth, ruleId } = derivedMarker;

      // Combine derived tags with status tags from source marker
      // Also add the derived source tag if configured
      const additionalTags = [...statusTagIds.map(String)];
      if (derivedSourceTagId) {
        additionalTags.push(derivedSourceTagId);
      }
      const allTagIds = [...tags, ...additionalTags];

      type SlotCreationItem = { slotDefinitionId: string; stashappPerformerId: number | null };
      const slotCreationData: SlotCreationItem[] = slots && slots.length > 0
        ? slots.map((slot: { slotDefinitionId: string; performerId: string }): SlotCreationItem => ({
            slotDefinitionId: slot.slotDefinitionId,
            stashappPerformerId: slot.performerId ? parseInt(slot.performerId) : null,
          }))
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

      // Create MarkerDerivation relationship record
      await prisma.markerDerivation.create({
        data: {
          sourceMarkerId: markerId,
          derivedMarkerId: newMarker.id,
          ruleId: ruleId || `${sourceMarker.primaryTagId}->${derivedTagId}`,
          depth: depth || 0,
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
