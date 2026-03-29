import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import { getUserIdFromRequest } from '@/lib/auth';
import Furniture from '@/models/Furniture';
import { seedFurnitureIfEmpty } from '@/lib/seedFurniture';

export const runtime = 'nodejs';

/** Authenticated catalogue read (agency + admin). */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    await seedFurnitureIfEmpty();

    const docs = await Furniture.find({}).lean();
    const items = docs.map((d) => ({
      id: d.id,
      label: d.label,
      views: d.views,
      defaultWidth: d.defaultWidth,
      defaultHeight: d.defaultHeight,
      price: d.price ?? 0,
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
