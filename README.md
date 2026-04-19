# UI Portfolio

This repo powers the public portfolio and its GitHub-backed admin workspace.

## Public site

- Homepage data loads from `public/content/projects/index.json`
- Project detail content loads from `public/content/projects/<slug>.json`
- Optimized project assets live in `public/portfolio/projects/<slug>/`

The public site ships only summary data on first load, then fetches the full project document when a project opens.

## Admin

The admin is now designed around GitHub as the source of truth.

- Sign in through `/api/auth/github/start`
- Edit project content through `/admin`
- Saves commit JSON content and optimized assets back into the repo
- Vercel can redeploy automatically from `main`

Required server-side environment variables for the admin API:

- `SESSION_SECRET`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `GITHUB_REPO_BRANCH` (optional, defaults to `main`)
- `GITHUB_APP_ALLOWED_USERS` or `GITHUB_ALLOWED_USERS`

## Local development

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

If you are running the Vercel-style API separately, point Vite at it:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:3000 npm run dev
```

## Content migration

The repo includes a one-time migration/optimization script that converts the legacy generated Dribbble dataset into the current JSON content model:

```bash
npm run migrate:content
```

This generates:

- `content/admin/index.json`
- `content/admin/projects/*.json`
- `public/content/projects/index.json`
- `public/content/projects/*.json`
- `public/portfolio/projects/*`
  
