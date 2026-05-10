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
- local image fallback folder: `images\`

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
- backend will try `E:\dookydetective\images` first
- if that is unavailable, backend falls back to the repo-local `images\` folder

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
- `E:\dookydetective\images`

Public API:

- `https://api.dookydetective.com`

### Production frontend deploy

Build locally:

```powershell
Set-Location "C:\Users\wmjef\Desktop\Precious Box\Dotcoms\dookydetective"
npm run build
```

Upload the contents of:

- `dist\`

to the ASO web root for:

- `dookydetective.com`

### Production backend deploy

If backend code changed locally:

1. push local repo changes to GitHub
2. on the home server, update:

```powershell
Set-Location E:\dookydetective\backend
git pull
npm install
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

- `E:\dookydetective\images`

The source of truth for the live frontend build output is:

- local `dist\` before upload to ASO
