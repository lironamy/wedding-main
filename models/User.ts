import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  userType: 'bride/groom' | 'guest';
  name: string;
  email: string;
  password?: string; // Optional because guests might not have a password initially
  phoneNumber: string;
  selfiePath?: string; // Optional as it's mainly for guests
  isVerified: boolean;
  faceEncoding?: number[]; // Stores the face descriptor
  weddingDate?: string; // Date of the wedding
  weddingTime?: string; // Time of the wedding
  weddingVenue?: string; // Venue of the wedding
}

const UserSchema: Schema = new Schema({
  userType: { type: String, required: true, enum: ['bride/groom', 'guest'] },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  phoneNumber: { type: String, required: true },
  selfiePath: { type: String },
  isVerified: { type: Boolean, default: false },
  faceEncoding: { type: [Number], default: undefined }, // Array of numbers for the descriptor
  weddingDate: { type: String },
  weddingTime: { type: String },
  weddingVenue: { type: String },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
