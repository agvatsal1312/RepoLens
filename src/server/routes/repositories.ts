import { Router } from 'express';
import { analyzeRepository, getRepositories, getRepository, deleteRepository, reanalyzeRepository } from '../controllers/repositories';
import { getFiles, getFile } from '../controllers/files';
import { handleChat, handleGetChatHistory } from '../controllers/chat';
import { getArchitecture } from '../controllers/architecture';
import { handleGenerateFlow, handleGetFlows } from '../controllers/flows';
import { getInterviewPrep } from '../controllers/interview';
import { getDocumentation } from '../controllers/documentation';
import { authenticateToken } from './auth';

const router = Router();

router.post('/analyze', authenticateToken, analyzeRepository);
router.get('/', authenticateToken, getRepositories);
router.get('/:id', authenticateToken, getRepository);
router.delete('/:id', authenticateToken, deleteRepository);
router.post('/:id/reanalyze', authenticateToken, reanalyzeRepository);
router.get('/:id/files', authenticateToken, getFiles);
router.get('/:id/files/:fileId', authenticateToken, getFile);
router.post('/:id/chat', authenticateToken, handleChat);
router.get('/:id/chat', authenticateToken, handleGetChatHistory);
router.get('/:id/architecture', authenticateToken, getArchitecture);
router.get('/:id/flows', authenticateToken, handleGetFlows);
router.post('/:id/flows', authenticateToken, handleGenerateFlow);
router.get('/:id/interview', authenticateToken, getInterviewPrep);
router.get('/:id/documentation', authenticateToken, getDocumentation);

export default router;
