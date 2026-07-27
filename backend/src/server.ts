import express from 'express';
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

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files if they exist (Production mode)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

import authRoutes from './routes/auth.js';
import filesRoutes from './routes/files.js';
import shareRoutes from './routes/share.js';

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/share', shareRoutes);

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
