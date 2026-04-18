export interface ImageContentBlock {
  type: "image";
  id: string;
  url: string;
  key?: string;
  caption?: string;
}

export interface TextContentBlock {
  type: "text";
  id: string;
  content: string;
}

export type ContentBlock = ImageContentBlock | TextContentBlock;

export interface Project {
  id: string;
  title: string;
  category: string;
  year: string;
  /** Lightweight image used on the canvas and boot sequence */
  imageUrl: string;
  /** Full-quality primary image used in the project detail view */
  coverImageUrl?: string;
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
