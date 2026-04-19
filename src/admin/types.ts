import type {
  AdminProjectDocument as SharedAdminProjectDocument,
  MediaAsset,
  ProjectBlock,
  ProjectIndexEntry,
  ProjectStatus,
} from "../content/schema";

export type { MediaAsset, ProjectBlock, ProjectStatus };

export interface AdminUser {
  login: string;
  avatarUrl?: string;
  name?: string;
}

export interface AdminSessionResponse {
  authenticated: boolean;
  user?: AdminUser;
}

export interface AdminProjectListItem extends ProjectIndexEntry {
  updatedAt: string;
  createdAt: string;
}

export interface AdminProjectDocument extends SharedAdminProjectDocument {}

export interface OptimizedUploadAsset {
  id: string;
  kind: "image";
  role: "gallery";
  src: string;
  caption?: string;
  width?: number;
  height?: number;
}
