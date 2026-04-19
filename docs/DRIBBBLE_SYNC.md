# Content Workflow

This repo now uses a split content model for the public portfolio and a GitHub-backed admin model for editing.

## Current source of truth

Admin content lives in:

- `content/admin/index.json`
- `content/admin/projects/<slug>.json`

Public content lives in:

- `public/content/projects/index.json`
- `public/content/projects/<slug>.json`

Optimized assets live in:

- `public/portfolio/projects/<slug>/card.webp`
- `public/portfolio/projects/<slug>/cover.webp`
- `public/portfolio/projects/<slug>/gallery-*.webp`

The public site only loads `index.json` on first paint, then fetches a project document when a project opens.

## Migration script

Use the migration script to rebuild the content and optimized assets from the legacy generated Dribbble dataset:

```bash
npm run migrate:content
```

What it does:

- reads the legacy generated Dribbble dataset
- restores missing legacy source assets from git history when needed
- creates optimized `card.webp`, `cover.webp`, and `gallery-*.webp` variants
- writes the admin JSON source of truth
- writes the public JSON documents used by the runtime site

## Admin API model

The admin is no longer coupled to the old worker/R2 path.

Expected API surface:

- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`
- `POST /api/auth/logout`
- `GET /api/admin/session`
- `GET /api/admin/projects`
- `GET /api/admin/projects/:id`
- `PUT /api/admin/projects/:id`
- `POST /api/admin/projects/:id/assets`
- `DELETE /api/admin/projects/:id/assets/:assetId`
- `POST /api/admin/projects/reorder`

Expected environment variables:

- `SESSION_SECRET`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `GITHUB_REPO_BRANCH` (optional, defaults to `main`)
- `GITHUB_APP_ALLOWED_USERS` or `GITHUB_ALLOWED_USERS`

## Legacy Dribbble importers

These scripts still exist as legacy utilities, but they are no longer the runtime content path:

- `scripts/sync-dribbble.mjs`
- `scripts/sync-dribbble-public.mjs`
- `scripts/sync-dribbble-local.mjs`

They can still be useful if you want to scrape or re-import from Dribbble again later, but the live site now reads from the generated JSON documents and optimized local assets described above.
