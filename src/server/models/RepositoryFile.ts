import { Schema, model, Types } from 'mongoose';

const repositoryFileSchema = new Schema({
  repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
  filePath: { type: String, required: true },
  fileType: { type: String, required: true },
  content: { type: String },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

export const RepositoryFile = model('RepositoryFile', repositoryFileSchema);
