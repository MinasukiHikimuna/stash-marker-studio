import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StashappService, SceneMarker } from '@/services/StashappService';
import { type AppConfig } from '@/serverConfig';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'app-config.json');

async function loadConfig(): Promise<AppConfig> {
  const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
  return JSON.parse(configData) as AppConfig;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sceneId } = body;

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

    // Fetch markers from Stashapp
    const response = await stashappService.getSceneMarkers(sceneId);
    const stashappMarkers = response.findSceneMarkers.scene_markers;

    // Import markers into local database
    const importedCount = await importMarkersFromStashapp(
      stashappMarkers,
      parseInt(sceneId)
    );

    return NextResponse.json({
      success: true,
      count: importedCount,
    });
  } catch (error) {
    console.error('Error importing markers from Stashapp:', error);
    return NextResponse.json(
      { error: 'Failed to import markers from Stashapp' },
      { status: 500 }
    );
  }
}

async function importMarkersFromStashapp(
  stashappMarkers: SceneMarker[],
  sceneId: number
): Promise<number> {
  let importedCount = 0;

  // Fetch all corresponding tag mappings once for efficiency
  const correspondingTagMappings = await prisma.correspondingTagMapping.findMany();
  const tagMappingMap = new Map<number, number>();
  for (const mapping of correspondingTagMappings) {
    tagMappingMap.set(mapping.sourceTagId, mapping.correspondingTagId);
  }

  for (const stashMarker of stashappMarkers) {
    const stashappMarkerId = parseInt(stashMarker.id);

    // Check if primary tag should be converted via corresponding tag mapping
    let primaryTagId = stashMarker.primary_tag
      ? parseInt(stashMarker.primary_tag.id)
      : null;

    if (primaryTagId) {
      const correspondingTagId = tagMappingMap.get(primaryTagId);
      if (correspondingTagId) {
        // Auto-convert to corresponding tag during import
        primaryTagId = correspondingTagId;
      }
    }

    // Upsert marker (update if exists, create if not)
    const marker = await prisma.marker.upsert({
      where: { stashappMarkerId },
      create: {
        stashappMarkerId,
        stashappSceneId: sceneId,
        seconds: stashMarker.seconds,
        endSeconds: stashMarker.end_seconds ?? null,
        primaryTagId,
        lastSyncedAt: new Date(),
      },
      update: {
        seconds: stashMarker.seconds,
        endSeconds: stashMarker.end_seconds ?? null,
        primaryTagId,
        lastSyncedAt: new Date(),
      },
    });

    // Delete existing additional tags
    await prisma.markerAdditionalTag.deleteMany({
      where: { markerId: marker.id },
    });

    // Create additional tags (convert tags in the tag list, excluding primary)
    const additionalTagIds = new Set<number>();

    // Add all tags from the marker, excluding primary tag
    if (stashMarker.tags && stashMarker.tags.length > 0) {
      for (const tag of stashMarker.tags) {
        const tagId = parseInt(tag.id);
        const correspondingTagId = tagMappingMap.get(tagId);
        const finalTagId = correspondingTagId ?? tagId;
        if (finalTagId !== primaryTagId) {
          additionalTagIds.add(finalTagId);
        }
      }
    }

    // Create additional tags (excluding primary tag)
    if (additionalTagIds.size > 0) {
      await prisma.markerAdditionalTag.createMany({
        data: Array.from(additionalTagIds).map((tagId) => ({
          markerId: marker.id,
          tagId,
        })),
      });
    }

    importedCount++;
  }

  return importedCount;
}
