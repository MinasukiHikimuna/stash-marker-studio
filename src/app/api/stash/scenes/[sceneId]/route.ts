import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Scene, Performer } from '@/services/StashappService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
    const { sceneId } = await params;

    // Fetch scene from local database with tags and performers
    const dbScene = await prisma.stashScene.findUnique({
      where: { id: parseInt(sceneId) },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        performers: {
          include: {
            performer: true,
          },
        },
      },
    });

    if (!dbScene) {
      return NextResponse.json(
        { error: 'Scene not found in local database' },
        { status: 404 }
      );
    }

    // Transform database scene to match StashappService Scene format
    const scene: Scene = {
      id: dbScene.id.toString(),
      title: dbScene.title || '',
      paths: {
        preview: '', // These URLs need to come from Stashapp config
        vtt: undefined,
        sprite: undefined,
        screenshot: undefined,
      },
      tags: dbScene.tags.map((st) => ({
        id: st.tag.id.toString(),
        name: st.tag.name,
        description: null,
      })),
      performers: dbScene.performers.map((sp): Performer => ({
        id: sp.performer.id.toString(),
        name: sp.performer.name,
        gender: (sp.performer.gender as Performer['gender']) || '',
      })),
    };

    return NextResponse.json(scene);
  } catch (error) {
    console.error('Error fetching scene from local database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scene from local database' },
      { status: 500 }
    );
  }
}
