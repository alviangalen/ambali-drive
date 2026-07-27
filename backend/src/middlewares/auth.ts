import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): any => {
  const authHeader = req.headers.authorization;
  let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
