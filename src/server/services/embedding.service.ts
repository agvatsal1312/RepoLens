import { GoogleGenAI } from '@google/genai';
import { getQdrantClient, COLLECTION_NAME } from './qdrant.service';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

let aiClient: GoogleGenAI | null = null;
const getAIClient = () => {
    if (!aiClient && process.env.GEMINI_API_KEY) {
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
};

export const chunkText = (text: string, maxChunkSize = 2000): string[] => {
    const chunks: string[] = [];
    const lines = text.split('\n');
    let currentChunk = '';

    for (const line of lines) {
        if ((currentChunk.length + line.length + 1) > maxChunkSize) {
             if (currentChunk.trim().length > 0) {
                 chunks.push(currentChunk);
                 currentChunk = '';
             }
             if (line.length > maxChunkSize) {
                 let start = 0;
                 while (start < line.length) {
                     chunks.push(line.substring(start, start + maxChunkSize));
                     start += maxChunkSize;
                 }
             } else {
                 currentChunk = line + '\n';
             }
        } else {
             currentChunk += line + '\n';
        }
    }
    
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk);
    }
    return chunks;
};

export const embedAndStore = async (repoId: string, fileId: string, filePath: string, content: string) => {
    if (!content || !content.trim()) return;

    const client = getQdrantClient();
    const ai = getAIClient();

    if (!client || !ai) {
        console.warn(`Vector DB or AI Client not configured. Skipping embeddings for ${filePath}`);
        return;
    }

    try {
        // Embed the whole file content, up to a reasonable limit to avoid massive token usages
        const textToEmbed = content.length > 5000 ? content.substring(0, 5000) : content;

        const response = await ai.models.embedContent({
            model: 'gemini-embedding-2-preview',
            contents: textToEmbed,
            config: {
                outputDimensionality: 768,
                taskType: 'RETRIEVAL_DOCUMENT'
            }
        });
        
        const embeddings = response.embeddings;
        if (!embeddings || embeddings.length === 0 || !embeddings[0].values) {
            console.error('No embeddings returned for', filePath);
            return;
        }

        const vector = embeddings[0].values;
        
        await client.upsert(COLLECTION_NAME, {
            wait: true,
            points: [{
                id: crypto.randomUUID(),
                vector: vector,
                payload: {
                    repoId,
                    fileId,
                    filePath,
                    content: textToEmbed,
                }
            }]
        });
        console.log(`Stored vectorized file for ${filePath}`);
    } catch (e: any) {
        // Specifically check for rate limit 429
        if (e.message?.includes('429')) {
             console.log(`Rate limit reached for Gemini embedding on ${filePath}. Skipping...`);
        } else if (e.message?.includes('Not Found')) {
             console.log(`Resource not found during embedding for ${filePath}. Skipping...`);
        } else {
             console.log(`Error embedding & storing ${filePath}:`, e.message);
        }
    }
};
