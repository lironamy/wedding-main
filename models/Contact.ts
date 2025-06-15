import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User'; // Assuming User model is in User.ts

export interface IContact extends Document {
  name: string;
  phoneNumber: string;
  invitationSent: boolean;
  invitationToken?: string; // Optional, generated when sending invitation
  guestUser?: IUser['_id']; // Reference to User ID (guest)
  notifyNewPhotos: boolean; // Whether to notify about new photos
  createdBy: IUser['_id']; // Reference to the user who created this contact
}

const ContactSchema: Schema = new Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  invitationSent: { type: Boolean, default: false },
  invitationToken: { type: String, unique: true, sparse: true }, // sparse allows multiple nulls but unique values otherwise
  guestUser: { type: Schema.Types.ObjectId, ref: 'User' },
  notifyNewPhotos: { type: Boolean, default: false }, // Default to false, can be enabled later
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Required field to track who created the contact
}, { timestamps: true });

export default mongoose.models.Contact || mongoose.model<IContact>('Contact', ContactSchema);
