import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middlewares/auth.js';

const router = Router();

// Configure Multer for local storage
const storageDir = path.resolve(process.cwd(), '../storage/uploads');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storageDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

async function getUniqueFilename(ownerId: string, parentId: string | null, originalName: string, isFolder: boolean = false): Promise<string> {
  const existingFiles = await prisma.file.findMany({
    where: { ownerId, parentId, isTrashed: false, type: isFolder ? 'folder' : { not: 'folder' } },
    select: { name: true }
  });
  const names = new Set(existingFiles.map(f => f.name));
  
  if (!names.has(originalName)) return originalName;

  const dotIndex = originalName.lastIndexOf('.');
  const base = dotIndex !== -1 && !isFolder ? originalName.slice(0, dotIndex) : originalName;
  const ext = dotIndex !== -1 && !isFolder ? originalName.slice(dotIndex) : '';

  let i = 1;
  let newName = `${base} (${i})${ext}`;
  while (names.has(newName)) {
    i++;
    newName = `${base} (${i})${ext}`;
  }
  return newName;
}

// Create Folder
router.post('/folder', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { name, parentId } = req.body;
    const userId = req.user!.userId;

    if (!name) return res.status(400).json({ error: 'Folder name is required' });

    const finalName = await getUniqueFilename(userId, parentId || null, name, true);

    const folder = await prisma.file.create({
      data: {
        name: finalName,
        type: 'folder',
        ownerId: userId,
        parentId: parentId || null
      }
    });
    res.status(201).json(folder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Upload File
router.post('/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const file = req.file;
    const { parentId } = req.body;
    const userId = req.user!.userId;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    if (req.aborted || req.socket.destroyed) {
      if (file.path) {
        fs.unlink(file.path, () => {});
      }
      return res.status(400).json({ error: 'Upload canceled by client' });
    }

    // Determine type by mimetype loosely
    let type = 'file';
    if (file.mimetype?.startsWith('image/')) type = 'image';
    else if (file.mimetype?.startsWith('video/')) type = 'video';
    else if (file.mimetype === 'application/pdf') type = 'pdf';

    const finalName = await getUniqueFilename(userId, parentId || null, file.originalname, false);

    const dbFile = await prisma.file.create({
      data: {
        name: finalName,
        type,
        size: file.size ? BigInt(file.size) : BigInt(0),
        physicalPath: file.filename, // just the filename, directory is known
        ownerId: userId,
        parentId: parentId || null
      }
    });
    
    // Update user storage
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { increment: file.size ? BigInt(file.size) : BigInt(0) } }
    });

    res.status(201).json(dbFile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// List Files/Folders (with trash filtering)
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.userId;
    const parentId = req.query.parentId as string;
    const isTrashed = req.query.trashed === 'true';

    const files = await prisma.file.findMany({
      where: {
        ownerId: userId,
        parentId: isTrashed ? undefined : (parentId || null),
        isTrashed
      },
      orderBy: [
        { type: 'desc' }, // Folders first? Prisma string sort would sort 'folder' alphabetically...
        { name: 'asc' }
      ],
      include: {
        publicLink: true
      }
    });

    // Post-sort to put folders first
    files.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get total storage used and quota
router.get('/storage', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsed: true, storageQuota: true }
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({ 
      used: Number(user.storageUsed), 
      quota: Number(user.storageQuota) 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate storage' });
  }
});

// Rename
router.put('/:id/rename', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;
    const userId = req.user!.userId;

    if (!name) return res.status(400).json({ error: 'New name is required' });

    const existing = await prisma.file.findUnique({ where: { id, ownerId: userId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const finalName = await getUniqueFilename(userId, existing.parentId, name, existing.type === 'folder');

    const file = await prisma.file.update({
      where: { id, ownerId: userId },
      data: { name: finalName }
    });
    res.json(file);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to rename' });
  }
});

// Move
router.put('/:id/move', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { parentId } = req.body;
    const userId = req.user!.userId;

    const existing = await prisma.file.findUnique({ where: { id, ownerId: userId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const finalName = await getUniqueFilename(userId, parentId || null, existing.name, existing.type === 'folder');

    const file = await prisma.file.update({
      where: { id, ownerId: userId },
      data: { 
        parentId: parentId || null,
        name: finalName
      }
    });
    res.json(file);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to move' });
  }
});

// Copy
router.post('/:id/copy', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { parentId } = req.body;
    const userId = req.user!.userId;

    const existing = await prisma.file.findUnique({ where: { id, ownerId: userId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    
    // We only support copying files for now
    if (existing.type === 'folder') {
      return res.status(400).json({ error: 'Cannot copy folders yet' });
    }

    const finalName = await getUniqueFilename(userId, parentId || null, existing.name, false);

    let newPhysicalPath = null;
    if (existing.physicalPath) {
      const srcPath = path.join(storageDir, existing.physicalPath);
      if (fs.existsSync(srcPath)) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        newPhysicalPath = uniqueSuffix + '-' + path.basename(existing.physicalPath);
        const destPath = path.join(storageDir, newPhysicalPath);
        fs.copyFileSync(srcPath, destPath);
      }
    }

    const copiedFile = await prisma.file.create({
      data: {
        name: finalName,
        type: existing.type,
        size: existing.size,
        physicalPath: newPhysicalPath,
        ownerId: userId,
        parentId: parentId || null
      }
    });

    // Update user storage
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { increment: existing.size } }
    });

    res.json(copiedFile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to copy' });
  }
});

// Trash (Move to trash)
router.put('/:id/trash', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const file = await prisma.file.update({
      where: { id, ownerId: userId },
      data: { isTrashed: true, trashedAt: new Date() }
    });
    res.json(file);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to move to trash' });
  }
});

// Restore from trash
router.put('/:id/restore', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const file = await prisma.file.update({
      where: { id, ownerId: userId },
      data: { isTrashed: false, trashedAt: null }
    });
    res.json(file);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to restore' });
  }
});

// Download File
router.get('/:id/download', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const file = await prisma.file.findUnique({
      where: { id, ownerId: userId } // Simplified: assumes owner only. Share logic would check shares.
    });

    if (!file || file.type === 'folder' || !file.physicalPath) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(storageDir, file.physicalPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file missing' });
    }

    if (req.query.preview === 'true') {
      res.sendFile(filePath);
    } else {
      res.download(filePath, file.name);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete Permanently (Empty Trash)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const file = await prisma.file.findUnique({
      where: { id, ownerId: userId }
    });

    if (!file) return res.status(404).json({ error: 'File not found' });

    if (file.physicalPath) {
      const filePath = path.join(storageDir, file.physicalPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.file.delete({
      where: { id }
    });

    // Update user storage
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { decrement: file.size } }
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
