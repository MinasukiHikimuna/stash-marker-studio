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

  for (const stashMarker of stashappMarkers) {
    const stashappMarkerId = parseInt(stashMarker.id);

    // Upsert marker (update if exists, create if not)
    const marker = await prisma.marker.upsert({
      where: { stashappMarkerId },
      create: {
        stashappMarkerId,
        stashappSceneId: sceneId,
        seconds: stashMarker.seconds,
        endSeconds: stashMarker.end_seconds ?? null,
        primaryTagId: stashMarker.primary_tag
          ? parseInt(stashMarker.primary_tag.id)
          : null,
        lastSyncedAt: new Date(),
      },
      update: {
        seconds: stashMarker.seconds,
        endSeconds: stashMarker.end_seconds ?? null,
        primaryTagId: stashMarker.primary_tag
          ? parseInt(stashMarker.primary_tag.id)
          : null,
        lastSyncedAt: new Date(),
      },
    });

    // Delete existing marker tags
    await prisma.markerTag.deleteMany({
      where: { markerId: marker.id },
    });

    // Create marker tags
    if (stashMarker.tags && stashMarker.tags.length > 0) {
      await prisma.markerTag.createMany({
        data: stashMarker.tags.map((tag) => ({
          markerId: marker.id,
          tagId: parseInt(tag.id),
          isPrimary: stashMarker.primary_tag?.id === tag.id,
        })),
      });
    }

    importedCount++;
  }

  return importedCount;
}
