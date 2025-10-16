import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { type SceneMarker, type Tag } from '@/services/StashappService';
import { validateSlotDefinitionsBelongToTag } from '@/core/slot/slotValidation';

// Create a new marker
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stashappSceneId, seconds, endSeconds, primaryTagId, tagIds, slots } = body;

    if (!stashappSceneId || seconds === undefined) {
      return NextResponse.json(
        { error: 'stashappSceneId and seconds are required' },
        { status: 400 }
      );
    }

    // Primary tag is stored in primaryTagId, additional tags go in additionalTags
    const primaryTagIdNum = primaryTagId ? parseInt(primaryTagId) : null;
    const additionalTagIds: number[] = (tagIds?.map((id: string) => parseInt(id)) || [])
      .filter((tagId: number) => tagId !== primaryTagIdNum); // Exclude primary tag

    // Validate slot definitions belong to primary tag (if slots provided)
    if (slots && slots.length > 0 && primaryTagIdNum) {
      const slotDefinitionIds = slots.map((s: { slotDefinitionId: string; performerId: string | null }) => s.slotDefinitionId);
      const validationResult = await validateSlotDefinitionsBelongToTag(
        slotDefinitionIds,
        primaryTagIdNum,
        prisma
      );

      if (!validationResult.valid) {
        return NextResponse.json(
          { error: validationResult.error, details: validationResult.details },
          { status: 400 }
        );
      }
    }

    // Create marker in local database with slots
    const marker = await prisma.marker.create({
      data: {
        stashappSceneId: parseInt(stashappSceneId),
        seconds,
        endSeconds: endSeconds ?? null,
        primaryTagId: primaryTagIdNum,
        additionalTags: additionalTagIds.length > 0
          ? {
              create: additionalTagIds.map((tagId) => ({
                tagId,
              })),
            }
          : undefined,
        markerSlots: slots
          ? {
              create: slots.map((slot: { slotDefinitionId: string; performerId: string | null }) => ({
                slotDefinitionId: slot.slotDefinitionId,
                stashappPerformerId: slot.performerId ? parseInt(slot.performerId) : null,
              })),
            }
          : undefined,
      },
      include: {
        additionalTags: true,
        markerSlots: {
          include: {
            slotDefinition: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      marker,
    });
  } catch (error) {
    console.error('Error creating marker in local database:', error);
    return NextResponse.json(
      { error: 'Failed to create marker in local database' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sceneId = searchParams.get('sceneId');

    if (!sceneId) {
      return NextResponse.json(
        { error: 'sceneId is required' },
        { status: 400 }
      );
    }

    // Fetch markers from local database with slots and derivation relationships
    const dbMarkers = await prisma.marker.findMany({
      where: {
        stashappSceneId: parseInt(sceneId),
      },
      include: {
        additionalTags: true,
        markerSlots: {
          include: {
            slotDefinition: {
              include: {
                genderHints: true,
                slotDefinitionSet: true,
              },
            },
          },
          orderBy: {
            slotDefinition: {
              order: 'asc',
            },
          },
        },
        derivations: true,
        derivedFrom: true,
      },
      orderBy: {
        seconds: 'asc',
      },
    });

    // Fetch scene and tags from local database for enrichment
    const [dbScene, dbTags] = await Promise.all([
      prisma.stashScene.findUnique({
        where: { id: parseInt(sceneId) },
        include: {
          tags: { include: { tag: true } },
          performers: { include: { performer: true } },
        },
      }),
      prisma.stashTag.findMany({
        include: {
          parents: {
            include: {
              parent: {
                include: {
                  parents: {
                    include: { parent: true },
                  },
                },
              },
            },
          },
          children: {
            include: { child: true },
          },
        },
      }),
    ]);

    if (!dbScene) {
      return NextResponse.json(
        { error: 'Scene not found in local database' },
        { status: 404 }
      );
    }

    // Transform dbScene to Scene format
    const scene = {
      id: dbScene.id.toString(),
      title: dbScene.title || '',
    };

    // Create a tag lookup map for fast access
    const tagMap = new Map<string, Tag>();
    for (const dbTag of dbTags) {
      tagMap.set(dbTag.id.toString(), {
        id: dbTag.id.toString(),
        name: dbTag.name,
        description: null,
        parents: dbTag.parents.map((p) => ({
          id: p.parent.id.toString(),
          name: p.parent.name,
          parents: p.parent.parents.map((pp) => ({
            id: pp.parent.id.toString(),
            name: pp.parent.name,
          })),
        })),
        children: dbTag.children.map((c) => ({
          id: c.child.id.toString(),
          name: c.child.name,
          description: null,
        })),
      });
    }

    // Collect all unique performer IDs from marker slots
    const performerIds = new Set<number>();
    for (const marker of dbMarkers) {
      for (const slot of marker.markerSlots) {
        if (slot.stashappPerformerId) {
          performerIds.add(slot.stashappPerformerId);
        }
      }
    }

    // Fetch performer data from local database
    const performerMap = new Map<number, { id: string; name: string; gender?: string }>();
    if (performerIds.size > 0) {
      try {
        const performers = await prisma.stashPerformer.findMany({
          where: {
            id: { in: Array.from(performerIds) },
          },
        });
        for (const performer of performers) {
          performerMap.set(performer.id, {
            id: performer.id.toString(),
            name: performer.name,
            gender: performer.gender || undefined,
          });
        }
      } catch (error) {
        console.warn('Failed to fetch some performers from local database:', error);
      }
    }

    // Convert database markers to SceneMarker format
    const sceneMarkers: SceneMarker[] = dbMarkers.map((dbMarker) => {
      const primaryTag = dbMarker.primaryTagId
        ? tagMap.get(dbMarker.primaryTagId.toString())
        : undefined;

      // All tags (additional tags from DB, primary tag is stored separately in primary_tag field)
      const tags = dbMarker.additionalTags
        .map((mt) => tagMap.get(mt.tagId.toString()))
        .filter((tag): tag is Tag => tag !== undefined)
        .map((tag) => ({ id: tag.id, name: tag.name }));

      // Convert marker slots with performer data
      const slots = dbMarker.markerSlots.map((slot) => ({
        id: slot.id,
        slotDefinitionId: slot.slotDefinitionId,
        stashappPerformerId: slot.stashappPerformerId,
        slotLabel: slot.slotDefinition.slotLabel,
        genderHints: slot.slotDefinition.genderHints.map(gh => gh.genderHint),
        order: slot.slotDefinition.order,
        performer: slot.stashappPerformerId
          ? performerMap.get(slot.stashappPerformerId)
          : undefined,
      }));

      // Convert derivation relationships
      const derivations = dbMarker.derivations?.map((d) => ({
        derivedMarkerId: d.derivedMarkerId.toString(),
        ruleId: d.ruleId,
        depth: d.depth,
      }));

      const derivedFrom = dbMarker.derivedFrom?.map((d) => ({
        sourceMarkerId: d.sourceMarkerId.toString(),
        ruleId: d.ruleId,
        depth: d.depth,
      }));

      return {
        id: dbMarker.id.toString(), // Always use internal database ID
        title: primaryTag?.name || '',
        seconds: Number(dbMarker.seconds),
        end_seconds: dbMarker.endSeconds ? Number(dbMarker.endSeconds) : undefined,
        // These fields are not used by the app but required by the type
        stream: '',
        preview: '',
        screenshot: '',
        scene: {
          id: scene.id,
          title: scene.title,
        },
        primary_tag: primaryTag || {
          id: '',
          name: '',
        },
        tags,
        slots: slots.length > 0 ? slots : undefined,
        derivations: derivations && derivations.length > 0 ? derivations : undefined,
        derivedFrom: derivedFrom && derivedFrom.length > 0 ? derivedFrom : undefined,
      };
    });

    return NextResponse.json({
      markers: sceneMarkers,
    });
  } catch (error) {
    console.error('Error fetching markers from local database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markers from local database' },
      { status: 500 }
    );
  }
}
