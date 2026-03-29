import mongoose, { Schema, Document } from 'mongoose';

export interface IFurniture extends Document {
  id: string; // catalogue id e.g. chair
  label: string;
  price: number;
  defaultWidth: number;
  defaultHeight: number;
  views: {
    front: string;
    back?: string;
    left?: string;
    right?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FurnitureSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    price: { type: Number, default: 0 },
    defaultWidth: { type: Number, required: true },
    defaultHeight: { type: Number, required: true },
    views: {
      front: { type: String, required: true },
      back: String,
      left: String,
      right: String,
    },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== 'production' && mongoose.models.Furniture) {
  delete mongoose.models.Furniture;
}

export default mongoose.models.Furniture || mongoose.model<IFurniture>('Furniture', FurnitureSchema);
