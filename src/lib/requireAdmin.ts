import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { getUserIdFromRequest } from '@/lib/auth';
export type AdminAuthResult =
  | { ok: true; userId: string; user: { role?: string; _id: unknown } }
  | { ok: false; response: NextResponse };

export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  await connectDB();
  const user = await User.findById(userId);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const role = user.role ?? 'agency';
  if (role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId, user };
}
