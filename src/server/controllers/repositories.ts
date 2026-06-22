import { Request, Response } from 'express';
import { z } from 'zod';
import { Repository } from '../models/Repository';
import { RepositoryFile } from '../models/RepositoryFile';
import { UserRepoTracker } from '../models/UserRepoTracker';
import { ChatMessage } from '../models/ChatMessage';
import { RepositoryFlow } from '../models/RepositoryFlow';
import { processRepository } from '../services/repository.service';
import { acquireLock, releaseLock } from '../redis';

const analyzeSchema = z.object({
  githubUrl: z.string().url(),
});

export const analyzeRepository = async (req: Request, res: Response): Promise<void> => {
  try {
    const { githubUrl } = analyzeSchema.parse(req.body);
    const userId = (req as any).userId;

    const normalizedUrl = githubUrl.replace(/\/$/, '').toLowerCase();
    
    // Extract name and owner from url
    const parts = normalizedUrl.split('/');
    const name = parts.pop() || 'Unknown';
    const owner = parts.pop() || 'Unknown';

    // Validate the GitHub repository URL by getting latest commit hash
    let latestCommitHash = "";
    try {
      const githubApiUrl = `https://api.github.com/repos/${owner}/${name}/commits?per_page=1`;
      const repoCheck = await fetch(githubApiUrl, {
        headers: {
          'User-Agent': 'RepoLens-App'
        }
      });

      if (!repoCheck.ok) {
        res.status(400).json({ error: 'Invalid URL. Repository or username does not exist.' });
        return;
      }
      
      const commits = await repoCheck.json();
      if (commits && commits.length > 0) {
        latestCommitHash = commits[0].sha;
      }
    } catch (e) {
      res.status(400).json({ error: 'Failed to validate repository URL.' });
      return;
    }

    // Check if repo already exists globally
    const lockKey = `repo:analyze:${normalizedUrl}`;
    let lockToken = null;
    
    try {
      lockToken = await acquireLock(lockKey, 30000); // 30 sec lock
      if (!lockToken) {
        // If we can't get the lock, someone else is actively adding/processing this exact repo
        // Wait a brief moment or just inform the client
        res.status(429).json({ error: 'Repository analysis is currently being initiated by another request. Please try again soon.' });
        return;
      }
      
      let repo = await Repository.findOne({ 
        githubUrl: { $regex: new RegExp(`^${normalizedUrl}$`, 'i') } 
      });

      if (repo) {
        // It exists! 
        
        // Update tracker
        await UserRepoTracker.findOneAndUpdate(
          { userId, repositoryId: repo._id },
          { $setOnInsert: { lastSeenCommitHash: repo.latestCommitHash || latestCommitHash } },
          { upsert: true, new: true }
        );
        
        // If repo has failed -> reset and retry!
        if (repo.status === 'failed') {
           repo.status = 'pending';
           repo.errorMessage = undefined;
           repo.latestCommitHash = latestCommitHash;
           repo.summary = undefined;
           repo.features = [];
           repo.folderSummary = [];
           repo.techStack = undefined;
           await repo.save();
           processRepository(repo._id.toString(), repo.githubUrl, latestCommitHash);
        }
        // If repo is fully analyzed but the commit hash has changed -> trigger diff update!
        else if (repo.status === 'completed' && repo.latestCommitHash && repo.latestCommitHash !== latestCommitHash) {
           repo.status = 'syncing'; // Set status to syncing
           const oldHash = repo.latestCommitHash;
           repo.latestCommitHash = latestCommitHash;
           await repo.save();
           // Process diff update in background
           processRepository(repo._id.toString(), repo.githubUrl, latestCommitHash, oldHash);
        }

        // We fake the loading experience slightly for UX consistency 
        if (repo.status === 'completed') {
           await new Promise(r => setTimeout(r, 2500));
        }

        res.status(202).json({
          message: 'Repository analysis started',
          repository: repo
        });
        return;
      }

      // If new repo
      repo = new Repository({
        userId, // Creator
        githubUrl: normalizedUrl, // Save normalized
        name,
        owner,
        status: 'pending',
        latestCommitHash
      });

      await repo.save();
      
      // Create mapping for the first user
      await UserRepoTracker.create({
         userId,
         repositoryId: repo._id,
         lastSeenCommitHash: latestCommitHash
      });

      // Start background processing
      processRepository(repo._id.toString(), normalizedUrl, latestCommitHash);

      res.status(202).json({
        message: 'Repository analysis started',
        repository: repo
      });
    } finally {
      if (lockToken) {
         await releaseLock(lockKey, lockToken);
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Server error starting analysis' });
    }
  }
};

export const getRepositories = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    // Find trackers to get user's repos
    const trackers = await UserRepoTracker.find({ userId }).populate('repositoryId');
    const repos = trackers.map(t => t.repositoryId).filter(Boolean); // Extract repo objects
    res.json(repos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching repositories' });
  }
};

