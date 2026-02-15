/**
 * Cloudflare-backed service layer.
 *
 * This file keeps legacy function names (firebase/firestore wording) so the
 * existing admin/pages can migrate without major UI rewrites.
 */

import { apiRequest } from "./apiClient";
import type { StorageImage, AdminProject } from "../types";

const PROJECTS_KEY = "portfolio_admin_projects";

interface SessionUser {
  email: string;
}

interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
}

interface ProjectListResponse {
  projects: AdminProject[];
}

interface ProjectItemResponse {
  project: AdminProject;
}

interface UploadResponse {
  key: string;
  url: string;
}

interface AssetsResponse {
  images: StorageImage[];
}

interface HealthResponse {
  ok: boolean;
  projectCount: number;
}

function serialiseProject(project: AdminProject): AdminProject {
  return JSON.parse(JSON.stringify(project)) as AdminProject;
}

export async function testConnection(): Promise<{
  ok: boolean;
  projectCount?: number;
  error?: string;
}> {
  try {
    const result = await apiRequest<HealthResponse>("/api/admin/health");
    return { ok: result.ok, projectCount: result.projectCount };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

export async function saveProjectToFirestore(project: AdminProject): Promise<void> {
  await apiRequest<ProjectItemResponse>(`/api/admin/projects/${project.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project: serialiseProject(project) }),
  });
}

export async function loadProjectsFromFirestore(): Promise<AdminProject[]> {
  const result = await apiRequest<ProjectListResponse>("/api/admin/projects");
  return result.projects ?? [];
}

export async function loadProjectFromFirestore(id: string): Promise<AdminProject | null> {
  try {
    const result = await apiRequest<ProjectItemResponse>(`/api/admin/projects/${id}`);
    return result.project ?? null;
  } catch {
    return null;
  }
}

export async function deleteProjectFromFirestore(id: string): Promise<void> {
  await apiRequest(`/api/admin/projects/${id}`, { method: "DELETE" });
}

export async function getPublishedProjects(): Promise<AdminProject[]> {
  const result = await apiRequest<ProjectListResponse>("/api/public/projects");
  return result.projects ?? [];
}

export async function uploadFile(
  storagePath: string,
  file: File
): Promise<{ ok: boolean; url: string; key: string; error?: string }> {
  try {
    const form = new FormData();
    form.set("key", storagePath);
    form.set("file", file, file.name);
    const result = await apiRequest<UploadResponse>("/api/admin/upload", {
      method: "POST",
      body: form,
    });
    return { ok: true, key: result.key, url: result.url };
  } catch (err) {
    return {
      ok: false,
      url: "",
      key: storagePath,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

export async function listFolderImages(folderPath: string): Promise<StorageImage[]> {
  try {
    const safePrefix = encodeURIComponent(folderPath);
    const result = await apiRequest<AssetsResponse>(`/api/admin/assets?prefix=${safePrefix}`);
    return (result.images ?? []).map((image) => ({
      ...image,
      lastModified: new Date(image.lastModified),
    }));
  } catch (err) {
    console.error("Failed to list folder images:", err);
    return [];
  }
}

export async function deleteStorageFolder(folderPath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const safePrefix = encodeURIComponent(folderPath);
    await apiRequest(`/api/admin/assets?prefix=${safePrefix}`, { method: "DELETE" });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Delete failed",
    };
  }
}

export async function getSession(): Promise<SessionResponse> {
  try {
    return await apiRequest<SessionResponse>("/api/admin/session");
  } catch {
    return { authenticated: false };
  }
}

export async function signInAdmin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiRequest("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sign-in failed" };
  }
}

export async function signOutAdmin(): Promise<void> {
  try {
    await apiRequest("/api/admin/logout", { method: "POST" });
  } catch {
    // Ignore network errors during sign-out.
  }
}

export function getLocalProjects(): AdminProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as AdminProject[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalProjects(projects: AdminProject[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}
