import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShotBoundarySource } from '@/core/shotBoundary/types';

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { startTime, endTime, source } = body;

    if (startTime === undefined || endTime === undefined) {
      return NextResponse.json(
        { error: 'startTime and endTime are required' },
        { status: 400 }
      );
    }

    const updateData: {
      startTime: number;
      endTime: number;
      source?: ShotBoundarySource;
    } = {
      startTime,
      endTime,
    };

    // If source is provided, update it (used when splitting PySceneDetect boundaries)
    if (source !== undefined) {
      updateData.source = source;
    }

    const updated = await prisma.shotBoundary.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ shotBoundary: updated });
  } catch (error) {
    console.error('Error updating shot boundary:', error);
    return NextResponse.json(
      { error: 'Failed to update shot boundary' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    await prisma.shotBoundary.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting shot boundary:', error);
    return NextResponse.json(
      { error: 'Failed to delete shot boundary' },
      { status: 500 }
    );
  }
}
