import type { R2Config, R2Folder, R2Image } from "../types";

const R2_CONFIG_KEY = "portfolio_r2_config";
const PROJECTS_KEY = "portfolio_admin_projects";

// ── Config persistence (localStorage) ──

export function getR2Config(): R2Config | null {
  try {
    const raw = localStorage.getItem(R2_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveR2Config(config: R2Config): void {
  localStorage.setItem(R2_CONFIG_KEY, JSON.stringify(config));
}

export function clearR2Config(): void {
  localStorage.removeItem(R2_CONFIG_KEY);
}

// ── Worker API calls ──

/**
 * List all top-level folders in the R2 bucket via the Cloudflare Worker.
 */
export async function listFolders(config: R2Config): Promise<R2Folder[]> {
  if (!config.workerUrl) return [];

  try {
    const base = config.workerUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/folders`);
    if (!res.ok) throw new Error(`Worker responded ${res.status}`);

    const data = await res.json();
    const folders = (data as { folders: { name: string; path: string; imageCount: number }[] }).folders;

    return folders.map((f) => ({
      name: f.name,
      path: f.path,
      imageCount: f.imageCount,
      images: [],
    }));
  } catch (err) {
    console.error("Failed to list folders from worker:", err);
    return [];
  }
}

/**
 * List all images inside a specific folder via the Cloudflare Worker.
 */
export async function listFolderImages(
  config: R2Config,
  folderPrefix: string
): Promise<R2Image[]> {
  if (!config.workerUrl) return [];

  try {
    const base = config.workerUrl.replace(/\/$/, "");
    const encoded = encodeURIComponent(folderPrefix.replace(/\/$/, ""));
    const res = await fetch(`${base}/folders/${encoded}`);
    if (!res.ok) throw new Error(`Worker responded ${res.status}`);

    const data = await res.json();
    const images = (data as { images: { key: string; name: string; url: string; size: number; lastModified: string }[] }).images;

    return images.map((img) => ({
      key: img.key,
      name: img.name,
      url: img.url,
      size: img.size,
      lastModified: new Date(img.lastModified),
    }));
  } catch (err) {
    console.error("Failed to list folder images from worker:", err);
    return [];
  }
}

/**
 * Test if the worker URL is reachable and returns a valid response.
 */
export async function testWorkerConnection(workerUrl: string): Promise<{
  ok: boolean;
  folderCount?: number;
  error?: string;
}> {
  try {
    const base = workerUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/folders`);
    if (!res.ok) {
      return { ok: false, error: `Worker responded with status ${res.status}` };
    }
    const data = await res.json();
    const folders = (data as { folders: unknown[] }).folders;
    return { ok: true, folderCount: folders?.length ?? 0 };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

/**
 * Build a public URL for an R2 object via the worker.
 */
export function getPublicUrl(config: R2Config, key: string): string {
  if (config.workerUrl) {
    const base = config.workerUrl.replace(/\/$/, "");
    return `${base}/file/${encodeURIComponent(key)}`;
  }
  if (config.publicDomain) {
    return `https://${config.publicDomain}/${key}`;
  }
  return key;
}

/**
 * Upload a file to R2 via the Cloudflare Worker.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(
  config: R2Config,
  key: string,
  file: File
): Promise<{ ok: boolean; url: string; key: string; error?: string }> {
  if (!config.workerUrl) {
    return { ok: false, url: "", key, error: "Worker URL not configured" };
  }

  try {
    const base = config.workerUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/upload/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        url: "",
        key,
        error: (data as { error?: string }).error || `Upload failed (${res.status})`,
      };
    }

    const data = await res.json();
    return {
      ok: true,
      url: (data as { url: string }).url,
      key,
    };
  } catch (err) {
    return {
      ok: false,
      url: "",
      key,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

/**
 * Delete all files in an R2 folder via the Cloudflare Worker.
 */
export async function deleteR2Folder(
  config: R2Config,
  folderPrefix: string
): Promise<{ ok: boolean; error?: string }> {
  if (!config.workerUrl) {
    return { ok: false, error: "Worker URL not configured" };
  }

  try {
    // First list all files in the folder
    const images = await listFolderImages(config, folderPrefix);

    const base = config.workerUrl.replace(/\/$/, "");

    // Delete each file
    for (const img of images) {
      await fetch(`${base}/file/${encodeURIComponent(img.key)}`, {
        method: "DELETE",
      });
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Delete failed",
    };
  }
}

// ── Local project data persistence ──

export function getLocalProjects(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalProjects(projects: Record<string, unknown>[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}
