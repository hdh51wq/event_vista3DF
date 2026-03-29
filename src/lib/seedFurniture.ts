import connectDB from '@/lib/mongoose';
import Furniture from '@/models/Furniture';
import { FALLBACK_FURNITURE_ITEMS } from '@/lib/furniture';

export async function seedFurnitureIfEmpty() {
  await connectDB();
  const count = await Furniture.countDocuments();
  if (count > 0) return;

  const docs = FALLBACK_FURNITURE_ITEMS.map((f) => ({
    id: f.id,
    label: f.label,
    price: f.price ?? 0,
    defaultWidth: f.defaultWidth,
    defaultHeight: f.defaultHeight,
    views: f.views,
  }));

  await Furniture.insertMany(docs);
  console.log(`Seeded ${docs.length} furniture items`);
}
