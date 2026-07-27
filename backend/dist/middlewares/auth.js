import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
export const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    if (!token && req.query.token) {
        token = req.query.token;
    }
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Check database for role, isBlocked, and sessionId
        const dbUser = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { role: true, isBlocked: true, sessionId: true }
        });
        if (!dbUser) {
            return res.status(401).json({ error: 'Unauthorized: User not found' });
        }
        if (dbUser.isBlocked) {
            return res.status(403).json({ error: 'Your account has been blocked by an administrator.' });
        }
        if (dbUser.sessionId && decoded.sessionId && dbUser.sessionId !== decoded.sessionId) {
            return res.status(401).json({ error: 'Session expired: Logged in from another device.' });
        }
        req.user = { userId: decoded.userId, role: dbUser.role, sessionId: decoded.sessionId };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
export const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Requires admin privileges' });
    }
    next();
};
