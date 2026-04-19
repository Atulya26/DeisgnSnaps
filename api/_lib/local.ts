import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AdminProjectDocument, ProjectIndexFile } from "../../src/content/schema.js";

const REPO_ROOT = process.cwd();
const ADMIN_INDEX_PATH = "content/admin/index.json";

type RepoWrite =
  | { path: string; content: string; encoding: "utf-8" }
  | { path: string; content: string; encoding: "base64" }
  | { path: string; delete: true };

function absolutePath(relativePath: string) {
  return path.join(REPO_ROOT, relativePath);
}

async function readJsonFile<T>(relativePath: string): Promise<T | null> {
  try {
    const raw = await readFile(absolutePath(relativePath), "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function readLocalAdminIndex() {
  const data = await readJsonFile<ProjectIndexFile<AdminProjectDocument & { createdAt: string }>>(
    ADMIN_INDEX_PATH
  );
  return data?.projects ?? [];
}

export async function readLocalAdminProjectBySlug(slug: string) {
  return readJsonFile<AdminProjectDocument>(`content/admin/projects/${slug}.json`);
}

export async function writeLocalRepoFiles(writes: RepoWrite[]) {
  for (const write of writes) {
    const filePath = absolutePath(write.path);

    if ("delete" in write) {
      await rm(filePath, { force: true });
      continue;
    }

    await mkdir(path.dirname(filePath), { recursive: true });
    if (write.encoding === "base64") {
      await writeFile(filePath, Buffer.from(write.content, "base64"));
    } else {
      await writeFile(filePath, write.content, "utf8");
    }
  }
}

export async function readLocalBinaryBase64(relativePath: string) {
  try {
    const buffer = await readFile(absolutePath(relativePath));
    return buffer.toString("base64");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function listLocalDirectory(relativePath: string) {
  try {
    const entries = await readdir(absolutePath(relativePath), { withFileTypes: true });
    const normalizedRoot = relativePath.replace(/\\/g, "/").replace(/\/$/, "");
    return entries.map((entry) => ({
      type: entry.isFile() ? "file" as const : "dir" as const,
      path: `${normalizedRoot}/${entry.name}`,
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
