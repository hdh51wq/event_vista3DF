import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Project from '@/models/Project';
import Venue from '@/models/Venue';
import Furniture from '@/models/Furniture';
import { requireAdmin } from '@/lib/requireAdmin';
import { seedVenuesIfEmpty } from '@/lib/seedVenues';
import { seedFurnitureIfEmpty } from '@/lib/seedFurniture';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    await seedVenuesIfEmpty();
    await seedFurnitureIfEmpty();

    const [totalUsers, totalProjects, totalVenues, totalFurniture] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Venue.countDocuments(),
      Furniture.countDocuments(),
    ]);

    return NextResponse.json({
      totalUsers,
      totalProjects,
      totalVenues,
      totalFurniture,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
