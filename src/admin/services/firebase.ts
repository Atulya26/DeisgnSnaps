import { apiRequest } from "./apiClient";
import type {
  AdminProjectDocument,
  AdminProjectListItem,
  AdminSessionResponse,
} from "../types";

interface ProjectListResponse {
  projects: AdminProjectListItem[];
}

interface ProjectItemResponse {
  project: AdminProjectDocument;
}

interface UploadAssetsResponse {
  project: AdminProjectDocument;
}

export async function testConnection(): Promise<{
  ok: boolean;
  projectCount?: number;
  error?: string;
}> {
  try {
    const result = await apiRequest<ProjectListResponse>("/api/admin/projects");
    return { ok: true, projectCount: result.projects.length };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

export async function loadProjectsFromFirestore(): Promise<AdminProjectListItem[]> {
  const result = await apiRequest<ProjectListResponse>("/api/admin/projects");
  return result.projects ?? [];
}

export async function loadProjectFromFirestore(id: string): Promise<AdminProjectDocument | null> {
  try {
    const result = await apiRequest<ProjectItemResponse>(`/api/admin/projects/${id}`);
    return result.project ?? null;
  } catch {
    return null;
  }
}

export async function saveProjectToFirestore(project: AdminProjectDocument): Promise<AdminProjectDocument> {
  const result = await apiRequest<ProjectItemResponse>(`/api/admin/projects/${project.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  return result.project;
}

export async function deleteProjectFromFirestore(id: string): Promise<void> {
  await apiRequest(`/api/admin/projects/${id}`, { method: "DELETE" });
}

export async function reorderProjects(projectIds: string[]): Promise<AdminProjectListItem[]> {
  const result = await apiRequest<ProjectListResponse>("/api/admin/projects/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectIds }),
  });
  return result.projects ?? [];
}

export async function uploadProjectAssets(
  projectId: string,
  files: File[]
): Promise<AdminProjectDocument> {
  const form = new FormData();
  files.forEach((file) => {
    form.append("files", file, file.name);
  });

  const result = await apiRequest<UploadAssetsResponse>(`/api/admin/projects/${projectId}/assets`, {
    method: "POST",
    body: form,
  });
  return result.project;
}

export async function deleteProjectAsset(
  projectId: string,
  assetId: string
): Promise<AdminProjectDocument> {
  const result = await apiRequest<ProjectItemResponse>(`/api/admin/projects/${projectId}/assets/${assetId}`, {
    method: "DELETE",
  });
  return result.project;
}

export async function getSession(): Promise<AdminSessionResponse> {
  try {
    return await apiRequest<AdminSessionResponse>("/api/admin/session");
  } catch {
    return { authenticated: false, authConfigured: false };
  }
}

export function startGitHubSignIn() {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
  window.location.href = `${base}/api/auth/github/start`;
}

export async function signOutAdmin(): Promise<void> {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore network errors during sign-out.
  }
}
