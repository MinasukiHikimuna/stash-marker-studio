#!/usr/bin/env tsx

/**
 * Data Migration Script: Migrate markerGroupTagSorting from app-config.json to PostgreSQL
 *
 * This script reads the markerGroupTagSorting configuration from app-config.json
 * and migrates it to the marker_group_tag_sorting database table.
 *
 * Usage:
 *   npx tsx scripts/migrate-tag-sorting-to-db.ts
 *
 * This script is idempotent - it's safe to run multiple times.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE_PATH = path.join(__dirname, '..', 'app-config.json');

const prisma = new PrismaClient();

interface AppConfig {
  markerGroupTagSorting?: {
    [markerGroupId: string]: string[];
  };
}

interface MigrationStats {
  migrated: number;
  skipped: number;
  failed: number;
}

async function loadConfig(): Promise<AppConfig | null> {
  try {
    const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    const config = JSON.parse(configData) as AppConfig;
    return config;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.error(`❌ Configuration file not found at ${CONFIG_FILE_PATH}`);
      return null;
    }
    throw error;
  }
}

async function migrateTagSorting(
  markerGroupId: string,
  tagIds: string[]
): Promise<{ success: number; skipped: number; failed: number }> {
  const stats = { success: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < tagIds.length; i++) {
    const tagId = tagIds[i];
    const sortOrder = i;

    try {
      // Check if this tag already has sorting defined
      const existing = await prisma.markerGroupTagSorting.findUnique({
        where: { tagId: parseInt(tagId) },
      });

      if (existing) {
        // Skip if already exists
        stats.skipped++;
        continue;
      }

      // Insert new sorting rule
      await prisma.markerGroupTagSorting.create({
        data: {
          markerGroupId: parseInt(markerGroupId),
          tagId: parseInt(tagId),
          sortOrder,
        },
      });

      stats.success++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate tag ${tagId}:`, error instanceof Error ? error.message : String(error));
      stats.failed++;
    }
  }

  return stats;
}

async function main() {
  console.log('🔄 Migrating marker group tag sorting to database...\n');

  // Load configuration
  console.log('Reading app-config.json...');
  const config = await loadConfig();

  if (!config) {
    console.error('Cannot proceed without configuration file.');
    process.exit(1);
  }

  if (!config.markerGroupTagSorting || Object.keys(config.markerGroupTagSorting).length === 0) {
    console.log('ℹ️  No markerGroupTagSorting found in app-config.json');
    console.log('Nothing to migrate.');
    process.exit(0);
  }

  const markerGroupTagSorting = config.markerGroupTagSorting;
  const markerGroupIds = Object.keys(markerGroupTagSorting);

  console.log(`Found markerGroupTagSorting with ${markerGroupIds.length} marker group(s):`);
  for (const markerGroupId of markerGroupIds) {
    const tagCount = markerGroupTagSorting[markerGroupId].length;
    console.log(`  • Marker Group ${markerGroupId}: ${tagCount} tag(s)`);
  }
  console.log();

  // Migrate each marker group
  console.log('Migrating...');
  const totalStats: MigrationStats = { migrated: 0, skipped: 0, failed: 0 };

  for (const markerGroupId of markerGroupIds) {
    const tagIds = markerGroupTagSorting[markerGroupId];
    const stats = await migrateTagSorting(markerGroupId, tagIds);

    console.log(`  ✅ Marker Group ${markerGroupId}: ${stats.success}/${tagIds.length} tag(s) migrated`);

    if (stats.skipped > 0) {
      console.log(`     ⚠️  Skipped ${stats.skipped} tag(s) (already existed)`);
    }

    if (stats.failed > 0) {
      console.log(`     ❌ Failed ${stats.failed} tag(s)`);
    }

    totalStats.migrated += stats.success;
    totalStats.skipped += stats.skipped;
    totalStats.failed += stats.failed;
  }

  console.log();
  console.log('Summary:');
  console.log(`  ✅ Migrated: ${totalStats.migrated} row(s)`);
  console.log(`  ⚠️  Skipped: ${totalStats.skipped} (already existed)`);
  console.log(`  ❌ Failed: ${totalStats.failed}`);
  console.log();

  if (totalStats.failed > 0) {
    console.log('⚠️  Migration completed with errors. Please review the failed entries above.');
    process.exit(1);
  } else if (totalStats.migrated === 0 && totalStats.skipped > 0) {
    console.log('ℹ️  All sorting rules were already in the database. No changes made.');
  } else {
    console.log('🎉 Migration complete!');
    console.log();
    console.log('Next steps:');
    console.log('  1. Verify the app works correctly');
    console.log('  2. (Optional) Remove markerGroupTagSorting from app-config.json');
    console.log('  3. (Optional) Backup app-config.json before removal');
  }
}

main()
  .catch((error) => {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
