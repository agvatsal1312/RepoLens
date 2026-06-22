import { Router } from 'express';
import { register, login, profile, deleteAccount, githubAuthUrl, githubCallback } from '../controllers/auth';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    (req as any).userId = decoded.userId;
    next();
  });
};

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticateToken, profile);
router.delete('/profile', authenticateToken, deleteAccount);
router.get('/github/url', githubAuthUrl);
router.get('/github/callback', githubCallback);

export default router;
