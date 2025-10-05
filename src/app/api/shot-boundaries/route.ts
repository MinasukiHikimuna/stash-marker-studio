import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stashappSceneId, shotBoundaries, startTime, endTime } = body;

    // Bulk import mode (from PySceneDetect)
    if (shotBoundaries && Array.isArray(shotBoundaries)) {
      if (!stashappSceneId) {
        return NextResponse.json(
          { error: 'stashappSceneId is required for bulk import' },
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
    }

    // Single shot boundary creation mode
    if (stashappSceneId && startTime !== undefined && endTime !== undefined) {
      const created = await prisma.shotBoundary.create({
        data: {
          stashappSceneId: parseInt(stashappSceneId),
          startTime,
          endTime,
        },
      });

      return NextResponse.json({ shotBoundary: created });
    }

    return NextResponse.json(
      { error: 'Invalid request: provide either shotBoundaries array for bulk import or stashappSceneId/startTime/endTime for single creation' },
      { status: 400 }
    );
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
