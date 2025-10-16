import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Performer } from '@/services/StashappService';

export async function GET() {
  try {
    // Fetch all performers from local database
    const dbPerformers = await prisma.stashPerformer.findMany({
      orderBy: { name: 'asc' },
    });

    // Transform database performers to match StashappService Performer format
    const performers: Performer[] = dbPerformers.map((dbPerformer) => ({
      id: dbPerformer.id.toString(),
      name: dbPerformer.name,
      gender: (dbPerformer.gender as Performer['gender']) || '',
    }));

    // Return in same format as StashappService.getAllPerformers()
    return NextResponse.json({
      findPerformers: {
        count: performers.length,
        performers,
      },
    });
  } catch (error) {
    console.error('Error fetching performers from local database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performers from local database' },
      { status: 500 }
    );
  }
}
