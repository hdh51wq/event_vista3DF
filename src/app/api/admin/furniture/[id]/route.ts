import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Furniture from '@/models/Furniture';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    await connectDB();
    const body = await req.json();
    const allowed = ['label', 'price', 'defaultWidth', 'defaultHeight', 'views'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    const item = await Furniture.findOneAndUpdate({ id: decodeURIComponent(id) }, update, {
      new: true,
      runValidators: true,
    });
    if (!item) return NextResponse.json({ error: 'Furniture not found' }, { status: 404 });

    return NextResponse.json(item);
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
    await connectDB();
    const item = await Furniture.findOneAndDelete({ id: decodeURIComponent(id) });
    if (!item) return NextResponse.json({ error: 'Furniture not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
