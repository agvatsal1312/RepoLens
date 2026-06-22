import { Repository } from '../models/Repository';
import { RepositoryFile } from '../models/RepositoryFile';
import dotenv from 'dotenv';
import { generateContent } from '../utils/gemini.util';

dotenv.config();

export const generateInterviewPrep = async (repoId: string, commitHash?: string) => {
    const repo = await Repository.findById(repoId);
    if (!repo) {
        throw new Error('Repository not found');
    }

    const targetHash = commitHash || repo.latestCommitHash;

    if (repo.interviewPrep && repo.interviewPrep.length > 0) {
        const existingData = repo.interviewPrep.find(p => p.commitHash === targetHash);
        if (existingData) {
            // Fake the processing delay so UX feels consistent between users
            await new Promise(r => setTimeout(r, 6000));
            return existingData.data;
        }
    }

    const readmeFiles = await RepositoryFile.find({ 
        repositoryId: repoId, 
        filePath: { $in: ['README.md', 'README.txt', 'readme.md', 'package.json'] }
    });
    
    let contextStr = `Repository: ${repo.owner}/${repo.name}\n\n`;
    readmeFiles.forEach((file) => {
        if (file.content) {
            contextStr += `--- ${file.filePath} ---\n${file.content.substring(0, 3000)}\n\n`;
        }
    });

    const prompt = `You are an expert technical interviewer. Based on the following repository context, generate 10 to 15 repository-specific interview questions. 
These questions should test a candidate's understanding of this specific codebase, its architecture, its purpose, and the technologies it uses.

Return ONLY a pure JSON array in this exact format:
[
  {
    "category": "Architecture",
    "difficulty": "Hard",
    "question": "How does the frontend communicate with the matching service?",
    "whyAsk": "They want to gauge your understanding of network protocols...",
    "talkingPoints": ["REST API", "Auth token overhead"],
    "strongAnswer": "Reference the api/client.ts where we..."
  }
]

Categories can be 'Architecture', 'Core Logic', 'Dependencies', 'Setup', and 'General'. Difficulty can be 'Easy', 'Medium', or 'Hard'.

Repository Context:
${contextStr}
`;

    const response = await generateContent(prompt);

    let responseText = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
    if (!responseText) {
        throw new Error('Failed to generate interview prep');
    }

    // Clean up unescaped control characters inside JSON strings
    responseText = responseText.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
        return match
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // strip any other control chars
    });

    const parsed = JSON.parse(responseText);
    
    // Save to repo appending to array
    await Repository.findByIdAndUpdate(repo._id, {
        $push: {
            interviewPrep: { commitHash: targetHash, data: parsed }
        }
    });

    return parsed;
};
