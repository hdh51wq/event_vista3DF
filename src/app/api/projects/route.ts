import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Project from '@/models/Project';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await Project.find({ userId }).sort({ updatedAt: -1 });
    return NextResponse.json(projects);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const EVENT_THUMBNAILS: Record<string, string> = {
  'Wedding':      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=2400&auto=format&fit=crop',
  'Conference':   'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?q=80&w=2400&auto=format&fit=crop',
  'Gala Dinner':  'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?q=80&w=2400&auto=format&fit=crop',
};

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, client, event, eventType, eventDate, location, budget, currency, billingStatus, status, venueId, customScenes, customScenesOnly, sceneCount, thumbnail: thumbnailFromBody } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const resolvedType = eventType ?? 'Wedding';
    // Templates pass the scene image as the thumbnail; otherwise fall back
    // to the event-type photo.
    const thumbnail = thumbnailFromBody ?? EVENT_THUMBNAILS[resolvedType] ?? EVENT_THUMBNAILS['Wedding'];
    // sceneCount was never set on create, so the dashboard showed "0 scenes"
    // for every project. Default to the number of scenes the project will
    // actually open with (event-type defaults, or the template's scenes).
    const DEFAULT_SCENE_COUNTS: Record<string, number> = { Wedding: 3, Conference: 4, 'Gala Dinner': 3 };
    const resolvedSceneCount = sceneCount ?? (customScenesOnly ? (customScenes?.length ?? 0) : (DEFAULT_SCENE_COUNTS[resolvedType] ?? 3));

    const project = await Project.create({
      name,
      client,
      event,
      eventType:     resolvedType,
      eventDate:     eventDate ? new Date(eventDate) : undefined,
      location,
      status:        status        ?? 'Draft',
      thumbnail,
      sceneCount:    resolvedSceneCount,
      budget:        budget        ?? 0,
      currency:      currency      ?? 'USD',
      billingStatus: billingStatus ?? 'pending',
      venueId:       venueId ?? undefined,
      customScenes:  Array.isArray(customScenes) ? customScenes : undefined,
      customScenesOnly: customScenesOnly ?? false,
      userId,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
