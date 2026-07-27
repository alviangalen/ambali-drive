const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'backend/src/routes/share.ts');
let content = fs.readFileSync(file, 'utf8');

// Import bcryptjs
content = content.replace(
  /import \{ v4 as uuidv4 \} from 'uuid';/,
  `import { v4 as uuidv4 } from 'uuid';\nimport bcrypt from 'bcryptjs';`
);

// Update POST /:fileId/link
content = content.replace(
  /const \{ allowDownload \} = req\.body;/,
  `const { allowDownload, password, expiresAt } = req.body;`
);

content = content.replace(
  /if \(!link\) \{[\s\S]*?\}\n\n    res\.json\(link\);/,
  `let passwordHash = null;
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
    
    res.json(link);`
);

// Update GET /public/:hash to verify password and expiry
content = content.replace(
  /const link = await prisma\.publicLink\.findUnique\(\{[\s\S]*?\}\);/,
  `const { password } = req.query;
    const link = await prisma.publicLink.findUnique({
      where: { urlHash: hash },
      include: { file: { include: { owner: { select: { name: true } } } } }
    });`
);

content = content.replace(
  /if \(!link\) return res\.status\(404\)\.json\(\{ error: 'Link not found' \}\);\n\n    res\.json\(\{ file: link\.file, allowDownload: link\.allowDownload \}\);/,
  `if (!link) return res.status(404).json({ error: 'Link not found' });
    
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

    res.json({ file: link.file, allowDownload: link.allowDownload });`
);

fs.writeFileSync(file, content);
console.log('Backend share updated');
