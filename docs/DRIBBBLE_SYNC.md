# Dribbble Sync

This repo now includes a one-way Dribbble importer at:

`scripts/sync-dribbble.mjs`

There is also a public-page fallback importer that does not require a Dribbble API token:

`scripts/sync-dribbble-public.mjs`

And there is now a local-first importer that downloads your public Dribbble shots
directly into the repo for static hosting:

`scripts/sync-dribbble-local.mjs`

It uses the official Dribbble API for your authenticated account, then writes imported content into the existing portfolio admin API.

## What it imports

- Dribbble shot and project titles
- Descriptions
- Tags
- Main shot image
- Attachments for each shot
- Grouped project content when shots are attached to a Dribbble project

Imported items are stored as normal admin projects, so the homepage and detail views render them through the existing portfolio UI.

## How grouping works

- If a Dribbble shot belongs to a Dribbble project, all shots under that project are grouped into one imported portfolio project.
- If a shot is not part of a Dribbble project, it is imported as its own standalone portfolio project.

Imported ids are deterministic:

- `dribbble-project-<id>`
- `dribbble-shot-<id>`

That means rerunning the sync updates existing imports instead of duplicating them.

## Required environment variables

The script needs:

- `DRIBBBLE_ACCESS_TOKEN`
- `PORTFOLIO_API_BASE_URL`
- `PORTFOLIO_ADMIN_EMAIL`
- `PORTFOLIO_ADMIN_PASSWORD`

Example:

```bash
export DRIBBBLE_ACCESS_TOKEN=your_dribbble_oauth_token
export PORTFOLIO_API_BASE_URL=http://127.0.0.1:8787
export PORTFOLIO_ADMIN_EMAIL=you@example.com
export PORTFOLIO_ADMIN_PASSWORD=your_admin_password
```

Then run:

```bash
npm run sync:dribbble
```

## No-token fallback

If you cannot access the Dribbble API token flow, use the public-page importer instead.

Required environment variables:

- `DRIBBBLE_PROFILE_URL`
- `PORTFOLIO_API_BASE_URL`
- `PORTFOLIO_ADMIN_EMAIL`
- `PORTFOLIO_ADMIN_PASSWORD`

Example:

```bash
export DRIBBBLE_PROFILE_URL=https://dribbble.com/Atulya_26
export PORTFOLIO_API_BASE_URL=http://127.0.0.1:8787
export PORTFOLIO_ADMIN_EMAIL=you@example.com
export PORTFOLIO_ADMIN_PASSWORD=your_admin_password
```

Then run:

```bash
npm run sync:dribbble:public
```

What it does:

- opens your public Dribbble profile
- discovers shot links across paginated profile pages
- opens each shot page in Playwright
- extracts the rendered title, description paragraphs, and public CDN image URLs
- imports each public shot as a portfolio project through the existing admin API

Limitations of the public fallback:

- it imports public shots one-by-one rather than using Dribbble project relationships
- it depends on the current Dribbble page structure, so it is more brittle than the API flow
- it only imports what is visible on the public page

## Local-first static workflow

If you want the portfolio to live entirely from checked-in files with no admin/API
dependency at runtime, use the local importer.

Required environment variables:

- `DRIBBBLE_PROFILE_URL`

Example:

```bash
export DRIBBBLE_PROFILE_URL=https://dribbble.com/Atulya_26
npm run sync:dribbble:local
```

What it does:

- scrapes your public Dribbble profile with Playwright
- opens each public shot page
- downloads public shot images into `public/portfolio/dribbble/...`
- regenerates `src/app/components/portfolioData.local.generated.ts`

After that, the public portfolio reads from the generated local dataset instead of
the admin API.

Notes:

- the admin panel code still remains in the repo
- the public site no longer needs the admin connection to render imported work
- committing the generated files to Git makes the portfolio suitable for static hosting

## Optional environment variables

- `DRIBBBLE_IMPORT_STATUS=published|draft`
  Default: `published`
- `DRIBBBLE_SYNC_PRUNE=true|false`
  Default: `true`
  Deletes imported Dribbble projects that no longer exist in the latest sync.
- `DRIBBBLE_SYNC_CLEAN_ASSETS=true|false`
  Default: `true`
  Removes previously imported assets for a project before uploading the latest set.
- `DRIBBBLE_SYNC_DRY_RUN=true|false`
  Default: `false`
  Fetches and groups Dribbble content without writing to the portfolio API.
- `DRIBBBLE_REQUEST_DELAY_MS=<number>`
  Default: `125`
- `DRIBBBLE_ASSET_CONCURRENCY=<number>`
  Default: `4`

## Recommended local workflow

1. Start the worker:

```bash
cd worker
cp .dev.vars.example .dev.vars
# fill in SESSION_SECRET, ADMIN_PASSWORD, ADMIN_EMAIL
npx wrangler dev
```

2. In a separate terminal, run the sync from the repo root:

```bash
npm run sync:dribbble
```

Or, without a token:

```bash
npm run sync:dribbble:public
```

Or, for the static local-first path:

```bash
npm run sync:dribbble:local
```

3. Start the frontend with:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

## Notes

- The importer uses Dribbble API image fields and attachments. If a shot has a `hidpi` image, that is preferred over `normal`.
- Video shots currently import their still image only.
- The public portfolio now prefers the generated local dataset when it exists, and falls back to the sample portfolio content otherwise.
