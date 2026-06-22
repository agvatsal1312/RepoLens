import { Request, Response } from 'express';
import { z } from 'zod';
import { generateFlowData } from '../services/flow.service';
import { Repository } from '../models/Repository';
import { RepositoryFlow } from '../models/RepositoryFlow';
import { acquireLock, releaseLock } from '../redis';
import { UserRepoTracker } from '../models/UserRepoTracker';
import { generateContent } from '../utils/gemini.util';

const flowSchema = z.object({
  query: z.string().min(1)
});

async function checkIntentDistributed(prompt: string): Promise<string> {
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
                    temperature: 0,
                    max_tokens: 20
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.choices && data.choices[0]) {
                    return data.choices[0].message.content.trim();
                }
            }
        } catch (e) {
            // console.warn('Groq failed');
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
                    temperature: 0,
                    max_tokens: 20
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.choices && data.choices[0]) {
                    return data.choices[0].message.content.trim();
                }
            }
        } catch (e) {
            // console.warn('HF failed');
        }
    }

    try {
        const response = await generateContent(prompt);
        return response.text?.trim() || 'NEW';
    } catch (err) {
        console.warn('Gemini fallback failed:', err);
    }

    return 'NEW';
}

export const handleGetFlows = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: repoId } = req.params;
    const userId = (req as any).userId;

    const tracker = await UserRepoTracker.findOne({ repositoryId: repoId, userId });
    if (!tracker) {
       res.status(404).json({ error: 'Repository not found in your list' });
       return;
    }

    const flows = await RepositoryFlow.find({ repositoryId: repoId, userId }).sort({ createdAt: -1 });
    res.json(flows);
  } catch (err) {
    res.status(500).json({ error: 'Server error retrieving flows' });
  }
};

export const handleGenerateFlow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: repoId } = req.params;
    const { query } = flowSchema.parse(req.body);
    const userId = (req as any).userId;

    const tracker = await UserRepoTracker.findOne({ repositoryId: repoId, userId });
    if (!tracker) {
      res.status(404).json({ error: 'Repository not found in your list' });
      return;
    }

    // 1. Fetch past flows
    const pastFlows = await RepositoryFlow.find({ repositoryId: repoId, userId });

    // 2. Assess match if pastFlows exist
    if (pastFlows.length > 0) {
       try {
         const flowList = pastFlows.map(f => `ID: ${f._id} | Query: ${f.query} | Title: ${f.title}`).join('\n');
         const prompt = `You are an intent matching engine. The user asked for a flow visualization: "${query}".
Past flows:
${flowList}

Does the new query strongly match the intent of any past flow?
If yes, reply with ONLY the exact string ID of the matching flow.
If no, reply with ONLY the word "NEW".
Do not include any other text, warnings, or explanations.`;

         const answer = await checkIntentDistributed(prompt);
         if (answer !== 'NEW') {
            // Find matched flow by exact string match or fallback to includes if LLM hallucinates extra spaces
            const matchedFlow = pastFlows.find(f => f._id.toString() === answer || answer.includes(f._id.toString()));
            if (matchedFlow) {
                res.json({ ...matchedFlow.toObject(), _isCached: true });
                return;
            }
         }
       } catch (err) {
         console.warn('AI intent matching failed, falling back to new generation', err);
       }
    }

    // 3. Generate new flow
    const lockKey = `repo:flow:${repoId}`;
    let lockToken = null;
    try {
      lockToken = await acquireLock(lockKey, 60000); // 60s lock
      if (!lockToken) {
        res.status(429).json({ error: 'A flow is currently being generated for this repository. Please wait and try again.' });
        return;
      }

      const result = await generateFlowData(repoId, query);
      
      const userId = (req as any).userId;
      // 4. Save new flow
      const newFlow = await RepositoryFlow.create({
        repositoryId: repoId,
        userId,
        query,
        title: result.title,
        mermaid: result.mermaid,
        summary: result.summary,
        steps: result.steps
      });

      res.json({ ...newFlow.toObject(), _isCached: false });
    } finally {
      if (lockToken) {
         await releaseLock(lockKey, lockToken);
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error('Flow error:', error);
      res.status(500).json({ error: 'Server error generating flow' });
    }
  }
};
