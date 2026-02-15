// ── Admin data types ──

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/** A folder in Storage that represents a project's asset directory */
export interface StorageFolder {
  name: string;
  path: string; // full prefix, e.g. "projects/abc123/"
  imageCount: number;
  images: StorageImage[];
}

export interface StorageImage {
  key: string; // full storage path
  name: string; // filename
  url: string; // public download URL
  size: number;
  lastModified: Date;
}

// ── Content Blocks (Dribbble-style) ──

export interface ImageBlock {
  type: "image";
  id: string;
  url: string; // the image URL
  key?: string; // storage path, if from Firebase Storage
  caption?: string;
}

export interface TextBlock {
  type: "text";
  id: string;
  content: string; // HTML from rich text editor
}

export type ContentBlock = ImageBlock | TextBlock;

/** Admin project — what gets saved to Firestore */
export interface AdminProject {
  id: string;
  storagePath: string; // Firebase Storage path prefix for this project's images
  title: string;
  category: string;
  year: string;
  description: string;
  tags: string[];
  /** @deprecated — use contentBlocks instead */
  richContent: string;
  coverImageKey: string; // which image is the cover on the canvas card
  images: StorageImage[]; // all images from Storage
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
