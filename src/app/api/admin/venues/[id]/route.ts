import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Venue from '@/models/Venue';
import { requireAdmin } from '@/lib/requireAdmin';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await connectDB();
    const body = await req.json();
    const allowed = [
      'slug',
      'name',
      'type',
      'hotel',
      'address',
      'location',
      'dimensions',
      'pricePerDay',
      'capacity',
      'eventTypes',
      'sceneImageUrl',
      'description',
      'sceneIndex',
    ];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    const venue = await Venue.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 });

    return NextResponse.json(venue);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await connectDB();
    const venue = await Venue.findByIdAndDelete(id);
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
