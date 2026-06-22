import { Repository } from '../models/Repository';
import { RepositoryFile } from '../models/RepositoryFile';
import dotenv from 'dotenv';
import { generateContent } from '../utils/gemini.util';

dotenv.config();

export const generateArchitectureData = async (repoId: string) => {
    const repo = await Repository.findById(repoId);
    if (!repo) {
        throw new Error('Repository not found');
    }

    const dbFiles = await RepositoryFile.find({ repositoryId: repoId }).select('-content');
    
    let contextStr = `Repository: ${repo.owner}/${repo.name}\n\n`;
    contextStr += `Files list:\n`;
    dbFiles.forEach(f => {
        contextStr += `- ${f.filePath}\n`;
    });
    
    const prompt = `You are a software architecture expert. Based on the following repository structure and file list, please generate a high-level system architecture diagram using Mermaid.js syntax.
Also, provide an explanation/insights of the architecture (detecting frontend layer, backend layer, database layer, main services).

CRITICAL MERMAID RULES:
- DO NOT use any parentheses "()", brackets "[]", curly braces "{}", or commas "," inside node labels.
- For example, instead of "Cloudinary (Media Storage)", use "Cloudinary Media Storage".
- Use correctly formatted \\n characters for newlines within the JSON string for the mermaid output attribute.
- Ensure EVERY single statement, especially 'end', 'alt', 'else', 'opt', 'loop' keywords, has a newline \\n immediately after it. They MUST be on their own line.
- In Sequence Diagrams, DO NOT use 'activate' or 'deactivate' keywords to avoid participant state errors. Rely on simple messaging (->>).
- For relationship labels in graph TD/LR, ALWAYS use the standard syntax A -->|Label Text| B. DO NOT use A -- Label -> B or A -- Label -- B.
- Node IDs MUST be purely alphanumeric words with no spaces (e.g., nodeA, myDb).
- Subgraph IDs MUST be strictly unique and MUST NOT overlap with any Node ID. Ensure no node is named the same as its parent subgraph.

Return ONLY a pure JSON object in this exact format:
{
  "mermaid": "graph TD\\n...",
  "insights": [
    { "layer": "Frontend", "title": "React Web App", "description": "Single page application using React." }
  ]
}

Repository Context:
${contextStr}
`;

    const response = await generateContent(prompt);

    const responseText = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
    if (!responseText) {
        throw new Error('Failed to generate architecture');
    }

    const parsed = JSON.parse(responseText);
    
    // Save to repo
    repo.collection.updateOne({ _id: repo._id }, { $set: { architecture: parsed } });

    return parsed;
};
