import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import { verifyGoogleToken } from '../lib/firebase.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Helper to generate token
const generateToken = (userId: string, sessionId?: string) => {
  const payload: any = { userId };
  if (sessionId) payload.sessionId = sessionId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

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

    const sessionId = uuidv4();
    user = await prisma.user.update({
      where: { id: user.id },
      data: { sessionId }
    });
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

    const sessionId = uuidv4();
    user = await prisma.user.update({
      where: { id: user.id },
      data: { sessionId }
    });
    const token = generateToken(user.id, sessionId);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Google Login error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

export default router;
