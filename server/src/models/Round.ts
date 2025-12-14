// models/Round.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IRound extends Document {
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  totalQuestions?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const RoundSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    order: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: false }, // All rounds start as inactive
    totalQuestions: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.models.Round ||
  mongoose.model<IRound>("Round", RoundSchema);
