import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDeployConfig, uploadFileViaFtp } from './ftp-upload.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployConfigPath = path.join(repoRoot, '.vscode', 'sftp.json');

function resolveMediaRoot() {
  const candidates = [
    process.env.MEDIA_ROOT,
    'E:\\images\\dookydetective',
    '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\images\\dookydetective',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return path.resolve(candidate);
  }
  return path.resolve(candidates[0]);
}

function collectFilesRecursively(rootDir, prefix = '') {
  const results = [];
  if (!existsSync(rootDir)) return results;

  const visit = (currentDir, relDir = '') => {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      const rel = relDir ? path.posix.join(relDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        visit(full, rel);
      } else if (entry.isFile()) {
        results.push({
          absolutePath: full,
          remoteRelativePath: path.posix.join(prefix, rel),
          size: statSync(full).size,
        });
      }
    }
  };

  visit(rootDir);
  return results;
}

function main() {
  const mediaRoot = resolveMediaRoot();
  console.log(`Media root: ${mediaRoot}`);

  if (!existsSync(mediaRoot)) {
    console.error(`Media root does not exist: ${mediaRoot}`);
    process.exit(1);
  }

  const deployConfig = readDeployConfig(deployConfigPath);
  if (!deployConfig) {
    console.error(`Could not read FTP deploy config from ${deployConfigPath}`);
    process.exit(1);
  }

  const photosDir = path.join(mediaRoot, 'photos');
  const videosDir = path.join(mediaRoot, 'videos');
  const postersDir = path.join(mediaRoot, 'posters');

  const photos = collectFilesRecursively(photosDir, 'photos');
  const videos = collectFilesRecursively(videosDir, 'videos');
  const posters = collectFilesRecursively(postersDir, 'posters');

  const allFiles = [...photos, ...videos, ...posters];
  console.log(`Found ${photos.length} photos, ${videos.length} videos, ${posters.length} posters (Total: ${allFiles.length} files)`);

  let count = 0;
  for (const file of allFiles) {
    count++;
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`[${count}/${allFiles.length}] Uploading ${file.remoteRelativePath} (${mb} MB)...`);
    uploadFileViaFtp(deployConfig, file.absolutePath, file.remoteRelativePath);
  }

  console.log(`\nSuccessfully uploaded ${allFiles.length} media files to ASO hosting!`);
}

main();
