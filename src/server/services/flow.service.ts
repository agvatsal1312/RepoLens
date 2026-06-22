import { GoogleGenAI } from '@google/genai';
import { getQdrantClient, COLLECTION_NAME } from './qdrant.service';
import { Repository } from '../models/Repository';
import dotenv from 'dotenv';
import { generateContent } from '../utils/gemini.util';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
const getAIClient = () => {
    if (!aiClient && process.env.GEMINI_API_KEY) {
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
};

export const generateFlowData = async (repoId: string, query: string) => {
    const ai = getAIClient();
    const qdrant = getQdrantClient();

    if (!ai || !qdrant) {
        throw new Error('AI or Vector DB not configured properly');
    }

    const repo = await Repository.findById(repoId);
    if (!repo) {
        throw new Error('Repository not found');
    }

    // 1. Generate embedding for query
    const embedRes = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: query,
        config: {
            outputDimensionality: 768,
            taskType: 'RETRIEVAL_QUERY'
        }
    });
    const queryVector = embedRes.embeddings?.[0]?.values;

    if (!queryVector) {
        throw new Error('Failed to generate embedding for query');
    }

    // 2. Vector Search (find relevant code for this flow)
    const searchResults = await qdrant.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: 15,
        filter: {
            must: [
                {
                    key: 'repoId',
                    match: { value: repoId }
                }
            ]
        }
    });

    let contextStr = '';
    for (const result of searchResults) {
        const payload = result.payload as any;
        if (payload) {
            contextStr += `--- File: ${payload.filePath} ---\n${payload.content}\n\n`;
        }
    }

    const prompt = `You are a software architecture expert. The user wants to understand a specific flow or process in the codebase: "${query}".
Using the provided repository context, generate a detailed flow diagram using Mermaid.js syntax (Sequence Diagram or Flowchart).
Also, provide an explanation of the flow, broken down into steps.

CRITICAL MERMAID RULES:
- DO NOT use any parentheses "()", brackets "[]", curly braces "{}", or commas "," inside node labels.
- For example, instead of "Cloudinary (Media Storage)", use "Cloudinary Media Storage".
- Use correctly formatted \\n characters for newlines within the JSON string for the mermaid output attribute.
- Ensure EVERY single statement, especially 'end', 'alt', 'else', 'opt', 'loop' keywords, has a newline \\n immediately after it. They MUST be on their own line.
- In Sequence Diagrams, DO NOT use 'activate' or 'deactivate' keywords to avoid participant state errors. Rely on simple messaging (->>).
- For relationship labels in graph TD/LR, ALWAYS use the standard syntax A -->|Label Text| B. DO NOT use A -- Label -> B or A -- Label -- B.
- Node IDs MUST be purely alphanumeric words with no spaces (e.g., nodeA, myDb).
- Subgraph IDs MUST be strictly unique and MUST NOT overlap with any Node ID. Ensure no node is named the same as its parent subgraph.

Return ONLY a pure JSON object in this exact format, with no markdown wrappers:
{
  "title": "Title of the flow",
  "mermaid": "sequenceDiagram\\n...",
  "steps": [
    { "title": "Step 1", "description": "Description of step 1." }
  ],
  "summary": "Overall summary of the flow."
}

Repository Name: ${repo.owner}/${repo.name}
--- REPOSITORY CONTEXT ---
${contextStr}
`;

    const response = await generateContent(prompt);

    const responseText = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
    if (!responseText) {
        throw new Error('Failed to generate flow');
    }

    return JSON.parse(responseText);
};
