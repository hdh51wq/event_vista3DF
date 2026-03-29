import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { comparePassword, signToken } from '@/lib/auth';
import { seedAdmin } from '@/lib/seedAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    await seedAdmin();
    await connectDB();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ id: user._id });

    const role = (user as any).role === 'admin' ? 'admin' : 'agency';

    return NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        agencyName: user.agencyName,
        role,
      },
      token,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
