import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Project from '@/models/Project';
import Venue from '@/models/Venue';
import { getUserIdFromRequest } from '@/lib/auth';
import { seedVenuesIfEmpty } from '@/lib/seedVenues';
import type { Venue as ClientVenue } from '@/lib/venues';

export const runtime = 'nodejs';

/**
 * GET /api/venues?date=YYYY-MM-DD&projectId=xxx&eventType=Wedding
 * Venues from MongoDB filtered by eventTypes; availability by date + venueId (slug).
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const projectId = searchParams.get('projectId');
    const eventType = searchParams.get('eventType') as 'Wedding' | 'Conference' | 'Gala Dinner' | null;

    if (!dateStr) {
      return NextResponse.json({ error: 'Query "date" is required (YYYY-MM-DD)' }, { status: 400 });
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    await seedVenuesIfEmpty();

    const filter: Record<string, unknown> = {};
    if (eventType) {
      filter.eventTypes = { $in: [eventType] };
    }

    const dbVenues = await Venue.find(filter).lean();

    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    const booked = await Project.find({
      eventDate: { $gte: startOfDay, $lt: endOfDay },
      venueId: { $exists: true, $ne: '' },
      _id: projectId ? { $ne: projectId } : { $exists: true },
    })
      .select('venueId name')
      .lean();

    const bookedByVenueId: Record<string, string> = {};
    booked.forEach((p: { venueId?: string; name?: string }) => {
      if (p.venueId) bookedByVenueId[p.venueId] = p.name ?? 'Another project';
    });

    const venues = dbVenues.map((v) => {
      const id = v.slug;
      const client: ClientVenue & {
        available: boolean;
        bookedBy?: string;
        eventTypes?: string[];
      } = {
        id,
        name: v.name,
        hotel: v.hotel,
        location: v.location,
        dimensions: v.dimensions,
        pricePerDay: v.pricePerDay,
        capacity: v.capacity,
        sceneIndex: v.sceneIndex ?? 0,
        thumbnail: v.sceneImageUrl,
        description: v.description ?? '',
        eventTypes: v.eventTypes as string[],
        available: !bookedByVenueId[id],
        ...(bookedByVenueId[id] && { bookedBy: bookedByVenueId[id] }),
      };
      return client;
    });

    return NextResponse.json({ venues });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
