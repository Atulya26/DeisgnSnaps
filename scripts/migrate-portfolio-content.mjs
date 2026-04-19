#!/usr/bin/env node

import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { localPortfolioProjects } from "../src/app/components/portfolioData.local.generated.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const adminRoot = path.join(repoRoot, "content", "admin");
const adminProjectsRoot = path.join(adminRoot, "projects");
const publicContentRoot = path.join(repoRoot, "public", "content", "projects");
const publicAssetsRoot = path.join(repoRoot, "public", "portfolio", "projects");
const sourceCacheRoot = path.join(tmpdir(), "cnvasportfolio-migrate-source-cache");

const CARD_MAX_WIDTH = 1200;
const CARD_QUALITY = 72;
const COVER_MAX_WIDTH = 1600;
const COVER_QUALITY = 78;
const GALLERY_MAX_WIDTH = 1680;
const GALLERY_QUALITY = 76;
const MAX_STILL_BYTES = 800 * 1024;

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "project";
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function localPathFromPublicUrl(publicUrl) {
  const clean = publicUrl.replace(/^\/+/, "");
  return path.join(repoRoot, "public", clean);
}

function isAnimatedSource(filePath) {
  return /\.(gif)$/i.test(filePath);
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runFfmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-y", "-v", "error", ...args], {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

async function readGitBlob(repoRelativePath) {
  return await new Promise((resolve, reject) => {
    const stdout = [];
    const child = spawn("git", ["show", `HEAD:${repoRelativePath}`], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }
      reject(new Error(stderr.trim() || `git show exited with code ${code}`));
    });
  });
}

async function resolveSourcePath(publicUrl) {
  const localPath = localPathFromPublicUrl(publicUrl);
  if (await pathExists(localPath)) {
    return localPath;
  }

  const cachedPath = path.join(sourceCacheRoot, publicUrl.replace(/^\/+/, ""));
  if (await pathExists(cachedPath)) {
    return cachedPath;
  }

  const repoRelativePath = `public/${publicUrl.replace(/^\/+/, "")}`;
  const blob = await readGitBlob(repoRelativePath);
  await ensureDir(path.dirname(cachedPath));
  await writeFile(cachedPath, blob);
  return cachedPath;
}

async function optimizeStillToWebp(inputPath, outputPath, { maxWidth, quality, maxBytes }) {
  let currentWidth = maxWidth;
  let currentQuality = quality;

  while (true) {
    await runFfmpeg([
      "-i",
      inputPath,
      "-vf",
      `scale=w='if(gt(iw,${currentWidth}),${currentWidth},iw)':h=-2:flags=lanczos`,
      "-frames:v",
      "1",
      "-c:v",
      "libwebp",
      "-compression_level",
      "6",
      "-preset",
      "photo",
      "-quality",
      String(currentQuality),
      outputPath,
    ]);

    const outputStat = await stat(outputPath);
    if (outputStat.size <= maxBytes) {
      return outputStat.size;
    }

    if (currentQuality > 44) {
      currentQuality -= 8;
      continue;
    }

    if (currentWidth > 960) {
      currentWidth = Math.max(960, Math.round(currentWidth * 0.84));
      currentQuality = Math.max(40, Math.min(quality, currentQuality + 2));
      continue;
    }

    return outputStat.size;
  }
}

async function optimizeAnimatedToWebp(inputPath, outputPath, { maxWidth, quality }) {
  await runFfmpeg([
    "-i",
    inputPath,
    "-vf",
    `fps=12,scale=w='if(gt(iw,${maxWidth}),${maxWidth},iw)':h=-2:flags=lanczos`,
    "-loop",
    "0",
    "-an",
    "-vsync",
    "0",
    "-c:v",
    "libwebp_anim",
    "-quality",
    String(quality),
    outputPath,
  ]);
}

async function createCardAsset(sourcePath, outputPath) {
  await optimizeStillToWebp(sourcePath, outputPath, {
    maxWidth: CARD_MAX_WIDTH,
    quality: CARD_QUALITY,
    maxBytes: 200 * 1024,
  });
}

async function createCoverAsset(sourcePath, outputPath) {
  if (isAnimatedSource(sourcePath)) {
    await optimizeStillToWebp(sourcePath, outputPath, {
      maxWidth: COVER_MAX_WIDTH,
      quality: COVER_QUALITY,
      maxBytes: MAX_STILL_BYTES,
    });
    return;
  }

  await optimizeStillToWebp(sourcePath, outputPath, {
    maxWidth: COVER_MAX_WIDTH,
    quality: COVER_QUALITY,
    maxBytes: MAX_STILL_BYTES,
  });
}

