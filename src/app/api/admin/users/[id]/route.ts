import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
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
    const body = await req.json();
    const role = body.role as 'agency' | 'admin' | undefined;
    if (role !== 'agency' && role !== 'admin') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findByIdAndUpdate(id, { role }, { new: true });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role === 'admin' ? 'admin' : 'agency',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
