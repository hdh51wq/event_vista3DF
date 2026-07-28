import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Venue from '@/models/Venue';
import { requireAdmin } from '@/lib/requireAdmin';
import { seedVenuesIfEmpty } from '@/lib/seedVenues';
import { ensureCloudinaryUrl } from '@/lib/cloudinary';

export const runtime = 'nodejs';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 80) || 'venue';
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    await seedVenuesIfEmpty();
    const venues = await Venue.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ venues });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const body = await req.json();
    const {
      slug: slugIn,
      name,
      type,
      hotel,
      address,
      location,
      dimensions,
      pricePerDay,
      capacity,
      eventTypes,
      sceneImageUrl,
      description,
      sceneIndex,
    } = body;

    if (!name || !type || !hotel || !location || !dimensions || pricePerDay == null || capacity == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!sceneImageUrl) {
      return NextResponse.json({ error: 'sceneImageUrl is required' }, { status: 400 });
    }
    if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
      return NextResponse.json({ error: 'eventTypes must be a non-empty array' }, { status: 400 });
    }

    let slug = slugIn ? String(slugIn) : slugify(name);
    const exists = await Venue.findOne({ slug });
    if (exists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const resolvedSceneImageUrl =
      (await ensureCloudinaryUrl(sceneImageUrl, 'venues')) ?? sceneImageUrl;

    const venue = await Venue.create({
      slug,
      name,
      type,
      hotel,
      address: address ?? '',
      location,
      dimensions,
      pricePerDay: Number(pricePerDay),
      capacity: Number(capacity),
      eventTypes,
      sceneImageUrl: resolvedSceneImageUrl,
      description: description ?? '',
      sceneIndex: sceneIndex != null ? Number(sceneIndex) : 0,
    });

    return NextResponse.json(venue, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
