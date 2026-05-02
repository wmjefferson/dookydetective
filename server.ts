import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { imageSize } from 'image-size';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: process.env.DOOKY_ENV_FILE || path.join(__dirname, '.env') });

const app = express();

const PORT = Number(process.env.PORT || 8020);
const IMAGES_ROOT = path.resolve(process.env.IMAGES_ROOT || 'E:\\dookydetective\\images');
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://api.dookydetective.com').replace(/\/$/, '');
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://dookydetective.com,https://www.dookydetective.com')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const validExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
};

type ImageRecord = {
  id: string;
  src: string;
  title: string;
  width: number;
  height: number;
};

async function walkImages(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkImages(fullPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      return validExtensions.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
    }),
  );

  return files.flat();
}

function toWebPath(filePath: string): string {
  const relativePath = path.relative(IMAGES_ROOT, filePath).split(path.sep).join('/');
  return `${PUBLIC_BASE_URL}/images/${encodeURI(relativePath)}`;
}

function buildId(filePath: string): string {
  return Buffer.from(filePath, 'utf8').toString('base64url');
}

async function readImages(): Promise<ImageRecord[]> {
  const files = await walkImages(IMAGES_ROOT);
  const images = await Promise.all(
    files.map(async filePath => {
      const dimensions = imageSize(await fs.readFile(filePath));
      if (!dimensions.width || !dimensions.height) {
        return null;
      }

      return {
        id: buildId(filePath),
        src: toWebPath(filePath),
        title: path.basename(filePath),
        width: dimensions.width,
        height: dimensions.height,
      } satisfies ImageRecord;
    }),
  );

  return images.filter((image): image is ImageRecord => image !== null);
}

app.use(cors(corsOptions));
app.use(express.json());
app.use('/images', express.static(IMAGES_ROOT));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    imagesRoot: IMAGES_ROOT,
    publicBaseUrl: PUBLIC_BASE_URL,
  });
});

app.get('/api/images', async (_req, res) => {
  try {
    const images = await readImages();
    res.json(images);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load images',
    });
  }
});

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Dooky Detective API</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f3f4f6;
        color: #111827;
        font: 16px/1.5 "Segoe UI", Arial, sans-serif;
      }
      main {
        width: min(560px, calc(100vw - 48px));
        padding: 28px 32px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        box-shadow: 0 12px 28px rgba(17, 24, 39, 0.08);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }
      p {
        margin: 0 0 16px;
      }
      code {
        display: inline-block;
        padding: 2px 6px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
      }
      ul {
        margin: 0;
        padding-left: 18px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Dooky Detective API</h1>
      <p>The image service is running.</p>
      <ul>
        <li><code>/health</code> returns service status</li>
        <li><code>/api/images</code> returns the image feed</li>
      </ul>
    </main>
  </body>
</html>`);
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/images/')) {
    next();
    return;
  }

  res.status(404).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Not Found</title>
  </head>
  <body>
    <p>Not found.</p>
  </body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Dooky Detective API running on http://localhost:${PORT}`);
  console.log(`Images root: ${IMAGES_ROOT}`);
});
