import { Schema, model, Types } from 'mongoose';

const repositorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  githubUrl: { type: String, required: true },
  name: { type: String, required: true },
  owner: { type: String, required: true },
  language: { type: String },
  status: { type: String, enum: ['pending', 'cloning', 'parsing', 'syncing', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String },
  latestCommitHash: { type: String }, // To track the current repository version
  summary: { type: String },
  features: [{ type: Schema.Types.Mixed }],
  techStack: { type: Schema.Types.Mixed },
  stats: { type: Schema.Types.Mixed },
  folderSummary: [{ type: Schema.Types.Mixed }],
  architecture: { type: Schema.Types.Mixed },
  interviewPrep: [{ 
    commitHash: String, 
    data: Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
  }],
  documents: [{ 
    commitHash: String, 
    data: Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export const Repository = model('Repository', repositorySchema);
