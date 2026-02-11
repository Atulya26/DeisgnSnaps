// ── Admin data types ──

export interface R2Config {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicDomain: string; // e.g. "assets.yourdomain.com" or R2.dev URL
  workerUrl: string; // e.g. "https://portfolio-r2-api.yourname.workers.dev"
}

/** A folder in R2 that represents a project's asset directory */
export interface R2Folder {
  name: string;
  path: string; // full prefix, e.g. "project-lumina/"
  imageCount: number;
  images: R2Image[];
}

export interface R2Image {
  key: string; // full object key in R2
  name: string; // filename
  url: string; // public URL
  size: number;
  lastModified: Date;
}

// ── Content Blocks (Dribbble-style) ──

export interface ImageBlock {
  type: "image";
  id: string;
  url: string; // the image URL
  key?: string; // R2 object key, if from R2
  caption?: string;
}

export interface TextBlock {
  type: "text";
  id: string;
  content: string; // HTML from rich text editor
}

export type ContentBlock = ImageBlock | TextBlock;

/** Admin project — what gets saved to localStorage / R2 */
export interface AdminProject {
  id: string;
  r2Folder: string; // the R2 folder prefix this project maps to
  title: string;
  category: string;
  year: string;
  description: string;
  tags: string[];
  /** @deprecated — use contentBlocks instead */
  richContent: string;
  coverImageKey: string; // which image is the cover on the canvas card
  images: R2Image[]; // all images from the R2 folder
  /** Ordered content blocks — the Dribbble-style post layout */
  contentBlocks: ContentBlock[];
  // Canvas layout (auto-computed, kept for compat)
  x: number;
  y: number;
  width: number;
  height: number;
  // Metadata
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}
