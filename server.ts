import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { imageSize } from 'image-size';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: process.env.DOOKY_ENV_FILE || path.join(__dirname, '.env') });

const app = express();

const PORT = Number(process.env.PORT || 8020);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://api.dookydetective.com').replace(/\/$/, '');
// MEDIA_BASE_URL controls where actual media files (videos, photos, posters) are served from.
// Set this to your ASO host to deliver large binary files from the fast shared hosting server
// instead of routing through the Cloudflare tunnel. Defaults to PUBLIC_BASE_URL (backward compat).
const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || PUBLIC_BASE_URL).replace(/\/$/, '');
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://dookydetective.com,https://www.dookydetective.com')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Root resolution — single MEDIA_ROOT, subfolders derived from it
// ---------------------------------------------------------------------------

function resolveMediaRoot(): string {
  const candidates = [
    process.env.MEDIA_ROOT,
    'E:\\images\\dookydetective',
    '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\images\\dookydetective',
  ].filter((v): v is string => Boolean(v?.trim()));

  return (
    candidates.map(c => path.resolve(c)).find(c => existsSync(c))
    ?? path.resolve(candidates[0] ?? 'E:\\images\\dookydetective')
  );
}

const MEDIA_ROOT   = resolveMediaRoot();
const PHOTOS_ROOT  = path.join(MEDIA_ROOT, 'photos');
const VIDEOS_ROOT  = path.join(MEDIA_ROOT, 'videos');
const POSTERS_ROOT = path.join(MEDIA_ROOT, 'posters');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MediaRecord = {
  id: string;
  type: 'image' | 'video';
  src: string;
  poster?: string;
  title: string;
  width: number;
  height: number;
  duration?: number;
};

// ---------------------------------------------------------------------------
// Shared file walker
// ---------------------------------------------------------------------------

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const videoExtensions = new Set(['.mp4', '.webm', '.mov']);

async function walkDir(dir: string, extensions: Set<string>): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkDir(fullPath, extensions);
      if (!entry.isFile()) return [];
      return extensions.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
    }),
  );
  return files.flat();
}

// ---------------------------------------------------------------------------
// ID and URL helpers
// ---------------------------------------------------------------------------

function buildId(filePath: string): string {
  return Buffer.from(filePath, 'utf8').toString('base64url');
}

function toPhotoUrl(filePath: string): string {
  const rel = path.relative(PHOTOS_ROOT, filePath).split(path.sep).join('/');
  return `${MEDIA_BASE_URL}/photos/${encodeURI(rel)}`;
}

function toVideoUrl(filePath: string): string {
  const rel = path.relative(VIDEOS_ROOT, filePath).split(path.sep).join('/');
  return `${MEDIA_BASE_URL}/videos/${encodeURI(rel)}`;
}

function toPosterUrl(videoFilePath: string): string {
  // Use the video's own filename as the poster name (e.g. DDT01.jpg) — simple, human-readable,
  // easy to manage on FTP and easy to verify in ASO File Manager.
  const baseName = path.basename(videoFilePath, path.extname(videoFilePath));
  return `${MEDIA_BASE_URL}/posters/${encodeURIComponent(baseName)}.jpg`;
}

function toPosterPath(videoFilePath: string): string {
  const baseName = path.basename(videoFilePath, path.extname(videoFilePath));
  return path.join(POSTERS_ROOT, `${baseName}.jpg`);
}

// ---------------------------------------------------------------------------
// Binary resolution — find ffprobe / ffmpeg without relying on PATH
//
// winget installs Gyan.FFmpeg to %LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\
// Node child processes don't always inherit the user PATH where winget registers
// the aliases, so we search the actual install directory directly.
// ---------------------------------------------------------------------------

import { readdirSync } from 'fs';

