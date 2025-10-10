import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StashappService, type SceneMarker, type Tag } from '@/services/StashappService';
import { type AppConfig } from '@/serverConfig';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'app-config.json');

async function loadConfig(): Promise<AppConfig> {
  const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
  return JSON.parse(configData) as AppConfig;
}

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

    // Create marker in local database with slots
    const marker = await prisma.marker.create({
      data: {
        stashappSceneId: parseInt(stashappSceneId),
        seconds,
        endSeconds: endSeconds ?? null,
        primaryTagId: primaryTagId ? parseInt(primaryTagId) : null,
        markerTags: tagIds
          ? {
              create: tagIds.map((tagId: string) => ({
                tagId: parseInt(tagId),
                isPrimary: primaryTagId === tagId,
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
        markerTags: true,
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

    // Load configuration and apply to service
    const config = await loadConfig();
    const stashappService = new StashappService();
    stashappService.applyConfig(config);

    // Fetch markers from local database with slots and derivation relationships
    const dbMarkers = await prisma.marker.findMany({
      where: {
        stashappSceneId: parseInt(sceneId),
      },
      include: {
        markerTags: true,
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

    // Fetch scene and tags from Stashapp for enrichment
    const [scene, tagsResult] = await Promise.all([
      stashappService.getScene(sceneId),
      stashappService.getAllTags(),
    ]);

    if (!scene) {
      return NextResponse.json(
        { error: 'Scene not found in Stashapp' },
        { status: 404 }
      );
    }

    // Create a tag lookup map for fast access
    const tagMap = new Map<string, Tag>();
    for (const tag of tagsResult.findTags.tags) {
      tagMap.set(tag.id, tag);
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

    // Fetch performer data from Stashapp
    const performerMap = new Map<number, { id: string; name: string; gender?: string }>();
    if (performerIds.size > 0) {
      try {
        const performers = await Promise.all(
          Array.from(performerIds).map(id => stashappService.getPerformer(id.toString()))
        );
        for (const performer of performers) {
          if (performer) {
            performerMap.set(parseInt(performer.id), {
              id: performer.id,
              name: performer.name,
              gender: performer.gender,
            });
          }
        }
      } catch (error) {
        console.warn('Failed to fetch some performers:', error);
      }
    }

    // Convert database markers to SceneMarker format
    const sceneMarkers: SceneMarker[] = dbMarkers.map((dbMarker) => {
      const primaryTag = dbMarker.primaryTagId
        ? tagMap.get(dbMarker.primaryTagId.toString())
        : undefined;

      const tags = dbMarker.markerTags
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
