import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stashappSceneId, shotBoundaries } = body;

    if (!stashappSceneId || !Array.isArray(shotBoundaries)) {
      return NextResponse.json(
        { error: 'stashappSceneId and shotBoundaries array are required' },
        { status: 400 }
      );
    }

    // Delete existing shot boundaries for this scene
    await prisma.shotBoundary.deleteMany({
      where: { stashappSceneId },
    });

    // Insert new shot boundaries
    const created = await prisma.shotBoundary.createMany({
      data: shotBoundaries.map((sb: { startTime: number; endTime: number }) => ({
        stashappSceneId,
        startTime: sb.startTime,
        endTime: sb.endTime,
      })),
    });

    return NextResponse.json({
      success: true,
      count: created.count,
    });
  } catch (error) {
    console.error('Error storing shot boundaries:', error);
    return NextResponse.json(
      { error: 'Failed to store shot boundaries' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stashappSceneId = searchParams.get('stashappSceneId');

    if (!stashappSceneId) {
      return NextResponse.json(
        { error: 'stashappSceneId query parameter is required' },
        { status: 400 }
      );
    }

    const shotBoundaries = await prisma.shotBoundary.findMany({
      where: { stashappSceneId: parseInt(stashappSceneId) },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({ shotBoundaries });
  } catch (error) {
    console.error('Error fetching shot boundaries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shot boundaries' },
      { status: 500 }
    );
  }
}
