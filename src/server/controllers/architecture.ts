import { Request, Response } from 'express';
import { generateArchitectureData } from '../services/architecture.service';
import { Repository } from '../models/Repository';
import { UserRepoTracker } from '../models/UserRepoTracker';
import { acquireLock, releaseLock } from '../redis';

export const getArchitecture = async (req: Request, res: Response): Promise<void> => {
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

    if ((repo as any).architecture) {
      res.json((repo as any).architecture);
      return;
    }

    const lockKey = `repo:arch:${id}`;
    let lockToken = null;
    try {
      lockToken = await acquireLock(lockKey, 60000); // 60s lock
      if (!lockToken) {
        res.status(429).json({ error: 'Architecture is currently being generated. Please wait and try again.' });
        return;
      }

      // Check again after acquiring lock
      const refreshedRepo = await Repository.findById(id);
      if (refreshedRepo && (refreshedRepo as any).architecture) {
         res.json((refreshedRepo as any).architecture);
         return;
      }

      // Generate if not exists
      const result = await generateArchitectureData(id);
      res.json(result);
    } finally {
      if (lockToken) {
         await releaseLock(lockKey, lockToken);
      }
    }
  } catch (error) {
    console.error('Architecture error:', error);
    res.status(500).json({ error: 'Server error generating architecture' });
  }
};
