import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { RepositoryFile } from '../models/RepositoryFile';
import { Repository } from '../models/Repository';
import { UserRepoTracker } from '../models/UserRepoTracker';

export const getFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const tracker = await UserRepoTracker.findOne({ repositoryId: id, userId });
    if (!tracker) {
      res.status(404).json({ error: 'Repository not found in your list' });
      return;
    }

    const repo = await Repository.findById(id);
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    let repoObjId;
    try {
        repoObjId = new Types.ObjectId(id);
    } catch (e) {
        console.error("ObjectId conversion failed:", e);
        repoObjId = id; // Fallback
    }
    const repoFilesCount = await RepositoryFile.countDocuments();
    const files = await RepositoryFile.find({ repositoryId: repoObjId }).select('-content');
    console.log(`getFiles for repo ${id} (userId: ${userId}): mapped ${files.length} files. Total files in DB: ${repoFilesCount}`);
    
    // Check if files exist for a string id instead
    if (files.length === 0) {
        const filesWithString = await RepositoryFile.find({ repositoryId: id }).select('-content');
        console.log(`Fallback fetch with string id gave ${filesWithString.length} files`);
        if (filesWithString.length > 0) {
            res.json(filesWithString);
            return;
        }
    }

    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching files' });
  }
};

export const getFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, fileId } = req.params;
    const userId = (req as any).userId;

    const tracker = await UserRepoTracker.findOne({ repositoryId: id, userId });
    if (!tracker) {
      res.status(404).json({ error: 'Repository not found in your list' });
      return;
    }

    const repo = await Repository.findById(id);
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    const file = await RepositoryFile.findOne({ _id: fileId, repositoryId: id });
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.json(file);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching file' });
  }
};
