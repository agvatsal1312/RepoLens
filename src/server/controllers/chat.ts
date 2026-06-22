import { Request, Response } from 'express';
import { z } from 'zod';
import { generateChatStream } from '../services/chat.service';
import { Repository } from '../models/Repository';
import { ChatMessage } from '../models/ChatMessage';
import { UserRepoTracker } from '../models/UserRepoTracker';
import { acquireLock, releaseLock } from '../redis';

const chatSchema = z.object({
  query: z.string().min(1)
});

export const handleGetChatHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: repoId } = req.params;
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const tracker = await UserRepoTracker.findOne({ repositoryId: repoId, userId });
    if (!tracker) {
      res.status(404).json({ error: 'Repository not found in your list' });
      return;
    }

    const total = await ChatMessage.countDocuments({ repositoryId: repoId, userId });
    const messages = await ChatMessage.find({ repositoryId: repoId, userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Return in chronological order
    res.json({
      messages: messages.reverse().map(m => ({
        id: m._id,
        role: m.role,
        content: m.content,
        sources: m.sources,
        createdAt: m.createdAt
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Server error fetching chat history' });
  }
};

export const handleChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: repoId } = req.params;
    
    // Express request body might not be parsed if it's SSE, but we are using POST so it should be.
    // However, typically SSE uses GET with query params, but POST is fine if body is parsed.
    // Assuming body is parsed.
    const { query } = chatSchema.parse(req.body);
    const userId = (req as any).userId;

    const tracker = await UserRepoTracker.findOne({ repositoryId: repoId, userId });
    if (!tracker) {
      res.status(404).json({ error: 'Repository not found in your list' });
      return;
    }

    const lockKey = `repo:chat:${repoId}:${userId}`;
    let lockToken = null;
    try {
      lockToken = await acquireLock(lockKey, 30000); // 30s lock
      if (!lockToken) {
        res.status(429).json({ error: 'A chat message is currently being processed. Please wait.' });
        return;
      }

      const { stream, sources, saveAssistantMessage, userMessagePromise } = await generateChatStream(repoId, userId, query);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders(); // flush the headers to establish SSE

      res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);

      let accumulatedContent = '';
      for await (const chunk of stream) {
          if (chunk.text) {
              accumulatedContent += chunk.text;
              res.write(`data: ${JSON.stringify({ type: 'content', text: chunk.text })}\n\n`);
          }
      }

      await saveAssistantMessage(accumulatedContent);
      await userMessagePromise;

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } finally {
      if (lockToken) {
        await releaseLock(lockKey, lockToken);
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error('Chat error:', error);
      if (!res.headersSent) {
          res.status(500).json({ error: 'Server error processing chat request' });
      } else {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Server error processing chat request' })}\n\n`);
          res.end();
      }
    }
  }
};
