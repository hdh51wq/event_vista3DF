import connectDB from '@/lib/mongoose';
import Venue from '@/models/Venue';
import { VENUES } from '@/lib/venues';

/** Seeds MongoDB venues from static `VENUES` when collection is empty. */
export async function seedVenuesIfEmpty() {
  await connectDB();
  const count = await Venue.countDocuments();
  if (count > 0) return;

  const docs = VENUES.map((v) => {
    const eventTypes =
      v.eventTypes && v.eventTypes.length > 0
        ? v.eventTypes
        : (['Wedding', 'Gala Dinner', 'Conference'] as const);
    return {
      slug: v.id,
      name: v.name,
      type: 'Hotel' as const,
      hotel: v.hotel,
      address: '',
      location: v.location,
      dimensions: v.dimensions,
      pricePerDay: v.pricePerDay,
      capacity: v.capacity,
      eventTypes,
      sceneImageUrl: v.thumbnail,
      description: v.description,
      sceneIndex: v.sceneIndex,
    };
  });

  await Venue.insertMany(docs);
  console.log(`Seeded ${docs.length} venues`);
}
