import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middlewares/auth.js';

const router = Router();

// Create a share link
router.post('/:fileId/link', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const fileId = req.params.fileId as string;
    const { allowDownload, password, expiresAt } = req.body;
    const userId = req.user!.userId;

    const file = await prisma.file.findUnique({
      where: { id: fileId, ownerId: userId }
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    let link = await prisma.publicLink.findUnique({ where: { fileId } });
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }
    
    if (!link) {
      link = await prisma.publicLink.create({
        data: {
          fileId,
          urlHash: uuidv4().slice(0, 8),
          allowDownload: allowDownload ?? true,
          passwordHash,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });
    } else {
      link = await prisma.publicLink.update({
        where: { id: link.id },
        data: {
          allowDownload: allowDownload ?? true,
          passwordHash: password === null ? null : (passwordHash || link.passwordHash),
          expiresAt: expiresAt === null ? null : (expiresAt ? new Date(expiresAt) : link.expiresAt)
        }
      });
    }
    
    res.json(link);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// Remove share link
router.delete('/:fileId/link', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const fileId = req.params.fileId as string;
    const userId = req.user!.userId;

    const file = await prisma.file.findUnique({
      where: { id: fileId, ownerId: userId }
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    await prisma.publicLink.deleteMany({
      where: { fileId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove share link' });
  }
});

// Get Public File (No Auth)
router.get('/public/:hash', async (req, res): Promise<any> => {
  try {
    const hash = req.params.hash as string;
    const { password } = req.query;
    const link = await prisma.publicLink.findUnique({
      where: { urlHash: hash },
      include: { file: { include: { owner: { select: { name: true } } } } }
    });

    if (!link) return res.status(404).json({ error: 'Link not found' });
    
    // Check expiry
    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(403).json({ error: 'Link has expired' });
    }

    // Check password
    if (link.passwordHash) {
      if (!password) {
        return res.status(401).json({ error: 'Password required', requirePassword: true });
      }
      const isValid = await bcrypt.compare(password as string, link.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    res.json({ file: link.file, allowDownload: link.allowDownload });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get public link' });
  }
});


// Download Public File (No Auth)
router.get('/public/:hash/download', async (req, res): Promise<any> => {
  try {
    const hash = req.params.hash as string;
    const { password } = req.query;
    
    const link = await prisma.publicLink.findUnique({
      where: { urlHash: hash },
      include: { file: true }
    });

    if (!link) return res.status(404).json({ error: 'Link not found' });
    
    // Check expiry
    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(403).json({ error: 'Link has expired' });
    }

    // Check password
    if (link.passwordHash) {
      if (!password) {
        return res.status(401).json({ error: 'Password required' });
      }
      const isValid = await bcrypt.compare(password as string, link.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    if (!link.allowDownload) {
      return res.status(403).json({ error: 'Download not allowed' });
    }

    const storageDir = path.resolve(process.cwd(), '../storage/uploads');
    const filePath = link.file.physicalPath ? path.join(storageDir, link.file.physicalPath) : null;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file missing' });
    }

    if (req.query.preview === 'true') {
      res.sendFile(filePath);
    } else {
      res.download(filePath, link.file.name);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to download public file' });
  }
});

export default router;
