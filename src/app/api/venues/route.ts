import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Project from '@/models/Project';
import { getUserIdFromRequest } from '@/lib/auth';
import { VENUES, Venue } from '@/lib/venues';

export const runtime = 'nodejs';

/**
 * GET /api/venues?date=YYYY-MM-DD&projectId=xxx
 * Returns venues with availability for the given date.
 * A venue is unavailable if another project (excluding projectId) has the same eventDate (same day) and that venueId.
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

    if (!dateStr) {
      return NextResponse.json({ error: 'Query "date" is required (YYYY-MM-DD)' }, { status: 400 });
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

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

    const venues = VENUES.map((v: Venue) => ({
      ...v,
      available: !bookedByVenueId[v.id],
      ...(bookedByVenueId[v.id] && { bookedBy: bookedByVenueId[v.id] }),
    }));

    return NextResponse.json({ venues });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
