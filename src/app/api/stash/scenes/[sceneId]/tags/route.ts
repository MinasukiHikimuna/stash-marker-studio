import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Tag } from '@/services/StashappService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
    const { sceneId } = await params;

    // Fetch scene tags from local database
    const sceneTags = await prisma.stashSceneTag.findMany({
      where: { sceneId: parseInt(sceneId) },
      include: {
        tag: true,
      },
    });

    // Transform database tags to match StashappService Tag format
    const tags: Tag[] = sceneTags.map((st) => ({
      id: st.tag.id.toString(),
      name: st.tag.name,
      description: null,
    }));

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching scene tags from local database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scene tags from local database' },
      { status: 500 }
    );
  }
}