async function createGalleryAsset(sourcePath, outputPath) {
  if (isAnimatedSource(sourcePath)) {
    await optimizeAnimatedToWebp(sourcePath, outputPath, {
      maxWidth: GALLERY_MAX_WIDTH,
      quality: 68,
    });
    return;
  }

  await optimizeStillToWebp(sourcePath, outputPath, {
    maxWidth: GALLERY_MAX_WIDTH,
    quality: GALLERY_QUALITY,
    maxBytes: MAX_STILL_BYTES,
  });
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildProjectSlug(project) {
  const base = slugify(project.title);
  return `${base}-${project.id}`.slice(0, 96);
}

function mapTextBlocks(project) {
  return (project.contentBlocks ?? [])
    .filter((block) => block.type === "text")
    .map((block, index) => ({
      id: block.id || `text-${String(index + 1).padStart(2, "0")}`,
      type: "text",
      html: block.content,
    }));
}

async function migrateProject(project, sortOrder) {
  const slug = buildProjectSlug(project);
  const targetAssetDir = path.join(publicAssetsRoot, slug);
  await ensureDir(targetAssetDir);

  const cardSourcePath = await resolveSourcePath(project.imageUrl);
  const coverSourceUrl = project.coverImageUrl ?? project.imageUrl;
  const coverSourcePath = await resolveSourcePath(coverSourceUrl);
  const gallerySourceUrls = unique([
    coverSourceUrl,
    ...(project.galleryImages ?? []).filter((url) => url !== project.imageUrl),
  ]);

  const cardPublicUrl = `/portfolio/projects/${slug}/card.webp`;
  const coverPublicUrl = `/portfolio/projects/${slug}/cover.webp`;
  await createCardAsset(cardSourcePath, path.join(targetAssetDir, "card.webp"));
  await createCoverAsset(coverSourcePath, path.join(targetAssetDir, "cover.webp"));

  const galleryAssets = [];
  for (const [index, sourceUrl] of gallerySourceUrls.entries()) {
    const sourcePath = await resolveSourcePath(sourceUrl);
    const isCover = index === 0;
    const assetId = isCover ? "cover" : `gallery-${String(index).padStart(2, "0")}`;
    const targetName = isCover ? "cover.webp" : `${assetId}.webp`;
    const targetPath = path.join(targetAssetDir, targetName);
    const targetUrl = `/portfolio/projects/${slug}/${targetName}`;

    if (!isCover) {
      await createGalleryAsset(sourcePath, targetPath);
    }

    galleryAssets.push({
      id: assetId,
      kind: "image",
      role: isCover ? "cover" : "gallery",
      src: targetUrl,
    });
  }

  const textBlocks = mapTextBlocks(project);
  const now = new Date().toISOString();
  const baseDocument = {
    id: project.id,
    slug,
    title: project.title,
    category: project.category,
    year: project.year,
    cardImageUrl: cardPublicUrl,
    coverImageUrl: coverPublicUrl,
    width: project.width,
    height: project.height,
    sortOrder,
    status: "published",
    description: project.description,
    tags: project.tags ?? [],
    updatedAt: now,
  };

  const adminDocument = {
    ...baseDocument,
    createdAt: now,
    coverAssetId: "cover",
    cardAssetId: "card",
    assets: [
      {
        id: "card",
        kind: "image",
        role: "card",
        src: cardPublicUrl,
      },
      {
        id: "cover",
        kind: "image",
        role: "cover",
        src: coverPublicUrl,
      },
      ...galleryAssets.filter((asset) => asset.id !== "cover"),
    ],
    blocks: textBlocks,
  };

  const publicDocument = {
    ...baseDocument,
    gallery: galleryAssets,
    blocks: textBlocks,
  };

  return {
    slug,
    adminDocument,
    publicDocument,
  };
}

async function main() {
  await rm(path.join(adminRoot), { recursive: true, force: true });
  await rm(publicContentRoot, { recursive: true, force: true });
  await rm(publicAssetsRoot, { recursive: true, force: true });

  await ensureDir(adminProjectsRoot);
  await ensureDir(publicContentRoot);
  await ensureDir(publicAssetsRoot);

  const migrated = [];
  for (const [index, project] of localPortfolioProjects.entries()) {
    migrated.push(await migrateProject(project, index));
    process.stdout.write(`Migrated ${index + 1}/${localPortfolioProjects.length}\r`);
  }
  process.stdout.write("\n");

  const adminIndex = {
    projects: migrated.map(({ adminDocument }) => ({
      id: adminDocument.id,
      slug: adminDocument.slug,
      title: adminDocument.title,
      category: adminDocument.category,
      year: adminDocument.year,
      cardImageUrl: adminDocument.cardImageUrl,
      coverImageUrl: adminDocument.coverImageUrl,
      width: adminDocument.width,
      height: adminDocument.height,
      sortOrder: adminDocument.sortOrder,
      status: adminDocument.status,
      updatedAt: adminDocument.updatedAt,
      createdAt: adminDocument.createdAt,
    })),
  };

  const publicIndex = {
    projects: migrated
      .map(({ publicDocument }) => publicDocument)
      .filter((project) => project.status === "published")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((project) => ({
        id: project.id,
        slug: project.slug,
        title: project.title,
        category: project.category,
        year: project.year,
        cardImageUrl: project.cardImageUrl,
        coverImageUrl: project.coverImageUrl,
        width: project.width,
        height: project.height,
        sortOrder: project.sortOrder,
        status: project.status,
      })),
  };

  await writeJson(path.join(adminRoot, "index.json"), adminIndex);
  await writeJson(path.join(publicContentRoot, "index.json"), publicIndex);

  await Promise.all(
    migrated.flatMap(({ slug, adminDocument, publicDocument }) => [
      writeJson(path.join(adminProjectsRoot, `${slug}.json`), adminDocument),
      writeJson(path.join(publicContentRoot, `${slug}.json`), publicDocument),
    ])
  );

  console.log(
    `Generated ${migrated.length} admin docs, ${migrated.length} public docs, and optimized assets in public/portfolio/projects.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
