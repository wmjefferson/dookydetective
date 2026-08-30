<div align="center">
<img width="1200" height="475" alt="Dooky Detective banner" src="./dooky-book.png" />
</div>

# Dooky Detective

Dooky Detective is a React/Vite image gallery frontend backed by a small Express image API.

## Local development

Prerequisites:
- Node.js

Install dependencies:

```bash
npm install
```

Frontend dev server:

```bash
npm run dev
```

Backend image API:

```bash
npm run server
```

The repo now supports a shared-library local loop by default:

- the frontend reads [`.env.development`](/C:/Users/wmjef/Desktop/Precious%20Box/Dotcoms/dookydetective/.env.development)
- the backend prefers `E:\images\dookydetective`
- if that is unavailable, it falls back to `\\JEFFERSHIZZLE-D\Dotcoms E\images\dookydetective`
- the backend defaults `PUBLIC_BASE_URL` to `http://localhost:8020` when no production env is set

## Environment

Copy `.env.example` into your local env file and adjust as needed.

Important variables:
- `VITE_API_BASE_URL`
- `PORT`
- `IMAGES_ROOT`
- `PUBLIC_BASE_URL`
- `ALLOWED_ORIGINS`

## Production model

- frontend hosted at `https://dookydetective.com`
- backend served from home server at `https://api.dookydetective.com`
- media library stored at `E:\images\dookydetective`
- photos live under `E:\images\dookydetective\photos`
- video can live under `E:\images\dookydetective\video`

## Notes

- The legacy `public/get_images.php` file is kept only as a transitional reference.
- The current architecture should use the dedicated backend service on port `8020`.
- The local repo is the source of truth; the home server should be a deployment target, not the only place where the backend logic lives.
