import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StashappService } from '@/services/StashappService';
import { type AppConfig } from '@/serverConfig';
import { promises as fs } from 'fs';
import path from 'path';
import {
  classifyExportOperations,
  extractTagIds,
  getPrimaryTagId,
  type ExportOperation,
} from '@/services/markerExport';
import { Decimal } from '@prisma/client/runtime/library';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'app-config.json');

async function loadConfig(): Promise<AppConfig> {
  const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
  return JSON.parse(configData) as AppConfig;
}

interface ExportError {
  operation: ExportOperation;
  error: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sceneId, preview = false } = body;

    if (!sceneId) {
      return NextResponse.json(
        { error: 'sceneId is required' },
        { status: 400 }
      );
    }

    const sceneIdNum = parseInt(sceneId);
    if (isNaN(sceneIdNum)) {
      return NextResponse.json(
        { error: 'Invalid sceneId' },
        { status: 400 }
      );
    }

    // Load configuration and initialize StashappService
    const config = await loadConfig();
    const stashappService = new StashappService();
    stashappService.applyConfig(config);

    // Fetch local markers for this scene
    const localMarkers = await prisma.marker.findMany({
      where: { stashappSceneId: sceneIdNum },
      include: {
        additionalTags: true,
      },
    });

    // Fetch Stashapp markers for this scene
    const stashappResponse = await stashappService.getSceneMarkers(sceneId);
    const stashappMarkers = stashappResponse.findSceneMarkers.scene_markers;

    // Classify operations
    const exportPreview = classifyExportOperations(localMarkers, stashappMarkers);

    // If preview mode, return the preview without executing
    if (preview) {
      return NextResponse.json({
        preview: exportPreview,
      });
    }

    // Execute operations
    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
    };
    const errors: ExportError[] = [];

    // Phase 1: Delete orphaned markers from Stashapp
    const deleteOperations = exportPreview.operations.filter(op => op.type === 'delete');
    for (const operation of deleteOperations) {
      try {
        if (!operation.stashappMarker) {
          throw new Error('Missing stashappMarker for delete operation');
        }
        await stashappService.deleteMarker(operation.stashappMarker.id);
        results.deleted++;
      } catch (error) {
        errors.push({
          operation,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Phase 2: Update existing markers in Stashapp
    const updateOperations = exportPreview.operations.filter(op => op.type === 'update');
    for (const operation of updateOperations) {
      try {
        if (!operation.localMarker || !operation.stashappMarker) {
          throw new Error('Missing marker data for update operation');
        }

        const primaryTagId = getPrimaryTagId(
          operation.localMarker.additionalTags,
          operation.localMarker.primaryTagId
        );
        if (!primaryTagId) {
          throw new Error('No primary tag found for marker');
        }

        const tagIds = extractTagIds(
          operation.localMarker.additionalTags,
          operation.localMarker.primaryTagId
        );

        await stashappService.updateMarker(
          operation.stashappMarker.id,
          decimalToNumber(operation.localMarker.seconds),
          operation.localMarker.endSeconds ? decimalToNumber(operation.localMarker.endSeconds) : null,
          primaryTagId,
          tagIds
        );

        // Update lastExportedAt timestamp
        await prisma.marker.update({
          where: { id: operation.localMarker.id },
          data: { lastExportedAt: new Date() },
        });

        results.updated++;
      } catch (error) {
        errors.push({
          operation,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Phase 3: Create new markers in Stashapp
    const createOperations = exportPreview.operations.filter(op => op.type === 'create');
    for (const operation of createOperations) {
      try {
        if (!operation.localMarker) {
          throw new Error('Missing localMarker for create operation');
        }

        const primaryTagId = getPrimaryTagId(
          operation.localMarker.additionalTags,
          operation.localMarker.primaryTagId
        );
        if (!primaryTagId) {
          throw new Error('No primary tag found for marker');
        }

        const tagIds = extractTagIds(
          operation.localMarker.additionalTags,
          operation.localMarker.primaryTagId
        );

        const createdMarker = await stashappService.createSceneMarker(
          sceneId,
          primaryTagId,
          decimalToNumber(operation.localMarker.seconds),
          operation.localMarker.endSeconds ? decimalToNumber(operation.localMarker.endSeconds) : null,
          tagIds
        );

        // Update local database with stashappMarkerId and lastExportedAt
        await prisma.marker.update({
          where: { id: operation.localMarker.id },
          data: {
            stashappMarkerId: parseInt(createdMarker.id),
            lastExportedAt: new Date(),
          },
        });

        results.created++;
      } catch (error) {
        errors.push({
          operation,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error exporting markers:', error);
    return NextResponse.json(
      { error: 'Failed to export markers' },
      { status: 500 }
    );
  }
}

/**
 * Convert Prisma Decimal to number for JSON serialization
 */
function decimalToNumber(decimal: Decimal): number {
  return parseFloat(decimal.toString());
}
