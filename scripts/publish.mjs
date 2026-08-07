import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFilesRecursively, readDeployConfig, uploadFileViaFtp } from './ftp-upload.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployConfigPath = path.join(repoRoot, '.vscode', 'sftp.json');
const distDir = path.join(repoRoot, 'dist');
const backendTarget = process.env.DOOKY_BACKEND_DIR || '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\dookydetective\\backend';

const backendCopies = [
  '.env.development',
  '.env.example',
  '.env.production',
  '.gitignore',
  'DOOKY_WORKFLOW.md',
  'README.md',
  'dist',
  'dooky-book.png',
  'dookydetective.code-workspace',
  'favicon.svg',
  'index.html',
  'metadata.json',
  'package-lock.json',
  'package.json',
  'public',
  'scripts',
  'server.ts',
  'src',
  'tsconfig.json',
  'vite.config.ts',
];

const replaceBeforeCopy = [
  'dist',
  'public',
  'scripts',
  'src',
];

const preserveOnTarget = [
  '.env',
  'images',
  'node_modules',
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      continue;
    }

    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function runBuild() {
  console.log('Building Dooky Detective...');
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], { cwd: repoRoot, stdio: 'inherit' })
    : spawnSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });

  if (result.status !== 0) {
    throw new Error(`Dooky Detective build failed with exit code ${result.status ?? 1}`);
  }
}

function ensureDeployConfig() {
  const deployConfig = readDeployConfig(deployConfigPath);
  if (!deployConfig) {
    throw new Error('No FTP deploy config found. Set uploadHost, username, password, and remotePath in .vscode/sftp.json.');
  }

  if (deployConfig.protocol !== 'ftp') {
    throw new Error(`Unsupported protocol "${deployConfig.protocol}" in deploy config. Only ftp is supported.`);
  }

  return deployConfig;
}

function publishDist(deployConfig) {
  if (!existsSync(distDir)) {
    throw new Error(`Missing dist directory: ${distDir}. Build the app first.`);
  }

  const files = collectFilesRecursively(distDir);
  if (files.length === 0) {
    console.warn(`No files found in ${distDir}.`);
    return;
  }

  if (deployConfig.uploadHost === deployConfig.host) {
    console.warn('Using the public host as the FTP upload host. If Cloudflare is proxying that domain, uploads can fail.');
    console.warn('For the most reliable setup, point "uploadHost" at a DNS-only origin hostname such as ftp.<domain> or origin.<domain>.');
  }

  console.log(`Uploading ${files.length} file(s) from dist/ ...`);
  for (const file of files) {
    uploadFileViaFtp(deployConfig, file.absolutePath, file.relativePath);
  }

  console.log('Publish complete.');
}

function copyIfPresent(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    return;
  }

  cpSync(sourcePath, targetPath, { recursive: true, force: true, dereference: true });
}

function syncBackendSource() {
  mkdirSync(backendTarget, { recursive: true });

  for (const relativePath of replaceBeforeCopy) {
    const targetPath = path.join(backendTarget, relativePath);
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
  }

  for (const relativePath of backendCopies) {
    if (preserveOnTarget.includes(relativePath)) {
      continue;
    }

    copyIfPresent(path.join(repoRoot, relativePath), path.join(backendTarget, relativePath));
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args['skip-build']) {
    runBuild();
  }

  const deployConfig = ensureDeployConfig();
  publishDist(deployConfig);

  console.log(`Syncing Dooky Detective backend source to ${backendTarget}...`);
  syncBackendSource();

  console.log('Dooky Detective publish complete.');
}

main();
