import { PrismaClient } from "@prisma/client";
import { stashappService } from "@/services/StashappService";

const prisma = new PrismaClient();

export type EntityType = "performers" | "tags" | "scenes";

export type EntitySyncResult = {
  fetched: number;
  upserted: number;
};

export type SyncSummary = {
  performers?: EntitySyncResult;
  tags?: EntitySyncResult;
  scenes?: EntitySyncResult;
  errors?: string[];
};

/**
 * Get the high-water mark (max stashUpdatedAt) for an entity type.
 * Returns Unix epoch (1970-01-01) if no records exist yet.
 */
async function getHighWaterMark(entity: EntityType): Promise<Date> {
  const epoch = new Date("1970-01-01T00:00:00Z");

  try {
    switch (entity) {
      case "performers": {
        const result = await prisma.stashPerformer.aggregate({
          _max: { stashUpdatedAt: true },
        });
        return result._max.stashUpdatedAt || epoch;
      }
      case "tags": {
        const result = await prisma.stashTag.aggregate({
          _max: { stashUpdatedAt: true },
        });
        return result._max.stashUpdatedAt || epoch;
      }
      case "scenes": {
        const result = await prisma.stashScene.aggregate({
          _max: { stashUpdatedAt: true },
        });
        return result._max.stashUpdatedAt || epoch;
      }
    }
  } catch (error) {
    console.warn(`Failed to get high-water mark for ${entity}, using epoch`, error);
    return epoch;
  }
}

/**
 * Normalize Stash ID from string to integer.
 */
function normalizeId(id: string): number {
  return parseInt(id, 10);
}

/**
 * Sync performers from Stash to local database.
 */
async function syncPerformers(): Promise<EntitySyncResult> {
  const highWaterMark = await getHighWaterMark("performers");
  console.log(`[Performers] High-water mark: ${highWaterMark.toISOString()}`);

  const syncResult = await stashappService.syncPerformers(highWaterMark);
  console.log(`[Performers] Fetched ${syncResult.fetched} performers from Stash`);

  if (syncResult.items.length === 0) {
    return { fetched: 0, upserted: 0 };
  }

  const syncedAt = new Date();
  let upserted = 0;

  // Upsert performers in transaction (all-or-nothing)
  await prisma.$transaction(async (tx) => {
    for (const performer of syncResult.items) {
      await tx.stashPerformer.upsert({
        where: { id: normalizeId(performer.id) },
        update: {
          name: performer.name,
          gender: performer.gender || null,
          imagePath: performer.image_path || null,
          stashUpdatedAt: new Date(performer.updated_at),
          syncedAt,
        },
        create: {
          id: normalizeId(performer.id),
          name: performer.name,
          gender: performer.gender || null,
          imagePath: performer.image_path || null,
          stashUpdatedAt: new Date(performer.updated_at),
          syncedAt,
        },
      });
      upserted++;
    }
  });

  console.log(`[Performers] Upserted ${upserted} performers`);
  return { fetched: syncResult.fetched, upserted };
}

/**
 * Sync tags from Stash to local database.
 */
async function syncTags(): Promise<EntitySyncResult> {
  const highWaterMark = await getHighWaterMark("tags");
  console.log(`[Tags] High-water mark: ${highWaterMark.toISOString()}`);

  const syncResult = await stashappService.syncTags(highWaterMark);
  console.log(`[Tags] Fetched ${syncResult.fetched} tags from Stash`);

  if (syncResult.items.length === 0) {
    return { fetched: 0, upserted: 0 };
  }

  const syncedAt = new Date();
  let upserted = 0;

  // Collect all unique parent tag IDs
  const allParentIds = new Set<number>();
  for (const tag of syncResult.items) {
    if (tag.parents) {
      for (const parent of tag.parents) {
        allParentIds.add(normalizeId(parent.id));
      }
    }
  }

  // Upsert tags and their parent relationships in transaction
  await prisma.$transaction(
    async (tx) => {
      // First pass: upsert all tags without relationships
      for (const tag of syncResult.items) {
        const tagId = normalizeId(tag.id);

        await tx.stashTag.upsert({
          where: { id: tagId },
          update: {
            name: tag.name,
            stashUpdatedAt: new Date(tag.updated_at),
            syncedAt,
          },
          create: {
            id: tagId,
            name: tag.name,
            stashUpdatedAt: new Date(tag.updated_at),
            syncedAt,
          },
        });
        upserted++;
      }

      // Fetch all existing parent tags in batch
      const existingParentTags = await tx.stashTag.findMany({
        where: { id: { in: Array.from(allParentIds) } },
        select: { id: true },
      });
      const existingParentIds = new Set(existingParentTags.map((t) => t.id));

      // Second pass: update parent relationships
      for (const tag of syncResult.items) {
        const tagId = normalizeId(tag.id);

        // Delete existing relationships
        await tx.stashTagParent.deleteMany({
          where: { childId: tagId },
        });

        // Only add parent relationships if parent tags exist in our database
        if (tag.parents && tag.parents.length > 0) {
          const validParents = tag.parents
            .map((p) => normalizeId(p.id))
            .filter((id) => existingParentIds.has(id))
            .map((parentId) => ({ childId: tagId, parentId, syncedAt }));

          if (validParents.length > 0) {
            await tx.stashTagParent.createMany({
              data: validParents,
            });
          }
        }
      }
    },
    { timeout: 30000 }
  ); // 30 second timeout

  console.log(`[Tags] Upserted ${upserted} tags`);
  return { fetched: syncResult.fetched, upserted };
}

