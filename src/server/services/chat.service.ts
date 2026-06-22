import { GoogleGenAI } from '@google/genai';
import { getQdrantClient, COLLECTION_NAME } from './qdrant.service';
import dotenv from 'dotenv';
import { Repository } from '../models/Repository';
import { ChatMessage } from '../models/ChatMessage';
import { generateContent, generateContentStream } from '../utils/gemini.util';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
const getAIClient = () => {
    if (!aiClient && process.env.GEMINI_API_KEY) {
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
};

export const generateChatResponse = async (repoId: string, query: string) => {
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

    // 2. Vector Search
    const searchResults = await qdrant.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: 10,
        filter: {
            must: [
                {
                    key: 'repoId',
                    match: { value: repoId }
                }
            ]
        }
    });

    // 3. Prompt Construction
    let contextStr = '';
    const filePaths = new Set<string>();

    for (const result of searchResults) {
        const payload = result.payload as any;
        if (payload) {
            contextStr += `--- File: ${payload.filePath} ---\n${payload.content}\n\n`;
            filePaths.add(payload.filePath);
        }
    }

    const prompt = `You are a helpful AI assistant that answers questions about a specific code repository.
You must ONLY answer based on the provided repository context. Do not use outside knowledge. 
If the context does not contain the answer, politely state that you cannot answer based on the repository content.
Always cite the source files you used when providing an answer.

Repository Name: ${repo.owner}/${repo.name}
Repository Description: ${repo.summary || 'N/A'}

--- REPOSITORY CONTEXT ---
${contextStr}
--- END REPOSITORY CONTEXT ---

User Question: ${query}

Provide a clear, detailed, and accurate answer based on the context above.`;

    // 4. Generate Response
    const response = await generateContent(prompt);

    return {
        answer: response.text,
        sources: Array.from(filePaths)
    };
};

async function summarizeChatHistoryDistributed(olderMessages: any[]): Promise<string> {
    if (!olderMessages || olderMessages.length === 0) return "";
    
    const conversation = olderMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const prompt = `Summarize the following past conversation between a user and an AI assistant. Focus on the main topics discussed, technical details, and context established. Be concise.\n\nConversation:\n${conversation}\n\nSummary:`;

    const groqKeys = [process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2].filter(Boolean);
    const hfKeys = [process.env.HUGGINGFACE_API_KEY_1, process.env.HUGGINGFACE_API_KEY_2].filter(Boolean);

    for (const key of groqKeys) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({
                    model: 'llama3-8b-8192',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 300
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.choices && data.choices[0]) {
                    return data.choices[0].message.content.trim();
                }
            }
        } catch (e) {
            // console.warn('Groq failed for summarization');
        }
    }

    for (const key of hfKeys) {
        try {
            const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({
                    model: 'mistralai/Mistral-7B-Instruct-v0.3',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 300
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.choices && data.choices[0]) {
                    return data.choices[0].message.content.trim();
                }
            }
        } catch (e) {
            // console.warn('HF failed for summarization');
        }
    }

    return "";
}

export const generateChatStream = async (repoId: string, userId: string, query: string) => {
    const ai = getAIClient();
    const qdrant = getQdrantClient();

    if (!ai || !qdrant) {
        throw new Error('AI or Vector DB not configured properly');
    }

    const repo = await Repository.findById(repoId);
    if (!repo) {
        throw new Error('Repository not found');
    }

    // Load recent conversation history (max 8 messages = 4 turns) + older info
    const allHistory = await ChatMessage.find({ repositoryId: repoId, userId })
        .sort({ createdAt: -1 })
        .limit(28)
        .lean();
    allHistory.reverse();

    let recentHistory = allHistory;
    let olderHistory: any[] = [];
    
    if (allHistory.length > 8) {
        recentHistory = allHistory.slice(-8);
        olderHistory = allHistory.slice(0, -8);
    }

    let historyStr = '';
    
    const embedPromise = ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: query,
        config: {
            outputDimensionality: 768,
            taskType: 'RETRIEVAL_QUERY'
        }
    });

    const summaryPromise = olderHistory.length > 0 ? summarizeChatHistoryDistributed(olderHistory) : Promise.resolve("");

    const [embedRes, olderSummary] = await Promise.all([embedPromise, summaryPromise]);

    if (olderSummary) {
        historyStr += `--- PAST CONVERSATION SUMMARY ---\n${olderSummary}\n--- END PAST SUMMARY ---\n\n`;
    }

    if (recentHistory.length > 0) {
        historyStr += "--- RECENT CONVERSATION HISTORY ---\n";
        for (const msg of recentHistory) {
            historyStr += `${msg.role.toUpperCase()}: ${msg.content}\n\n`;
        }
        historyStr += "--- END RECENT HISTORY ---\n\n";
    }

    const queryVector = embedRes.embeddings?.[0]?.values;

    if (!queryVector) {
        throw new Error('Failed to generate embedding for query');
    }

    const searchResults = await qdrant.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: 10,
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
    const filePaths = new Set<string>();

    for (const result of searchResults) {
        const payload = result.payload as any;
        if (payload) {
            contextStr += `--- File: ${payload.filePath} ---\n${payload.content}\n\n`;
            filePaths.add(payload.filePath);
        }
    }

    const prompt = `You are a helpful AI assistant that answers questions about a specific code repository.
You must ONLY answer based on the provided repository context. Do not use outside knowledge. 
If the context does not contain the answer, politely state that you cannot answer based on the repository content.
Always cite the source files you used when providing an answer.

Repository Name: ${repo.owner}/${repo.name}
Repository Description: ${repo.summary || 'N/A'}

${historyStr}--- REPOSITORY CONTEXT ---
${contextStr}--- END REPOSITORY CONTEXT ---

User Question: ${query}

Provide a clear, detailed, and accurate answer based on the context above.`;

    // Start saving user message asynchronously
    const userMessagePromise = new ChatMessage({
        repositoryId: repoId,
        userId: userId,
        role: 'user',
        content: query
    }).save();

    const stream = await generateContentStream(prompt);

    return {
        stream,
        sources: Array.from(filePaths),
        userMessagePromise,
        saveAssistantMessage: async (content: string) => {
            await new ChatMessage({
                repositoryId: repoId,
                userId: userId,
                role: 'assistant',
                content: content,
                sources: Array.from(filePaths)
            }).save();
        }
    };
};
