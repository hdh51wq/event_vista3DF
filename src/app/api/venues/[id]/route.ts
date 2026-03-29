import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Venue from '@/models/Venue';
import { getUserIdFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

/**
 * GET /api/venues/:id — single venue for editors (JWT required).
 * `id` is the venue slug (Project.venueId) or a valid Mongo ObjectId.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await connectDB();

    let venue = await Venue.findOne({ slug: id }).lean();
    if (!venue && mongoose.Types.ObjectId.isValid(id)) {
      venue = await Venue.findById(id).lean();
    }

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    return NextResponse.json(venue);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
