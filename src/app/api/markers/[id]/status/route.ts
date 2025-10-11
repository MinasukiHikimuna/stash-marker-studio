import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';
import { type AppConfig } from '@/serverConfig';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'app-config.json');

async function loadConfig(): Promise<AppConfig> {
  const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
  return JSON.parse(configData) as AppConfig;
}

// Update marker status (confirm/reject/reset)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'confirm', 'reject', or 'reset'

    if (!['confirm', 'reject', 'reset'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: confirm, reject, reset' },
        { status: 400 }
      );
    }

    // Load config to get status tag IDs
    const config = await loadConfig();
    const CONFIRMED_TAG_ID = parseInt(config.markerConfig.statusConfirmed);
    const REJECTED_TAG_ID = parseInt(config.markerConfig.statusRejected);

    // Convert id to number (internal database ID)
    const markerId = parseInt(id);

    if (isNaN(markerId)) {
      return NextResponse.json(
        { error: 'Invalid marker ID' },
        { status: 400 }
      );
    }

    // Find the marker
    const marker = await prisma.marker.findUnique({
      where: { id: markerId },
      include: { markerTags: true },
    });

    if (!marker) {
      console.error(`Marker not found: ${id} (parsed as ${markerId})`);
      return NextResponse.json({
        error: 'Marker not found',
        debug: { id, markerId }
      }, { status: 404 });
    }

    // Get current tag IDs (excluding status tags)
    const currentTagIds = marker.markerTags
      .filter((mt) => mt.tagId !== CONFIRMED_TAG_ID && mt.tagId !== REJECTED_TAG_ID)
      .map((mt) => mt.tagId);

    // Build new tag list based on action
    const newTagIds = [...currentTagIds];

    if (action === 'confirm') {
      // Add confirmed tag if not already present
      if (!newTagIds.includes(CONFIRMED_TAG_ID)) {
        newTagIds.push(CONFIRMED_TAG_ID);
      }
    } else if (action === 'reject') {
      // Add rejected tag if not already present
      if (!newTagIds.includes(REJECTED_TAG_ID)) {
        newTagIds.push(REJECTED_TAG_ID);
      }
    }
    // For 'reset', we just use currentTagIds (status tags already filtered out)

    // Ensure primary tag is always included
    if (marker.primaryTagId && !newTagIds.includes(marker.primaryTagId)) {
      newTagIds.push(marker.primaryTagId);
    }

    // Delete all existing marker tags
    await prisma.markerTag.deleteMany({
      where: { markerId: marker.id },
    });

    // Create new marker tags
    if (newTagIds.length > 0) {
      await prisma.markerTag.createMany({
        data: newTagIds.map((tagId) => ({
          markerId: marker.id,
          tagId,
          isPrimary: tagId === marker.primaryTagId,
        })),
      });
    }

    // Update marker timestamp
    await prisma.marker.update({
      where: { id: marker.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating marker status:', error);
    return NextResponse.json(
      { error: 'Failed to update marker status' },
      { status: 500 }
    );
  }
}
