import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Repository } from '../models/Repository';
import { RepositoryFile } from '../models/RepositoryFile';
import { embedAndStore } from './embedding.service';
import { getQdrantClient, COLLECTION_NAME, initQdrant } from './qdrant.service';
import { generateContent } from '../utils/gemini.util';

const REPOS_DIR = path.join(process.cwd(), 'tmp', 'repos');

export const processRepository = async (repositoryId: string, githubUrl: string, targetCommitHash?: string, oldCommitHash?: string) => {
  const repo = await Repository.findById(repositoryId);
  if (!repo) return;

  const repoDir = path.join(REPOS_DIR, uuidv4());

  try {
    if (repo.status === 'syncing' && oldCommitHash && targetCommitHash) {
       // --- DIFF SYNCING LOGIC ---
       console.log(`Syncing repository ${repo.owner}/${repo.name} from ${oldCommitHash} to ${targetCommitHash}`);
       
       const compareUrl = `https://api.github.com/repos/${repo.owner}/${repo.name}/compare/${oldCommitHash}...${targetCommitHash}`;
       const compareRes = await fetch(compareUrl, { headers: { 'User-Agent': 'RepoLens-App' } });
       
       if (compareRes.ok) {
           const compareData = await compareRes.json();
           const filesChanged = compareData.files || [];
           
           for (const file of filesChanged) {
              const relPath = file.filename;
              const status = file.status; // 'added', 'modified', 'removed', 'renamed'
              
              if (status === 'removed') {
                 // Remove from Mongo
                 const deletedFile = await RepositoryFile.findOneAndDelete({ repositoryId, filePath: relPath });
                 if (deletedFile) {
                    // Remove from Qdrant
                    const qClient = getQdrantClient();
                    if (qClient) {
                       try {
                           await qClient.delete(COLLECTION_NAME, {
                              filter: {
                                must: [
                                  { key: 'repoId', match: { value: repositoryId } },
                                  { key: 'filePath', match: { value: relPath } }
                                ]
                              }
                           });
                       } catch (e: any) {
                         if (e.message?.includes('Not Found')) {
                           initQdrant().catch(console.error);
                         } else {
                           console.warn("Qdrant delete failed:", e.message);
                         }
                       }
                    }
                 }
              } else if (status === 'added' || status === 'modified' || status === 'renamed') {
                 // For renamed, we might want to delete the old one. GitHub provides 'previous_filename' 
                 if (status === 'renamed' && file.previous_filename) {
                     const deletedFile = await RepositoryFile.findOneAndDelete({ repositoryId, filePath: file.previous_filename });
                     if (deletedFile) {
                        const qClient = getQdrantClient();
                        if (qClient) {
                           try {
                               await qClient.delete(COLLECTION_NAME, {
                                  filter: {
                                    must: [
                                      { key: 'repoId', match: { value: repositoryId } },
                                      { key: 'filePath', match: { value: file.previous_filename } }
                                    ]
                                  }
                               });
                           } catch(e: any) {
                             if (e.message?.includes('Not Found')) {
                               initQdrant().catch(console.error);
                             } else {
                               console.warn("Qdrant delete failed:", e.message);
                             }
                           }
                        }
                     }
                 }
                 
                 // Fetch raw file
                 const ext = path.extname(relPath).toLowerCase();
                 const supportedExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.md', '.txt', '.yml', '.yaml', '.dart', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rb', '.php', '.rs', '.xml', '.sql', '.sh'];
                 
                 if (supportedExts.includes(ext)) {
                     const rawRes = await fetch(file.raw_url);
                     if (rawRes.ok) {
                         const content = await rawRes.text();
                         if (content.length <= 1024 * 1024) { // Under 1MB
                             let dbFile = await RepositoryFile.findOne({ repositoryId, filePath: relPath });
                             if (dbFile) {
                                dbFile.content = content;
                                dbFile.metadata = { size: content.length }; // Approx size
                                await dbFile.save();
                                
                                // Delete old vectors for this file specifically
                                const qClient = getQdrantClient();
                                if (qClient) {
                                   try {
                                       await qClient.delete(COLLECTION_NAME, {
                                          filter: {
                                            must: [
                                              { key: 'repoId', match: { value: repositoryId } },
                                              { key: 'filePath', match: { value: relPath } }
                                            ]
                                          }
                                       });
                                   } catch(e: any) {
                                      if (e.message?.includes('Not Found')) {
                                        initQdrant().catch(console.error);
                                      } else {
                                        console.warn("Qdrant delete failed:", e.message);
                                      }
                                   }
                                }
                             } else {
                                dbFile = await RepositoryFile.create({
                                  repositoryId,
                                  filePath: relPath,
                                  fileType: ext.replace('.', '') || 'txt',
                                  content,
                                  metadata: { size: content.length }
                                });
                             }
                             
                             // Re-embed
                             await embedAndStore(repositoryId, dbFile._id.toString(), relPath, content);
                         }
                     }
                 }
              }
           }
       }
       
       // Note: we don't skip AI summarization because tech stack / features could have changed!
       // But we could optimize it later. Let's let the summary run again.
    } else {
       // --- FULL CLONE ---
       repo.status = 'cloning';
       await repo.save();

       await fs.mkdir(repoDir, { recursive: true });
       const git = simpleGit();
       
       await git.clone(githubUrl, repoDir, ['--depth', '1']);

       // 2. Parsing & Embedding
       repo.status = 'parsing';
       await repo.save();

       await parseDirectory(repoDir, repoDir, repositoryId);
    }

    // 3. Summarization
    try {
      const dbFiles = await RepositoryFile.find({
        repositoryId,
        filePath: { $in: ['README.md', 'package.json', 'README.txt', 'readme.md'] }
      });

      const allFiles = await RepositoryFile.find({ repositoryId }).select('filePath');
      const filePaths = allFiles.map(f => f.filePath).join('\n');
      
      let contextStr = `Repository: ${repo.owner}/${repo.name}\n\n`;
      dbFiles.forEach(f => {
        contextStr += `--- ${f.filePath} ---\n${f.content?.substring(0, 5000)}\n\n`;
      });
      contextStr += `\n\n--- ALL REPOSITORY FILES ---\n${filePaths.substring(0, 5000)}`;

      // Fetch GitHub Stats
      let stats = { stars: 0, forks: 0, contributors: 'Unknown', commits: 'Unknown', license: 'Unknown' };
      try {
        const ghHeaders: any = { 'User-Agent': 'RepoLens-App' };
        if (process.env.GITHUB_TOKEN) {
          ghHeaders['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }
        
        const ghRes = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, { headers: ghHeaders });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          stats.stars = ghData.stargazers_count;
          stats.forks = ghData.forks_count;
          if (ghData.license && ghData.license.spdx_id) {
            stats.license = ghData.license.spdx_id;
          }
        } else if (ghRes.status === 403) {
          stats.stars = 'N/A' as any;
          stats.forks = 'N/A' as any;
          stats.license = 'Rate Limited';
        }
        
        // Fetch commits count using link header
        const commitsRes = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/commits?per_page=1`, { headers: ghHeaders });
        if (commitsRes.ok) {
          const cLink = commitsRes.headers.get('link');
          if (cLink) {
            const m = cLink.match(/[?&]page=(\d+)>; rel="last"/);
            if (m) stats.commits = m[1];
          } else {
            const cData = await commitsRes.json();
            stats.commits = cData.length.toString();
          }
        } else if (commitsRes.status === 403) {
          stats.commits = 'Rate Limited';
        }

        // Fetch contributors 
        const contribRes = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/contributors?per_page=1&anon=true`, { headers: ghHeaders });
        if (contribRes.ok) {
          const cLink = contribRes.headers.get('link');
          if (cLink) {
            const m = cLink.match(/[?&]page=(\d+)>; rel="last"/);
            if (m) stats.contributors = m[1];
          } else {
            const cData = await contribRes.json();
            stats.contributors = cData.length.toString();
          }
        } else if (contribRes.status === 403) {
          stats.contributors = 'Rate Limited';
        }
      } catch (e) {}
      repo.stats = stats as any;
      
      try {
        const prompt = `Based on the following repository context (like README, package.json, and the file tree list), please summarize what this project does. Also extract an array of core features (each feature should have a Title & Description), an object of the tech stack used (categorized), and a folder summary array showing top-level folders and what they do. Return the result in pure JSON format: { "summary": "string", "features": [{ "title": "string", "description": "string" }], "techStack": { "languages": "string", "frameworks": "string", "packageManager": "string", "testRunner": "string" }, "folderSummary": [{ "folder": "string", "description": "string" }] }. If you don't have enough context, return a best guess or empty fields.\n\nContext:\n${contextStr}`;
        
        const res = await generateContent(prompt);
        
        const responseText = res.text?.replace(/```json/g, '').replace(/```/g, '').trim();
        if (responseText) {
          const parsed = JSON.parse(responseText);
          repo.summary = parsed.summary;
          repo.features = parsed.features;
          repo.techStack = parsed.techStack;
          repo.folderSummary = parsed.folderSummary;

          repo.markModified('stats');
          repo.markModified('features');
          repo.markModified('techStack');
          repo.markModified('folderSummary');
        }
      } catch (e) {
        console.warn('Gemini summary extraction failed:', e);
      }
    } catch (e) {
      console.error('Failed to generate AI summary:', e);
    }

    if (!repo.folderSummary || repo.folderSummary.length === 0) {
      const allFileRecords = await RepositoryFile.find({ repositoryId }).select('filePath');
      const topLevelFolders = [...new Set(allFileRecords.map(f => {
        const parts = f.filePath.split(/[/\\]/); // Handle both / and \
        if (parts.length > 1) return parts[0];
        return null;
      }).filter(Boolean))];
      repo.folderSummary = topLevelFolders.map(folder => ({
         folder,
         description: `Directory context: ${folder}`
      }));
      repo.markModified('folderSummary');
    }

    if (!repo.summary) {
      repo.summary = `This repository contains the source code for ${repo.name} by ${repo.owner}. It has been successfully analyzed to extract its directory structure and file contents.`;
    }

    if (!repo.features || repo.features.length === 0) {
      repo.features = [
         { title: "Source Code Extraction", description: "Full repository source code downloaded and parsed." },
         { title: "Structure Mapping", description: "Provides navigable structural mapping of the file hierarchy." }
      ];
      repo.markModified('features');
    }

    if (!repo.techStack || Object.keys(repo.techStack).length === 0) {
      repo.techStack = {
          languages: "Various / Scanned",
          frameworks: "Parsed"
      };
      repo.markModified('techStack');
    }

    // 4. Completed
    // Fetch latest repo to avoid VersionError if it was updated during the long processing
    const finalRepo = await Repository.findById(repositoryId);
    if (finalRepo) {
       finalRepo.status = 'completed';
       finalRepo.summary = repo.summary;
       finalRepo.features = repo.features;
       finalRepo.techStack = repo.techStack;
       finalRepo.folderSummary = repo.folderSummary;
       finalRepo.stats = repo.stats;
       await finalRepo.save();
    }

  } catch (error: any) {
    console.error('Error processing repository:', error);
    const failedRepo = await Repository.findById(repositoryId);
    if (failedRepo) {
      failedRepo.status = 'failed';
      failedRepo.errorMessage = error.message;
      await failedRepo.save();
    }
  } finally {
    // Cleanup
    try {
      await fs.rm(repoDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to cleanup repo dir:', e);
    }
  }
};

