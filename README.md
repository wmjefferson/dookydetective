<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
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

The legacy `public/get_images.php` file is kept only as a transitional reference. The current architecture should use the dedicated backend service on port `8020`.
