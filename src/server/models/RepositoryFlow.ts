import { Schema, model } from 'mongoose';

const repositoryFlowSchema = new Schema({
  repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  query: { type: String, required: true },
  title: { type: String, required: true },
  mermaid: { type: String, required: true },
  summary: { type: String, required: true },
  steps: [{
    title: { type: String },
    description: { type: String }
  }]
}, { timestamps: true });

export const RepositoryFlow = model('RepositoryFlow', repositoryFlowSchema);
