import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import prisma from './lib/prisma.js';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix BigInt serialization for Prisma
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

dotenv.config({ path: path.resolve(process.cwd(), '../.env') }); // For dev
dotenv.config(); // For production if .env is in same dir

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Seed Admin Account and Recalculate Storage
const initializeSystem = async () => {
  try {
    const adminEmail = 'admin@ambali.site';
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const passwordHash = await bcrypt.hash('adminambali', 10);
      await prisma.user.create({
        data: {
          name: 'Super Admin',
          email: adminEmail,
          passwordHash,
          role: 'admin'
        }
      });
      console.log('Seeded super admin account.');
    }

    // One-time fix: Recalculate storage for all users
    const users = await prisma.user.findMany();
    for (const user of users) {
      const files = await prisma.file.findMany({ where: { ownerId: user.id, type: { not: 'folder' } } });
      const totalSize = files.reduce((acc, f) => acc + f.size, BigInt(0));
      if (user.storageUsed !== totalSize) {
        await prisma.user.update({
          where: { id: user.id },
          data: { storageUsed: totalSize }
        });
        console.log(`Recalculated storage for ${user.email}: ${totalSize} bytes`);
      }
    }
  } catch (err) {
    console.error('Failed to initialize system', err);
  }
};
initializeSystem();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      upgradeInsecureRequests: null,
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*"],
      connectSrc: ["'self'", "https://*", "wss://*"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://*.firebaseapp.com", "https://*.firebaseapp.com/"],
    },
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files if they exist (Production mode)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

import authRoutes from './routes/auth.js';
import filesRoutes from './routes/files.js';
import shareRoutes from './routes/share.js';
import adminRoutes from './routes/admin.js';

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Fallback to React index.html for all non-API routes
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
