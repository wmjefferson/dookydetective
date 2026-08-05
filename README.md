<div align="center">
<img width="1200" height="475" alt="Dooky Detective banner" src="../other/assets/dooky-book.png" />
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

The repo now supports a fully local loop by default:

- the frontend reads [`.env.development`](/C:/Users/wmjef/Desktop/Precious%20Box/Dotcoms/dookydetective/.env.development)
- the backend falls back to the repo-local [`images`](/C:/Users/wmjef/Desktop/Precious%20Box/Dotcoms/dookydetective/images) folder if `E:\dookydetective\images` is not available
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
- image library stored at `E:\dookydetective\images`

## Notes

- The legacy `public/get_images.php` file is kept only as a transitional reference.
- The current architecture should use the dedicated backend service on port `8020`.
- The local repo is the source of truth; the home server should be a deployment target, not the only place where the backend logic lives.
