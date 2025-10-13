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
        additionalTags: true,
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

    // Extract status tags from source marker (from additionalTags)
    const statusTagIds = sourceMarker.additionalTags
      .map((mt) => mt.tagId);

    // Get existing derivations for this source marker to avoid duplicates
    const existingDerivations = await prisma.markerDerivation.findMany({
      where: { sourceMarkerId: markerId },
      select: { ruleId: true, derivedMarkerId: true },
    });
    const existingRuleIds = new Set(existingDerivations.map((d) => d.ruleId));

    // Sort derived markers by depth to process parents before children
    const sortedDerivedMarkers = [...derivedMarkers].sort((a, b) => a.depth - b.depth);

    // Track created markers by their tag ID (to find parent marker IDs for higher depths)
    const tagIdToMarkerId = new Map<string, number>();

    // Create actual markers for each derived marker
    const createdMarkers = [];

    for (const derivedMarker of sortedDerivedMarkers) {
      const { derivedTagId, tags, slots, depth, ruleId } = derivedMarker;

      // Skip if this derivation already exists
      if (existingRuleIds.has(ruleId)) {
        continue;
      }

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

      // Check if a derived marker with the same tag and time range already exists
      // This handles the case where multiple source markers derive to the same generic tag
      // (e.g., "Cum on Ass" and "Cum on Asshole" both deriving "Cumshot")
      const existingDerivedMarker = await prisma.marker.findFirst({
        where: {
          stashappSceneId: sourceMarker.stashappSceneId,
          primaryTagId: parseInt(derivedTagId),
          seconds: sourceMarker.seconds,
          endSeconds: sourceMarker.endSeconds,
        },
        include: {
          additionalTags: true,
          markerSlots: true,
        },
      });

      let newMarker;
      if (existingDerivedMarker) {
        // Reuse existing marker instead of creating a duplicate
        newMarker = existingDerivedMarker;
      } else {
        // Create the marker in local database
        // Filter out primary tag from additional tags
        const additionalTagIds = allTagIds
          .map((tagId: string) => parseInt(tagId))
          .filter((tagId: number) => tagId !== parseInt(derivedTagId));

        newMarker = await prisma.marker.create({
          data: {
            stashappSceneId: sourceMarker.stashappSceneId,
            seconds: sourceMarker.seconds,
            endSeconds: sourceMarker.endSeconds,
            primaryTagId: parseInt(derivedTagId),
            additionalTags: additionalTagIds.length > 0
              ? {
                  create: additionalTagIds.map((tagId: number) => ({
                    tagId,
                  })),
                }
              : undefined,
            markerSlots: slotCreationData.length > 0
              ? {
                  create: slotCreationData,
                }
              : undefined,
          },
          include: {
            additionalTags: true,
            markerSlots: true,
          },
        });
      }

      // Store mapping for parent lookups
      tagIdToMarkerId.set(derivedTagId, newMarker.id);

      // Create MarkerDerivation relationship record(s)
      // Check if derivation from ultimate source already exists
      const existingUltimateDerivation = await prisma.markerDerivation.findFirst({
        where: {
          sourceMarkerId: markerId,
          derivedMarkerId: newMarker.id,
        },
      });

      if (!existingUltimateDerivation) {
        // Create a record pointing to the ultimate source (original marker)
        await prisma.markerDerivation.create({
          data: {
            sourceMarkerId: markerId,
            derivedMarkerId: newMarker.id,
            ruleId: ruleId || `${sourceMarker.primaryTagId}->${derivedTagId}`,
            depth: depth || 0,
          },
        });
      }

      // If this is a deeper derivation (depth > 0), also create a record for immediate parent
      if (depth > 0) {
        // Find the immediate parent marker by looking at the rule chain
        // The ruleId contains the source tag, which we can use to find the parent marker
        const [sourceTagId] = ruleId.split('->');
        const parentMarkerId = tagIdToMarkerId.get(sourceTagId);

        if (parentMarkerId) {
          // Check if derivation from immediate parent already exists
          const existingParentDerivation = await prisma.markerDerivation.findFirst({
            where: {
              sourceMarkerId: parentMarkerId,
              derivedMarkerId: newMarker.id,
            },
          });

          if (!existingParentDerivation) {
            // Create additional derivation record for immediate parent relationship
            await prisma.markerDerivation.create({
              data: {
                sourceMarkerId: parentMarkerId,
                derivedMarkerId: newMarker.id,
                ruleId: ruleId, // Same rule, different source
                depth: 0, // This is the immediate parent, so depth from parent is 0
              },
            });
          }
        }
      }

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
