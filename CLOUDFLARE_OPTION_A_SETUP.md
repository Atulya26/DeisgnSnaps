# Cloudflare Option A Setup (Portfolio)

This setup gives you:

- Pages hosting (fast static frontend)
- Worker API backend for admin
- R2 storage for all project images and project JSON
- Admin authentication via Worker session + optional Cloudflare Access layer

## 1) Cloudflare resources to create (dashboard)

1. **R2 bucket**
   - Name: `cnvasportfolio-content`
2. **Worker**
   - Use the code in `worker/src/index.ts`
   - Config from `worker/wrangler.jsonc`
3. **Secrets / vars in Worker**
   - `SESSION_SECRET` = strong random 32+ chars
   - `ADMIN_PASSWORD` = your admin portal password
   - `ADMIN_EMAIL` = your admin email (optional but recommended)
   - `PUBLIC_ASSET_BASE_URL` = `https://api.yourdomain.com/assets`
4. **Custom API domain**
   - Route Worker to `api.yourdomain.com/*`
5. **Cloudflare Pages project**
   - Deploy this frontend repo
   - Add env:
     - `VITE_API_BASE_URL=https://api.yourdomain.com`
     - `VITE_PUBLIC_ASSET_BASE_URL=https://api.yourdomain.com/assets`

## 2) Security hardening (must do)

1. Protect admin route with **Cloudflare Access**:
   - App: `https://yourdomain.com/admin/*`
   - Policy: allow only your email
2. Keep Worker auth enabled:
   - Admin API still requires session cookie from `/api/admin/login`
3. Use a strong `ADMIN_PASSWORD` and rotate periodically.

## 3) How data flows after setup

1. Admin signs in from `/admin/login` (cookie session).
2. Admin uploads images -> Worker -> R2 under `projects/<project-id>/...`.
3. Admin saves project text/content blocks -> Worker writes `content/projects.json` in R2.
4. Homepage calls `/api/public/projects` and renders published projects instantly.

No manual Cloudflare media console work is needed after initial setup.

## 4) Deployment order (recommended)

1. Deploy Worker first and confirm:
   - `/api/public/projects` returns `{ "projects": [] }`
   - `/assets/...` works for uploaded files
2. Deploy frontend with env vars.
3. Test admin login + create project + upload image + publish.
4. Confirm homepage shows published project.

## 5) Rollback safety

- Frontend keeps localStorage fallback.
- If API is down, existing local admin cache still opens in browser.
- You can restore by swapping `VITE_API_BASE_URL` back to prior backend.
