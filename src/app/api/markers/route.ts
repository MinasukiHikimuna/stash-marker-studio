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
    const { stashappSceneId, title, seconds, endSeconds, primaryTagId, tagIds } = body;

    if (!stashappSceneId || !title || seconds === undefined) {
      return NextResponse.json(
        { error: 'stashappSceneId, title, and seconds are required' },
        { status: 400 }
      );
    }

    // Create marker in local database
    const marker = await prisma.marker.create({
      data: {
        stashappSceneId: parseInt(stashappSceneId),
        title,
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
      },
      include: {
        markerTags: true,
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

    // Fetch markers from local database
    const dbMarkers = await prisma.marker.findMany({
      where: {
        stashappSceneId: parseInt(sceneId),
      },
      include: {
        markerTags: true,
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

    // Convert database markers to SceneMarker format
    const sceneMarkers: SceneMarker[] = dbMarkers.map((dbMarker) => {
      const primaryTag = dbMarker.primaryTagId
        ? tagMap.get(dbMarker.primaryTagId.toString())
        : undefined;

      const tags = dbMarker.markerTags
        .map((mt) => tagMap.get(mt.tagId.toString()))
        .filter((tag): tag is Tag => tag !== undefined)
        .map((tag) => ({ id: tag.id, name: tag.name }));

      return {
        id: dbMarker.stashappMarkerId?.toString() || dbMarker.id.toString(),
        title: dbMarker.title,
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
