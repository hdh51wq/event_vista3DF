import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Furniture from '@/models/Furniture';
import { requireAdmin } from '@/lib/requireAdmin';
import { seedFurnitureIfEmpty } from '@/lib/seedFurniture';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    await seedFurnitureIfEmpty();
    const items = await Furniture.find({}).sort({ id: 1 }).lean();
    return NextResponse.json({ items });
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
    const { id, label, price, defaultWidth, defaultHeight, views } = body;

    if (!id || !label || !views?.front || defaultWidth == null || defaultHeight == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await Furniture.findOne({ id: String(id) });
    if (existing) {
      return NextResponse.json({ error: 'Furniture id already exists' }, { status: 400 });
    }

    const item = await Furniture.create({
      id: String(id),
      label: String(label),
      price: price != null ? Number(price) : 0,
      defaultWidth: Number(defaultWidth),
      defaultHeight: Number(defaultHeight),
      views: {
        front: views.front,
        back: views.back,
        left: views.left,
        right: views.right,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
