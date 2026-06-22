import { Request, Response } from 'express';
import { generateInterviewPrep } from '../services/interview.service';
import { Repository } from '../models/Repository';
import { UserRepoTracker } from '../models/UserRepoTracker';
import { acquireLock, releaseLock } from '../redis';

export const getInterviewPrep = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const checkOnly = req.query.check === 'true';
    const reqCommitHash = req.query.commitHash as string;

    const repo = await Repository.findById(id);
    const tracker = await UserRepoTracker.findOne({ userId, repositoryId: id });

    if (!repo || !tracker) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    const targetHash = reqCommitHash || tracker.lastSeenCommitHash || repo.latestCommitHash;

    if (repo.interviewPrep && repo.interviewPrep.length > 0) {
      const existingData = repo.interviewPrep.find(p => p.commitHash === targetHash);
      if (existingData) {
         res.json(existingData.data);
         return;
      }
    }
    
    if (checkOnly) {
      if (repo.interviewPrep && repo.interviewPrep.length > 0) {
        // Return full array of versions on check so UI can display old ones
        res.json(repo.interviewPrep);
      } else {
        res.json([]);
      }
      return;
    }

    const lockKey = `repo:interview:${id}:${targetHash}`;
    let lockToken = null;
    try {
      lockToken = await acquireLock(lockKey, 60000); // 60s lock
      if (!lockToken) {
        res.status(429).json({ error: 'Interview questions are currently being generated. Please wait and try again.' });
        return;
      }
      
      // Check again inside the lock to see if someone just finished it
      const refreshedRepo = await Repository.findById(id);
      if (refreshedRepo && refreshedRepo.interviewPrep && refreshedRepo.interviewPrep.length > 0) {
         const existingData = refreshedRepo.interviewPrep.find(p => p.commitHash === targetHash);
         if (existingData) {
            res.json(existingData.data);
            return;
         }
      }

      const result = await generateInterviewPrep(id, targetHash);
      res.json(result);
    } finally {
      if (lockToken) {
         await releaseLock(lockKey, lockToken);
      }
    }
  } catch (error) {
    console.error('Interview prep error:', error);
    res.status(500).json({ error: 'Server error generating interview prep' });
  }
};
