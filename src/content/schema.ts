export type ProjectStatus = "draft" | "published";

export interface ProjectIndexEntry {
  id: string;
  slug: string;
  title: string;
  category: string;
  year: string;
  cardImageUrl: string;
  coverImageUrl?: string;
  width: number;
  height: number;
  sortOrder: number;
  status: ProjectStatus;
}

export interface MediaAsset {
  id: string;
  kind: "image";
  role: "card" | "cover" | "gallery";
  src: string;
  caption?: string;
  width?: number;
  height?: number;
}

export type ProjectBlock =
  | { id: string; type: "image"; assetId: string; caption?: string }
  | { id: string; type: "text"; html: string };

export interface ProjectDocument extends ProjectIndexEntry {
  description: string;
  tags: string[];
  gallery: MediaAsset[];
  blocks: ProjectBlock[];
  updatedAt: string;
}

export interface ProjectSearchEntry extends ProjectIndexEntry {
  description: string;
  tags: string[];
  searchText: string;
}

export interface AdminProjectDocument extends ProjectDocument {
  createdAt: string;
  assets: MediaAsset[];
  coverAssetId?: string;
  cardAssetId?: string;
}

export interface ProjectIndexFile<TProject extends ProjectIndexEntry = ProjectIndexEntry> {
  projects: TProject[];
}

export interface ProjectSearchIndexFile<
  TProject extends ProjectSearchEntry = ProjectSearchEntry,
> {
  projects: TProject[];
  generatedAt: string;
}
