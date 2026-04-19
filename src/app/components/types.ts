import type {
  MediaAsset,
  ProjectBlock,
  ProjectDocument,
  ProjectIndexEntry,
} from "../../content/schema";

export type { MediaAsset, ProjectBlock, ProjectDocument, ProjectIndexEntry };

export interface CanvasProjectSummary extends ProjectIndexEntry {
  x: number;
  y: number;
  imageUrl?: string;
  description?: string;
  tags?: string[];
  galleryImages?: string[];
  contentBlocks?: ProjectBlock[];
}

export interface ResolvedCanvasProject extends CanvasProjectSummary, ProjectDocument {}

export type Project = CanvasProjectSummary;
