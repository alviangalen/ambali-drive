import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middlewares/auth.js';
import { verifyGoogleToken } from '../lib/firebase.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Helper to generate token
const generateToken = (userId: string, sessionId?: string) => {
  const payload: any = { userId };
  if (sessionId) payload.sessionId = sessionId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

async function establishSession(user: any, req: Request) {
  const sessionId = uuidv4();
  
  if (user.role === 'admin') {
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionId }
    });
    return sessionId;
  } else {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress) || 'Unknown';
    const device = req.headers['user-agent'] || 'Unknown Device';
    let location = 'Local Network';
    
    const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.0\.0\.1|::1)/.test(ipAddress);
    
    if (!isPrivate && ipAddress !== 'Unknown') {
      try {
        const res = await fetch(`http://ip-api.com/json/${ipAddress}?fields=city,country,status`);
        const data = await res.json();
        if (data.status === 'success') {
          location = `${data.city}, ${data.country}`;
        }
      } catch (e) {}
    }

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        ipAddress,
        device,
        location
      }
    });
    return session.id;
  }
}

// Register
router.post('/register', async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const sessionId = uuidv4();
    const user = await prisma.user.create({
      data: { name, email, passwordHash, sessionId }
    });

    const token = generateToken(user.id, sessionId);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked by an administrator.' });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const sessionId = await establishSession(user, req);
    const token = generateToken(user.id, sessionId);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google Login
router.post('/google', async (req: Request, res: Response): Promise<any> => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    const decodedToken = await verifyGoogleToken(idToken);
    const { email, name, uid } = decodedToken;

    if (!email) {
      return res.status(400).json({ error: 'Email not found in Google token' });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (user?.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked by an administrator.' });
    }
    if (!user) {
      // Register via Google if not exists
      user = await prisma.user.create({
        data: {
          email,
          name: name || 'Google User',
          passwordHash: null, // Google auth has no local password
        }
      });
    }

    const sessionId = await establishSession(user, req);
    const token = generateToken(user.id, sessionId);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Google Login error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});


// PUT /profile
router.put('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { name, oldPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updateData: any = {};
    if (name) updateData.name = name;

    if (newPassword) {
      if (!user.passwordHash) {
        return res.status(400).json({ error: 'Cannot change password for Google-linked accounts' });
      }
      if (!oldPassword) {
        return res.status(400).json({ error: 'Old password is required' });
      }
      const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid old password' });
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    res.json({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /sessions
router.get('/sessions', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.userId;
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { lastActive: 'desc' },
      select: { id: true, ipAddress: true, device: true, location: true, lastActive: true, createdAt: true }
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// DELETE /sessions/:id
router.delete('/sessions/:id', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id as string;
    
    // Validate ownership
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.session.delete({ where: { id: sessionId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

export default router;

