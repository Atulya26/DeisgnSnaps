const GITHUB_API_BASE = "https://api.github.com";

function encodeGitHubPath(filePath: string) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

interface GitHubContentFile {
  type: "file";
  content?: string;
  sha: string;
}

interface GitReferenceResponse {
  object: {
    sha: string;
  };
}

interface GitCommitResponse {
  sha: string;
  tree: {
    sha: string;
  };
}

interface GitBlobResponse {
  sha: string;
}

interface GitTreeResponse {
  sha: string;
}

export async function githubRequest(
  token: string,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });

  return response;
}

export async function getJsonFile<T>(
  token: string,
  repo: GitHubRepoConfig,
  filePath: string
): Promise<T | null> {
  const response = await githubRequest(
    token,
    `/repos/${repo.owner}/${repo.repo}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(repo.branch)}`
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load ${filePath} (${response.status})`);
  }

  const body = (await response.json()) as GitHubContentFile;
  if (body.type !== "file" || !body.content) return null;
  return JSON.parse(atob(body.content.replace(/\n/g, ""))) as T;
}

export async function getBinaryFileBase64(
  token: string,
  repo: GitHubRepoConfig,
  filePath: string
): Promise<string | null> {
  const response = await githubRequest(
    token,
    `/repos/${repo.owner}/${repo.repo}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(repo.branch)}`
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load ${filePath} (${response.status})`);
  }

  const body = (await response.json()) as GitHubContentFile;
  if (body.type !== "file" || !body.content) return null;
  return body.content.replace(/\n/g, "");
}

export async function listDirectory(
  token: string,
  repo: GitHubRepoConfig,
  dirPath: string
) {
  const response = await githubRequest(
    token,
    `/repos/${repo.owner}/${repo.repo}/contents/${encodeGitHubPath(dirPath)}?ref=${encodeURIComponent(repo.branch)}`
  );
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`Failed to list ${dirPath} (${response.status})`);
  }
  return (await response.json()) as Array<{ path: string; type: string }>;
}

async function getReferenceSha(token: string, repo: GitHubRepoConfig) {
  const response = await githubRequest(
    token,
    `/repos/${repo.owner}/${repo.repo}/git/ref/heads/${encodeURIComponent(repo.branch)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to resolve branch ${repo.branch} (${response.status})`);
  }
  const body = (await response.json()) as GitReferenceResponse;
  return body.object.sha;
}

async function getCommit(token: string, repo: GitHubRepoConfig, commitSha: string) {
  const response = await githubRequest(
    token,
    `/repos/${repo.owner}/${repo.repo}/git/commits/${commitSha}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load commit ${commitSha} (${response.status})`);
  }
  return (await response.json()) as GitCommitResponse;
}

async function createBlob(
  token: string,
  repo: GitHubRepoConfig,
  content: string,
  encoding: "utf-8" | "base64"
) {
  const response = await githubRequest(
    token,
    `/repos/${repo.owner}/${repo.repo}/git/blobs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, encoding }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to create blob (${response.status})`);
  }
  const body = (await response.json()) as GitBlobResponse;
  return body.sha;
}

async function createTree(
  token: string,
  repo: GitHubRepoConfig,
  baseTree: string,
  entries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }>
) {
  const response = await githubRequest(
    token,
    `/repos/${repo.owner}/${repo.repo}/git/trees`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: baseTree,
        tree: entries,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to create tree (${response.status})`);
  }
  const body = (await response.json()) as GitTreeResponse;
  return body.sha;
}

async function createCommit(
  token: string,
  repo: GitHubRepoConfig,
  message: string,
  treeSha: string,
  parentSha: string
) {
  const response = await githubRequest(
    token,
    `/repos/${repo.owner}/${repo.repo}/git/commits`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents: [parentSha],
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to create commit (${response.status})`);
  }
  const body = (await response.json()) as GitCommitResponse;
  return body.sha;
}

async function updateReference(token: string, repo: GitHubRepoConfig, commitSha: string) {
  const response = await githubRequest(
    token,
    `/repos/${repo.owner}/${repo.repo}/git/refs/heads/${encodeURIComponent(repo.branch)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commitSha, force: false }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to update ${repo.branch} (${response.status})`);
  }
}

export async function commitFiles(
  token: string,
  repo: GitHubRepoConfig,
  message: string,
  files: Array<{
    path: string;
    content?: string;
    encoding?: "utf-8" | "base64";
    delete?: boolean;
  }>
) {
  const baseCommitSha = await getReferenceSha(token, repo);
  const baseCommit = await getCommit(token, repo, baseCommitSha);

  const treeEntries = await Promise.all(
    files.map(async (file) => {
      if (file.delete) {
        return {
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: null,
        };
      }
      if (!file.content || !file.encoding) {
        throw new Error(`Missing content for ${file.path}`);
      }
      const blobSha = await createBlob(token, repo, file.content, file.encoding);
      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blobSha,
      };
    })
  );

  const nextTreeSha = await createTree(token, repo, baseCommit.tree.sha, treeEntries);
  const nextCommitSha = await createCommit(token, repo, message, nextTreeSha, baseCommitSha);
  await updateReference(token, repo, nextCommitSha);
}
