import type { ContentBlock } from "../../admin/types";

export interface Project {
  id: string;
  title: string;
  category: string;
  year: string;
  imageUrl: string;
  description: string;
  tags: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  /** Additional images shown in the project detail view */
  galleryImages?: string[];
  /** Ordered content blocks for Dribbble-style detail view */
  contentBlocks?: ContentBlock[];
}