/**
 * Sync scenes from Stash to local database.
 */
async function syncScenes(): Promise<EntitySyncResult> {
  const highWaterMark = await getHighWaterMark("scenes");
  console.log(`[Scenes] High-water mark: ${highWaterMark.toISOString()}`);

  const syncResult = await stashappService.syncScenes(highWaterMark);
  console.log(`[Scenes] Fetched ${syncResult.fetched} scenes from Stash`);

  if (syncResult.items.length === 0) {
    return { fetched: 0, upserted: 0 };
  }

  const syncedAt = new Date();
  let upserted = 0;

  // Collect all unique performer and tag IDs from scenes
  const allPerformerIds = new Set<number>();
  const allTagIds = new Set<number>();
  for (const scene of syncResult.items) {
    if (scene.performers) {
      for (const performer of scene.performers) {
        allPerformerIds.add(normalizeId(performer.id));
      }
    }
    if (scene.tags) {
      for (const tag of scene.tags) {
        allTagIds.add(normalizeId(tag.id));
      }
    }
  }

  // Fetch all existing performers and tags in batch (outside transaction)
  const existingPerformers = await prisma.stashPerformer.findMany({
    where: { id: { in: Array.from(allPerformerIds) } },
    select: { id: true },
  });
  const existingPerformerIds = new Set(existingPerformers.map((p) => p.id));

  const existingTags = await prisma.stashTag.findMany({
    where: { id: { in: Array.from(allTagIds) } },
    select: { id: true },
  });
  const existingTagIds = new Set(existingTags.map((t) => t.id));

  // Process scenes in batches to avoid transaction timeouts
  const BATCH_SIZE = 1000;
  const batches = [];
  for (let i = 0; i < syncResult.items.length; i += BATCH_SIZE) {
    batches.push(syncResult.items.slice(i, i + BATCH_SIZE));
  }

  console.log(`[Scenes] Processing ${batches.length} batches of up to ${BATCH_SIZE} scenes each`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`[Scenes] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} scenes)`);

    await prisma.$transaction(
      async (tx) => {
        for (const scene of batch) {
          const sceneId = normalizeId(scene.id);

          // Calculate aggregate filesize and duration from files
          let totalFilesize: bigint | null = null;
          let totalDuration: number | null = null;

          if (scene.files && scene.files.length > 0) {
            totalFilesize = scene.files.reduce(
              (sum, file) => sum + BigInt(file.size),
              BigInt(0)
            );
            totalDuration = scene.files.reduce(
              (sum, file) => sum + file.duration,
              0
            );
          }

          // Upsert the scene
          await tx.stashScene.upsert({
            where: { id: sceneId },
            update: {
              title: scene.title || null,
              date: scene.date ? new Date(scene.date) : null,
              details: scene.details || null,
              filesize: totalFilesize,
              duration: totalDuration,
              stashUpdatedAt: new Date(scene.updated_at),
              syncedAt,
            },
            create: {
              id: sceneId,
              title: scene.title || null,
              date: scene.date ? new Date(scene.date) : null,
              details: scene.details || null,
              filesize: totalFilesize,
              duration: totalDuration,
              stashUpdatedAt: new Date(scene.updated_at),
              syncedAt,
            },
          });
          upserted++;

          // Update performer relationships: delete existing and insert new ones
          await tx.stashScenePerformer.deleteMany({
            where: { sceneId },
          });

          if (scene.performers && scene.performers.length > 0) {
            // Filter to only performers that exist in our database
            const validPerformers = scene.performers
              .map((p) => normalizeId(p.id))
              .filter((id) => existingPerformerIds.has(id))
              .map((performerId) => ({ sceneId, performerId, syncedAt }));

            if (validPerformers.length > 0) {
              await tx.stashScenePerformer.createMany({
                data: validPerformers,
              });
            }
          }

          // Update tag relationships: delete existing and insert new ones
          await tx.stashSceneTag.deleteMany({
            where: { sceneId },
          });

          if (scene.tags && scene.tags.length > 0) {
            // Filter to only tags that exist in our database
            const validTags = scene.tags
              .map((t) => normalizeId(t.id))
              .filter((id) => existingTagIds.has(id))
              .map((tagId) => ({ sceneId, tagId, syncedAt }));

            if (validTags.length > 0) {
              await tx.stashSceneTag.createMany({
                data: validTags,
              });
            }
          }
        }
      },
      { timeout: 30000 }
    ); // 30 second timeout per batch
  }

  console.log(`[Scenes] Upserted ${upserted} scenes`);
  return { fetched: syncResult.fetched, upserted };
}

/**
 * Perform sync for specified entities.
 * @param entities - Array of entity types to sync (defaults to all)
 * @returns Summary of sync results per entity type
 */
export async function performSync(
  entities: EntityType[] = ["performers", "tags", "scenes"]
): Promise<SyncSummary> {
  const summary: SyncSummary = { errors: [] };

  console.log(`Starting sync for entities: ${entities.join(", ")}`);

  for (const entity of entities) {
    try {
      switch (entity) {
        case "performers":
          summary.performers = await syncPerformers();
          break;
        case "tags":
          summary.tags = await syncTags();
          break;
        case "scenes":
          summary.scenes = await syncScenes();
          break;
      }
    } catch (error) {
      const errorMsg = `Failed to sync ${entity}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      summary.errors?.push(errorMsg);
    }
  }

  console.log("Sync complete", summary);
  return summary;
}
