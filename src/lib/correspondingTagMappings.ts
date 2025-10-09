import { prisma } from './prisma';

/**
 * Get corresponding tag ID for a source tag ID from the database
 * Returns null if no mapping exists
 */
export async function getCorrespondingTagId(sourceTagId: number): Promise<number | null> {
  const mapping = await prisma.correspondingTagMapping.findUnique({
    where: { sourceTagId },
  });

  return mapping?.correspondingTagId ?? null;
}

/**
 * Get all corresponding tag mappings as a Map for efficient lookups
 * Key: sourceTagId, Value: correspondingTagId
 */
export async function getAllCorrespondingTagMappings(): Promise<Map<number, number>> {
  const mappings = await prisma.correspondingTagMapping.findMany();

  const map = new Map<number, number>();
  for (const mapping of mappings) {
    map.set(mapping.sourceTagId, mapping.correspondingTagId);
  }

  return map;
}

/**
 * Get all source tag IDs that map to a specific corresponding tag
 */
export async function getSourceTagIdsForCorrespondingTag(correspondingTagId: number): Promise<number[]> {
  const mappings = await prisma.correspondingTagMapping.findMany({
    where: { correspondingTagId },
  });

  return mappings.map(m => m.sourceTagId);
}