export const getRepository = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    
    const tracker = await UserRepoTracker.findOne({ userId, repositoryId: id });
    const repo = await Repository.findById(id);
    
    if (!tracker || !repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }
    
    let needsSave = false;
    let hasUpdated = false;
    
    if (repo.status === 'completed') {
       try {
         // Throttle github checks to avoid draining the 60req/hr rate limit instantly.
         // We'll only check if the repo was last updated more than 2 minutes ago to save limit
         const now = new Date().getTime();
         const lastUpdated = new Date(repo.updatedAt).getTime();
         
         // In a real app we'd cache this in redis, for now we will just use 2 minute threshold 
         if (now - lastUpdated > 120000) {
             const syncLockKey = `repo:sync:${id}`;
             const syncLockToken = await acquireLock(syncLockKey, 10000);
             if (syncLockToken) {
               try {
                 const githubApiUrl = `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?per_page=1`;
                 const repoCheck = await fetch(githubApiUrl, {
                   headers: { 'User-Agent': 'RepoLens-App' }
                 });
                 if (repoCheck.ok) {
                   const commits = await repoCheck.json();
                   if (commits && commits.length > 0) {
                     const liveHash = commits[0].sha;
                     if (repo.latestCommitHash && liveHash !== repo.latestCommitHash) {
                       // Refresh repo inside lock to be absolutely sure
                       const verifiedRepo = await Repository.findById(id);
                       if (verifiedRepo && verifiedRepo.status === 'completed' && verifiedRepo.latestCommitHash !== liveHash) {
                         verifiedRepo.status = 'syncing';
                         const oldHash = verifiedRepo.latestCommitHash;
                         verifiedRepo.latestCommitHash = liveHash;
                         await verifiedRepo.save();
                         
                         // Start background sync
                         processRepository(verifiedRepo._id.toString(), verifiedRepo.githubUrl, liveHash, oldHash);
                         
                         const repoObj = verifiedRepo.toObject();
                         // @ts-ignore
                         repoObj.hasUpdatedOnGitHub = false;
                         
                         await releaseLock(syncLockKey, syncLockToken);
                         res.json(repoObj);
                         return;
                       }
                     }
                   }
                 }
               } finally {
                 await releaseLock(syncLockKey, syncLockToken);
               }
             }
         }
       } catch (e) {
         console.error('Failed to check latest commit', e);
       }

       if (tracker.lastSeenCommitHash && repo.latestCommitHash && tracker.lastSeenCommitHash !== repo.latestCommitHash) {
          hasUpdated = true;
          // IMPORTANT: we only acknowledge the new commit as 'seen' if the user explicitly acknowledges it (e.g., OverviewView sends ack=true)
          if (req.query.ack === 'true') {
            tracker.lastSeenCommitHash = repo.latestCommitHash;
            await tracker.save();
          }
       }

      if (!repo.folderSummary || repo.folderSummary.length === 0) {
        const allFileRecords = await RepositoryFile.find({ repositoryId: id }).select('filePath');
        const topLevelFolders = [...new Set(allFileRecords.map(f => {
          const parts = f.filePath.split(/[/\\]/);
          if (parts.length > 1) return parts[0];
          return null;
        }).filter(Boolean))];
        
        repo.folderSummary = topLevelFolders.map(folder => ({
           folder,
           description: `Directory context: ${folder}`
        }));
        repo.markModified('folderSummary');
        needsSave = true;
      }

      if (!repo.summary) {
        repo.summary = `This repository contains the source code for ${repo.name} by ${repo.owner}. It has been successfully analyzed to extract its directory structure and file contents.`;
        needsSave = true;
      }

      if (!repo.features || repo.features.length === 0) {
        repo.features = [
           { title: "Source Code Extraction", description: "Full repository source code downloaded and parsed." },
           { title: "Structure Mapping", description: "Provides navigable structural mapping of the file hierarchy." }
        ];
        repo.markModified('features');
        needsSave = true;
      }

      if (!repo.techStack || Object.keys(repo.techStack).length === 0) {
        repo.techStack = {
            languages: "Various / Scanned",
            frameworks: "Parsed"
        };
        repo.markModified('techStack');
        needsSave = true;
      }

      if (needsSave) {
        await repo.save();
      }
    }

    const repoObj = repo.toObject();
    // Inject the flag into the response so frontend can show the toast
    // @ts-ignore
    repoObj.hasUpdatedOnGitHub = hasUpdated;
    
    res.json(repoObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching repository' });
  }
};

export const deleteRepository = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    
    // Check if the user is tracking this repository
    const tracker = await UserRepoTracker.findOne({ repositoryId: id, userId });
    if (!tracker) {
      res.status(404).json({ error: 'Repository not found in your list' });
      return;
    }

    // Delete the tracking entry
    await UserRepoTracker.deleteOne({ repositoryId: id, userId });

    // Delete user's chat messages for this repo
    await ChatMessage.deleteMany({ repositoryId: id, userId });

    // Delete user's flows for this repo
    await RepositoryFlow.deleteMany({ repositoryId: id, userId });

    // If the user happens to be the 'creator' of the repo based on the userId field, unset it to fully decouple
    await Repository.updateOne({ _id: id, userId }, { $unset: { userId: 1 } });

    res.json({ success: true, message: 'Repository deleted from your history' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Server error deleting repository', details: error.message, stack: error.stack });
  }
};

export const reanalyzeRepository = async (req: Request, res: Response): Promise<void> => {
  let lockToken = null;
  const lockKey = `repo:reanalyze:${req.params.id}`;
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    lockToken = await acquireLock(lockKey, 10000); // 10s lock
    if (!lockToken) {
      res.status(429).json({ error: 'Re-analysis is currently being initiated by another request. Please wait.' });
      return;
    }

    const tracker = await UserRepoTracker.findOne({ repositoryId: id, userId });
    if (!tracker) {
      res.status(404).json({ error: 'Repository not found in your list' });
      return;
    }

    const repository = await Repository.findById(id);
    if (!repository) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    repository.status = 'cloning';
    // Clear old state that we might re-generate
    repository.summary = undefined;
    repository.features = [];
    repository.folderSummary = [];
    repository.techStack = undefined;
    
    await repository.save();

    res.json({ message: 'Re-analysis started' });

    // Start background analysis
    import('../services/repository.service').then(({ processRepository }) => {
      processRepository(repository._id.toString(), repository.githubUrl).catch(err => {
        console.error('Background re-analysis error:', err);
      });
    });
  } catch (error) {
    console.error('Reanalyze repo error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (lockToken) {
      await releaseLock(lockKey, lockToken);
    }
  }
};

