# Dooky Workflow

This project now has two distinct operating modes:

- local development
- production deployment

The important idea is:

- the local repo is the source of truth
- the home server and ASO are deployment targets

## 1. Local Development

Use this mode when you are:

- changing design
- editing code
- testing the gallery locally
- checking backend behavior before deployment

### Local locations

- repo: `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\dookydetective`
- local backend file: `server.ts`
- local frontend files: `src\...`
- shared media root: `\\JEFFERSHIZZLE-D\Dotcoms E\images\dookydetective`

### Local commands

Frontend:

```powershell
Set-Location "C:\Users\wmjef\Desktop\Precious Box\Dotcoms\dookydetective"
npm run dev
```

Backend:

```powershell
Set-Location "C:\Users\wmjef\Desktop\Precious Box\Dotcoms\dookydetective"
npm run server
```

### Local URLs

- frontend: `http://localhost:3000`
- backend: `http://localhost:8020`
- backend health: `http://localhost:8020/health`

### Local behavior

- frontend uses `.env.development`
- frontend points to `http://localhost:8020`
- backend will try `E:\images\dookydetective` first
- if that is unavailable, backend falls back to `\\JEFFERSHIZZLE-D\Dotcoms E\images\dookydetective`

## 2. Production Deployment

Use this mode when you are:

- updating the live website
- updating the live API
- updating the home-server image source

### Production locations

Frontend host:

- `dookydetective.com` on ASO

Backend host:

- `E:\dookydetective\backend`
- `E:\images\dookydetective`

Public API:

- `https://api.dookydetective.com`

### Production frontend deploy

Build and publish locally:

```powershell
Set-Location "C:\Users\wmjef\Desktop\Precious Box\Dotcoms\dookydetective"
npm run publish
```

This command:

- builds the frontend
- uploads the contents of `dist\` to the ASO web root for `dookydetective.com`
- syncs backend source files to the home-server backend folder

If `dist\` is already fresh, use:

```powershell
npm run publish -- --skip-build
```

### Production backend deploy

If backend code changed locally, `npm run publish` now syncs the relevant backend runtime files to:

```powershell
\\JEFFERSHIZZLE-D\Dotcoms E\dookydetective\backend
```

The sync preserves live runtime-only files and folders:

- `.env`
- `images`
- `node_modules`

After backend code changes, restart the Dooky server on the home server:

```powershell
Set-Location E:\dookydetective\backend
npm run server
```

### Production tunnel/API

Live API depends on:

- backend running on port `8020`
- Cloudflare tunnel `api-dookydetective`
- DNS for `api.dookydetective.com`

## 3. Which Process Am I Following?

### If the goal is visual/code work

Follow:

- local development process

You do not need:

- ASO
- home server backend
- Cloudflare

### If the goal is making the live site change

Follow:

- production deployment process

You usually need:

- local repo
- ASO for frontend upload
- home server for backend update
- Cloudflare only if tunnel/API setup changed

## 4. Quick Decision Guide

### I want to change the design

Use local development.

### I want to test image loading locally

Use local development.

### I want the live site to show my frontend changes

Build locally, then upload `dist\` to ASO.

### I changed backend code and want the live API updated

Push to GitHub, then pull/restart the backend on the home server.

### I only changed image folders on the home server

No frontend rebuild is needed.

## 5. Source Of Truth

The source of truth for code is:

- `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\dookydetective`

The source of truth for live production images is:

- `E:\images\dookydetective`

The source of truth for the live frontend build output is:

- local `dist\` before upload to ASO
