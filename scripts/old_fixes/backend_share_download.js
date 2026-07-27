const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'backend/src/routes/share.ts');
let content = fs.readFileSync(file, 'utf8');

const downloadRoute = `
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

    res.download(filePath, link.file.name);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to download public file' });
  }
});

export default router;`;

content = content.replace(/export default router;/, downloadRoute);

// Need to import fs and path in share.ts if not already imported
if (!content.includes("import fs from 'fs'")) {
  content = content.replace(
    /import \{ Router, Response \} from 'express';/,
    `import { Router, Response } from 'express';\nimport fs from 'fs';\nimport path from 'path';`
  );
}

fs.writeFileSync(file, content);
console.log('Backend share download route added');
