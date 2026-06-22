import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';
import { Repository } from '../models/Repository';
import { RepositoryFile } from '../models/RepositoryFile';
import { UserRepoTracker } from '../models/UserRepoTracker';
import { ChatMessage } from '../models/ChatMessage';
import { RepositoryFlow } from '../models/RepositoryFlow';
import { getQdrantClient, COLLECTION_NAME } from '../services/qdrant.service';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, passwordHash });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Server error during registration' });
    }
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Server error during login' });
    }
  }
};

export const profile = async (req: Request, res: Response): Promise<void> => {
  try {
    // Basic implementation relies on middleware extracting userId from token and appending to request
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
};

export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete user's chat messages
    await ChatMessage.deleteMany({ userId });

    // Delete user's flows
    await RepositoryFlow.deleteMany({ userId });

    // Delete the tracking entries
    await UserRepoTracker.deleteMany({ userId });

    // If the user happens to be the 'creator' of any repositories, unset userId to fully decouple
    await Repository.updateMany({ userId }, { $unset: { userId: 1 } });

    // Delete user
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Server error deleting account' });
  }
};

export const githubAuthUrl = async (req: Request, res: Response): Promise<void> => {
  const clientOrigin = req.query.origin || req.headers.origin || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${clientOrigin}/api/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read:user user:email',
  });
  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.json({ url: authUrl });
};

export const githubCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;

    if (!code) {
      res.status(400).send('No code provided');
      return;
    }

    // Get access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code as string
      })
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      res.status(400).send(`Error: ${tokenData.error_description}`);
      return;
    }

    const accessToken = tokenData.access_token;

    // Get user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();

    // Get user email
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const emailsData = await emailsRes.json();
    const primaryEmail = emailsData.find((e: any) => e.primary)?.email || emailsData[0]?.email || `${userData.login}@users.noreply.github.com`;

    // Find or create user
    let user = await User.findOne({ email: primaryEmail });
    if (!user) {
      user = new User({
        name: userData.name || userData.login,
        email: primaryEmail,
        passwordHash: 'github-oauth', // Placeholder password hash since it's OAuth
      });
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    // Send success message to parent window and close popup
    res.send(`
      <html>
        <body>
          <script>
            try {
              localStorage.setItem('token', '${token}');
            } catch (e) {}

            if (window.opener) {
              window.opener.postMessage(
                { 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  token: '${token}', 
                  user: ${JSON.stringify({ id: user._id, name: user.name, email: user.email })} 
                }, 
                '*'
              );
              setTimeout(() => window.close(), 500);
            } else {
              window.location.replace('/?token=${token}');
            }
          </script>
          <p>Authentication successful. If this window does not close automatically, please return to the application.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('GitHub OAuth error:', err);
    res.status(500).send('Authentication failed');
  }
};

