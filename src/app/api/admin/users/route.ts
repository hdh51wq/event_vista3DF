import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Project from '@/models/Project';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const users = await User.find({}).select('name email role createdAt').lean();

    const withCounts = await Promise.all(
      users.map(async (u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: (u.role === 'admin' ? 'admin' : 'agency') as 'agency' | 'admin',
        projectCount: await Project.countDocuments({ userId: u._id }),
        createdAt: u.createdAt,
      }))
    );

    return NextResponse.json({ users: withCounts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Query id is required' }, { status: 400 });
    }

    await connectDB();
    if (id === auth.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    await Project.deleteMany({ userId: id });
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
