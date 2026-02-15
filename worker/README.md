# Cloudflare Worker API (Option A)

This Worker powers:

- Admin authentication (`/api/admin/login`, session cookie)
- Project CRUD (`/api/admin/projects*`)
- Image upload/list/delete in R2 (`/api/admin/upload`, `/api/admin/assets`)
- Public published feed (`/api/public/projects`)
- Static image serving (`/assets/*`)

## Bindings and secrets

In Cloudflare:

1. Create an R2 bucket named `cnvasportfolio-content` (or update `wrangler.jsonc`).
2. Configure Worker secrets:
   - `SESSION_SECRET` (long random string)
   - `ADMIN_PASSWORD` (admin login password)
   - `ADMIN_EMAIL` (optional, lock to one email)
3. Optional variable:
   - `PUBLIC_ASSET_BASE_URL` (example: `https://api.yourdomain.com/assets`)

## Local dev

```bash
cd worker
cp .dev.vars.example .dev.vars
# fill .dev.vars values
wrangler dev
```

Then run the frontend with:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Or use a Vite proxy to keep `/api` same-origin in local development.

## Production

Deploy Worker and attach your domain route (recommended `api.yourdomain.com/*`).
Set frontend env:

- `VITE_API_BASE_URL=https://api.yourdomain.com`
- `VITE_PUBLIC_ASSET_BASE_URL=https://api.yourdomain.com/assets`
