import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middlewares/auth.js';
const router = Router();
// Create a share link
router.post('/:fileId/link', authenticate, async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const { allowDownload } = req.body;
        const userId = req.user.userId;
        const file = await prisma.file.findUnique({
            where: { id: fileId, ownerId: userId }
        });
        if (!file)
            return res.status(404).json({ error: 'File not found' });
        let link = await prisma.publicLink.findUnique({ where: { fileId } });
        if (!link) {
            link = await prisma.publicLink.create({
                data: {
                    fileId,
                    urlHash: uuidv4().slice(0, 8),
                    allowDownload: allowDownload ?? true
                }
            });
        }
        res.json(link);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create share link' });
    }
});
// Remove share link
router.delete('/:fileId/link', authenticate, async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const userId = req.user.userId;
        const file = await prisma.file.findUnique({
            where: { id: fileId, ownerId: userId }
        });
        if (!file)
            return res.status(404).json({ error: 'File not found' });
        await prisma.publicLink.deleteMany({
            where: { fileId }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to remove share link' });
    }
});
// Get Public File (No Auth)
router.get('/public/:hash', async (req, res) => {
    try {
        const hash = req.params.hash;
        const link = await prisma.publicLink.findUnique({
            where: { urlHash: hash },
            include: { file: true }
        });
        if (!link)
            return res.status(404).json({ error: 'Link not found' });
        res.json({ file: link.file, allowDownload: link.allowDownload });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get public link' });
    }
});
export default router;