function findBinary(name: string): string | null {
  const exe = `${name}.exe`;

  // 1. Search winget packages for every user profile on this machine
  const usersRoot = path.resolve('C:\\Users');
  try {
    const userDirs = readdirSync(usersRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(usersRoot, d.name));

    for (const userDir of userDirs) {
      const wingetPkgs = path.join(userDir, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
      if (!existsSync(wingetPkgs)) continue;

      const ffmpegPkgs = readdirSync(wingetPkgs, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.startsWith('Gyan.FFmpeg'))
        .map(d => path.join(wingetPkgs, d.name));

      for (const pkgDir of ffmpegPkgs) {
        // Package contains one subfolder like ffmpeg-9.0.1-full_build/
        const subDirs = readdirSync(pkgDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => path.join(pkgDir, d.name, 'bin', exe));

        for (const candidate of subDirs) {
          if (existsSync(candidate)) return candidate;
        }
      }
    }
  } catch { /* ignore scan errors */ }

  // 2. Common manual install paths
  for (const p of [
    `C:\\ffmpeg\\bin\\${exe}`,
    `C:\\Program Files\\ffmpeg\\bin\\${exe}`,
    `C:\\Program Files (x86)\\ffmpeg\\bin\\${exe}`,
  ]) {
    if (existsSync(p)) return p;
  }

  return null;
}

const FFPROBE_BIN = findBinary('ffprobe');
const FFMPEG_BIN  = findBinary('ffmpeg');

// ---------------------------------------------------------------------------
// ffprobe — extract video dimensions and duration
// ---------------------------------------------------------------------------

type VideoMeta = { width: number; height: number; duration: number } | null;

function probeVideo(filePath: string): VideoMeta {
  if (!FFPROBE_BIN) return null;

  const result = spawnSync(FFPROBE_BIN, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-select_streams', 'v:0',
    filePath,
  ], { encoding: 'utf8' });

  if (result.status !== 0 || !result.stdout) return null;

  try {
    const data = JSON.parse(result.stdout);
    const stream = data?.streams?.[0];
    if (!stream?.width || !stream?.height) return null;
    return {
      width: stream.width,
      height: stream.height,
      duration: parseFloat(stream.duration ?? '0') || 0,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Poster generation — extract first frame with ffmpeg, cached to disk
// ---------------------------------------------------------------------------

async function ensurePoster(videoPath: string): Promise<string | undefined> {
  if (!FFMPEG_BIN) return undefined;

  // mkdir failure (e.g. already exists) should not abort poster generation
  await fs.mkdir(POSTERS_ROOT, { recursive: true }).catch(() => {});

  const posterPath = toPosterPath(videoPath);
  if (existsSync(posterPath)) return toPosterUrl(videoPath);

  const result = spawnSync(FFMPEG_BIN, [
    '-y',
    '-ss', '0',
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '3',
    posterPath,
  ], { encoding: 'utf8' });

  if (result.status === 0 && existsSync(posterPath)) {
    return toPosterUrl(videoPath);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Media readers
// ---------------------------------------------------------------------------

async function readPhotos(): Promise<MediaRecord[]> {
  const files = await walkDir(PHOTOS_ROOT, imageExtensions);
  const records = await Promise.all(
    files.map(async filePath => {
      try {
        const dimensions = imageSize(await fs.readFile(filePath));
        if (!dimensions.width || !dimensions.height) return null;
        return {
          id: buildId(filePath),
          type: 'image' as const,
          src: toPhotoUrl(filePath),
          title: path.basename(filePath),
          width: dimensions.width,
          height: dimensions.height,
        } as MediaRecord;
      } catch {
        return null;
      }
    }),
  );
  return records.filter((r): r is MediaRecord => r !== null);
}

async function readVideos(): Promise<MediaRecord[]> {
  const files = await walkDir(VIDEOS_ROOT, videoExtensions);
  const records = await Promise.all(
    files.map(async filePath => {
      try {
        const meta = probeVideo(filePath);
        if (!meta) return null;
        const id = buildId(filePath);
        const poster = await ensurePoster(filePath);
        return {
          id,
          type: 'video' as const,
          src: toVideoUrl(filePath),
          poster,
          title: path.basename(filePath),
          width: meta.width,
          height: meta.height,
          duration: meta.duration,
        } as MediaRecord;
      } catch {
        return null;
      }
    }),
  );
  return records.filter((r): r is MediaRecord => r !== null);
}

async function readMedia(): Promise<MediaRecord[]> {
  const [photos, videos] = await Promise.all([readPhotos(), readVideos()]);
  return [...photos, ...videos];
}

// ---------------------------------------------------------------------------
// CORS & middleware
// ---------------------------------------------------------------------------

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

app.use(cors(corsOptions));
app.use(express.json());

// Static file serving
app.use('/photos', express.static(PHOTOS_ROOT));
app.use('/videos', express.static(VIDEOS_ROOT));
app.use('/posters', express.static(POSTERS_ROOT));
// Backward-compat alias — old /images URLs still resolve
app.use('/images', express.static(PHOTOS_ROOT));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mediaRoot: MEDIA_ROOT,
    photosRoot: PHOTOS_ROOT,
    videosRoot: VIDEOS_ROOT,
    postersRoot: POSTERS_ROOT,
    publicBaseUrl: PUBLIC_BASE_URL,
    mediaBaseUrl: MEDIA_BASE_URL,
  });
});

app.get('/api/media', async (_req, res) => {
  try {
    const media = await readMedia();
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load media' });
  }
});

app.get('/api/photos', async (_req, res) => {
  try {
    const photos = await readPhotos();
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load photos' });
  }
});

app.get('/api/videos', async (_req, res) => {
  try {
    const videos = await readVideos();
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load videos' });
  }
});

// Backward-compat alias
app.get('/api/images', async (_req, res) => {
  try {
    const photos = await readPhotos();
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load images' });
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
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0 0 16px; }
      code {
        display: inline-block;
        padding: 2px 6px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
      }
      ul { margin: 0; padding-left: 18px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Dooky Detective API</h1>
      <p>The media service is running.</p>
      <ul>
        <li><code>/health</code> — service status</li>
        <li><code>/api/media</code> — all photos and videos</li>
        <li><code>/api/photos</code> — photos only</li>
        <li><code>/api/videos</code> — videos only</li>
        <li><code>/api/images</code> — alias for /api/photos</li>
      </ul>
    </main>
  </body>
</html>`);
});

app.get('*', (req, res, next) => {
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/photos/') ||
    req.path.startsWith('/videos/') ||
    req.path.startsWith('/posters/') ||
    req.path.startsWith('/images/')
  ) {
    next();
    return;
  }

  res.status(404).type('html').send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Not Found</title></head>
  <body><p>Not found.</p></body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Dooky Detective API running on http://localhost:${PORT}`);
  console.log(`Media root: ${MEDIA_ROOT}`);
  console.log(`  photos:  ${PHOTOS_ROOT}`);
  console.log(`  videos:  ${VIDEOS_ROOT}`);
  console.log(`  posters: ${POSTERS_ROOT}`);
  console.log(`ffprobe: ${FFPROBE_BIN ?? 'NOT FOUND — videos will be skipped'}`);
  console.log(`ffmpeg:  ${FFMPEG_BIN  ?? 'NOT FOUND — posters will be skipped'}`);
});
