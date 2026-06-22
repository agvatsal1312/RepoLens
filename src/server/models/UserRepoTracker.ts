import { Schema, model } from 'mongoose';

const userRepoTrackerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
  lastSeenCommitHash: { type: String }, // The commit hash they last interacted with
}, { timestamps: true });

// unique compound index
userRepoTrackerSchema.index({ userId: 1, repositoryId: 1 }, { unique: true });

export const UserRepoTracker = model('UserRepoTracker', userRepoTrackerSchema);
