import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User'; // Assuming User model is in User.ts

export interface IDetectedFace {
  // Storing the descriptor of the face found in *this* photo
  faceDescriptorInPhoto: number[];
  matchedUser?: IUser['_id']; // Reference to User ID (guest) if a match is found
  // Optional: store bounding box if needed for frontend display
  // box?: { x: number, y: number, width: number, height: number };
}

export interface IPhoto extends Document {
  uploader: IUser['_id']; // Reference to User ID (bride/groom)
  imageUrl: string;
  cloudinaryPublicId: string;
  detectedFaces: IDetectedFace[];
  isProcessed: boolean; // Flag to indicate if face matching has been attempted
  notifiedGuests: IUser['_id'][]; // Array of User IDs (guests) who have been notified about this photo
}

const DetectedFaceSchema: Schema = new Schema({
  faceDescriptorInPhoto: { type: [Number], required: true },
  matchedUser: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
  // box: { x: Number, y: Number, width: Number, height: Number },
}, { _id: false });

const PhotoSchema: Schema = new Schema({
  uploader: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  imageUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  detectedFaces: { type: [DetectedFaceSchema], default: [] },
  isProcessed: { type: Boolean, default: false },
  notifiedGuests: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Array of User refs
}, { timestamps: true });

export default mongoose.models.Photo || mongoose.model<IPhoto>('Photo', PhotoSchema);