const parseDirectory = async (rootDir: string, currentDir: string, repositoryId: string) => {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(rootDir, fullPath);

    // Skip node_modules, .git, etc
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }

    if (entry.isDirectory()) {
      await parseDirectory(rootDir, fullPath, repositoryId);
    } else {
      await processFile(fullPath, relPath, repositoryId);
    }
  }
};

const processFile = async (fullPath: string, relPath: string, repositoryId: string) => {
  const ext = path.extname(fullPath).toLowerCase();
  
  // Basic filtering for text/code files
  const supportedExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.md', '.txt', '.yml', '.yaml', '.dart', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rb', '.php', '.rs', '.xml', '.sql', '.sh'];
  if (!supportedExts.includes(ext)) {
    return;
  }

  try {
    const stat = await fs.stat(fullPath);
    // Ignore files larger than 1MB to prevent memory issues for now
    if (stat.size > 1024 * 1024) return;

    const content = await fs.readFile(fullPath, 'utf-8');
    
    let metadata: any = { size: stat.size };

    const dbFile = await RepositoryFile.create({
      repositoryId,
      filePath: relPath,
      fileType: ext.replace('.', '') || 'txt',
      content,
      metadata
    });

    // 4. Chunk & vector embeddings
    await embedAndStore(repositoryId, dbFile._id.toString(), relPath, content);
  } catch (e) {
    console.error(`Error reading file ${relPath}:`, e);
  }
};
