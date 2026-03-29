import mongoose, { Schema, Document } from 'mongoose';

export type VenueType = 'Hotel' | 'Exhibition Space';
export type EventTypeVenue = 'Wedding' | 'Gala Dinner' | 'Conference';

export interface IVenue extends Document {
  slug: string; // stable id for Project.venueId (e.g. grand-hall)
  name: string;
  type: VenueType;
  hotel: string;
  address: string;
  location: string;
  dimensions: string;
  pricePerDay: number;
  capacity: number;
  eventTypes: EventTypeVenue[];
  sceneImageUrl: string;
  description?: string;
  sceneIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const VenueSchema: Schema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['Hotel', 'Exhibition Space'], required: true },
    hotel: { type: String, required: true },
    address: { type: String, default: '' },
    location: { type: String, required: true },
    dimensions: { type: String, required: true },
    pricePerDay: { type: Number, required: true },
    capacity: { type: Number, required: true },
    eventTypes: [{ type: String, enum: ['Wedding', 'Gala Dinner', 'Conference'] }],
    sceneImageUrl: { type: String, required: true },
    description: { type: String },
    sceneIndex: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== 'production' && mongoose.models.Venue) {
  delete mongoose.models.Venue;
}

export default mongoose.models.Venue || mongoose.model<IVenue>('Venue', VenueSchema);
