import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { authenticate, isAdmin } from '../middlewares/auth.js';
const router = Router();
// Rate limiting for admin routes (20 requests per 10 minutes)
const adminLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 100, // Increased to 100 so regular admin usage isn't blocked too easily, but still protects against brute force
    message: { error: 'Too many requests from this IP, please try again after 10 minutes' }
});
router.use(authenticate, isAdmin, adminLimiter);
// Helper to log audit
const logAudit = async (adminId, action, targetId, details, ipAddress) => {
    try {
        await prisma.auditLog.create({
            data: { adminId, action, targetId, details, ipAddress }
        });
    }
    catch (err) {
        console.error('Audit log failed:', err);
    }
};
// GET /users - List all users
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true, name: true, email: true, role: true,
                storageQuota: true, storageUsed: true, isBlocked: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        // Convert BigInt to string for JSON serialization
        const serialized = users.map(u => ({
            ...u,
            storageQuota: Number(u.storageQuota),
            storageUsed: Number(u.storageUsed)
        }));
        res.json(serialized);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /users/:id/block - Block or unblock a user
router.put('/users/:id/block', async (req, res) => {
    try {
        const { id } = req.params;
        const { isBlocked } = req.body;
        if (id === req.user?.userId) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }
        const user = await prisma.user.update({
            where: { id: id },
            data: { isBlocked, sessionId: isBlocked ? null : undefined } // Clear session to force logout if blocked
        });
        await logAudit(req.user.userId, isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER', user.id, `User ${user.email} was ${isBlocked ? 'blocked' : 'unblocked'}`, req.ip);
        res.json({ success: true, isBlocked: user.isBlocked });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});
// PUT /users/:id/quota - Update user storage quota
router.put('/users/:id/quota', async (req, res) => {
    try {
        const { id } = req.params;
        const { quotaBytes } = req.body;
        if (typeof quotaBytes !== 'number' || quotaBytes < 0) {
            return res.status(400).json({ error: 'Invalid quota value' });
        }
        const user = await prisma.user.update({
            where: { id: id },
            data: { storageQuota: BigInt(quotaBytes) }
        });
        await logAudit(req.user.userId, 'UPDATE_QUOTA', user.id, `User ${user.email} quota updated to ${quotaBytes} bytes`, req.ip);
        res.json({ success: true, storageQuota: Number(user.storageQuota) });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update user quota' });
    }
});
// GET /logs - Get audit logs
router.get('/logs', async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            include: { admin: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(logs);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /stats - Get system stats
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await prisma.user.count();
        const totalFiles = await prisma.file.count({ where: { type: { not: 'folder' } } });
        // Sum of storage used
        const users = await prisma.user.findMany({ select: { storageUsed: true } });
        const totalStorageUsed = users.reduce((acc, user) => acc + Number(user.storageUsed), 0);
        res.json({ totalUsers, totalFiles, totalStorageUsed });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /change-password
router.put('/change-password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'Missing fields' });
        }
        const admin = await prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!admin || !admin.passwordHash) {
            return res.status(400).json({ error: 'Admin account error' });
        }
        const isMatch = await bcrypt.compare(oldPassword, admin.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect old password' });
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        await prisma.user.update({
            where: { id: req.user.userId },
            data: { passwordHash }
        });
        await logAudit(req.user.userId, 'CHANGE_PASSWORD', req.user.userId, 'Admin changed their password', req.ip);
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export default router;
