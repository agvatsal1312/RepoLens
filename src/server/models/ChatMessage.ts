import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  repositoryId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  createdAt: Date;
}

const chatMessageSchema = new Schema({
  repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  sources: [{ type: String }],
  createdAt: { type: Date, default: Date.now, index: true },
});

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
