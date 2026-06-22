import { Repository } from '../models/Repository';
import { RepositoryFile } from '../models/RepositoryFile';
import dotenv from 'dotenv';
import { generateContent } from '../utils/gemini.util';

dotenv.config();

export const generateDocumentation = async (repoId: string, commitHash?: string) => {
    const repo = await Repository.findById(repoId);
    if (!repo) {
        throw new Error('Repository not found');
    }

    const targetHash = commitHash || repo.latestCommitHash;

    if (repo.documents && repo.documents.length > 0) {
        const existingData = repo.documents.find(p => p.commitHash === targetHash);
        if (existingData) {
            // Fake the processing delay
            await new Promise(r => setTimeout(r, 6000));
            return existingData.data;
        }
    }

    const files = await RepositoryFile.find({ 
        repositoryId: repoId,
        type: 'file',
        // exclude lock files, binaries etc if needed
        filePath: { $not: /\.(png|jpe?g|gif|ico|svg|eot|ttf|woff|woff2|lock|json)$/i }
    }).limit(100); 
    
    let contextStr = `Repository: ${repo.owner}/${repo.name}\n\n`;
    files.forEach((file) => {
        if (file.content) {
            contextStr += `--- ${file.filePath} ---\n${file.content}\n\n`;
        }
    });

    const prompt = `You are an expert Principal Software Engineer and Technical Writer. 
Based on the following repository context, generate exactly three highly detailed, comprehensive, and professional markdown documents.
Do not provide a superficial summary. Dive deep into the nuances of the implementation, explaining the "how" and "why" behind the code.
Provide code examples within the markdown if it aids explanation.
Use professional formatting, nested headings, lists, and tables where appropriate.

1. README.md: A complete README including project overview, key value propositions, prerequisites, step-by-step installation instructions, configuration details, and detailed usage examples.
2. ARCHITECTURE.md: A thorough document detailing the system architecture, component diagrams (described in text or mermaid if you prefer), data flow, layer responsibilities, state management, and key architectural decisions made in the codebase.
3. API_REFERENCE.md: A deep-dive API reference (for external routes/endpoints) OR an internal module reference (for core services/components). Include method signatures, parameter descriptions, return values, error handling, and behavioral edge cases.

Return ONLY a pure JSON array in this exact format:
[
  {
    "title": "README.md",
    "content": "# Project Title\\n\\nDetailed project description here..."
  },
  {
    "title": "ARCHITECTURE.md",
    "content": "# Architecture\\n\\nDetailed architectural breakdown here..."
  },
  {
    "title": "API_REFERENCE.md",
    "content": "# API Reference\\n\\nDetailed module/API documentation here..."
  }
]

Repository Context:
${contextStr}
`;

    let parsed;
    try {
        const response = await generateContent(prompt);

        let responseText = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
        if (!responseText) {
            throw new Error('Failed to generate documentation');
        }

        responseText = responseText.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
            return match
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t')
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        });

        parsed = JSON.parse(responseText);
    } catch (e: any) {
        if (e?.message?.includes('Quota exceeded') || e?.status === 'RESOURCE_EXHAUSTED' || e?.status === 429) {
            console.warn('Quota exceeded for documentation generation. Using mock data.');
            parsed = [
                {
                  "title": "README.md",
                  "content": "# Project Title\\n\\nThis is a mock documentation because the API quota was exceeded.\\n\\n## Prerequisites\\n- Node.js\\n- npm\\n\\n## Installation\\n```bash\\nnpm install\\n```"
                },
                {
                  "title": "ARCHITECTURE.md",
                  "content": "# Architecture\\n\\nThis is a mock architecture documentation.\\n\\n- Frontend: React\\n- Backend: Express\\n- Database: MongoDB"
                },
                {
                  "title": "API_REFERENCE.md",
                  "content": "# API Reference\\n\\nThis is a mock API reference.\\n\\n### `GET /api/v1/status`\\nReturns the API status."
                }
            ];
        } else {
            throw e;
        }
    }
    
    // Save to repo appending to array
    await Repository.findByIdAndUpdate(repo._id, {
        $push: {
            documents: { commitHash: targetHash, data: parsed }
        }
    });

    return parsed;
};
