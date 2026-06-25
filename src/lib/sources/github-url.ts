// ---------------------------------------------------------------------------
// GitHub repository URL parser
//
// Accepts a variety of GitHub repo URL formats and normalizes them to
// { owner, repo } for use with the SourceConfig adapter system.
//
// Supported formats:
//   https://github.com/owner/repo
//   https://github.com/owner/repo.git
//   https://github.com/owner/repo/tree/main
//   https://github.com/owner/repo/issues
//   git://github.com/owner/repo.git
//   git@github.com:owner/repo.git
//   owner/repo
// ---------------------------------------------------------------------------

export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  url: string; // normalized https URL
}

export class GitHubUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubUrlError";
  }
}

// GitHub owner/repo validation rules:
// - owner: 1-39 chars, alphanumeric + hyphens, no leading/trailing hyphen
// - repo: 1-100 chars, alphanumeric + hyphens/underscores/dots
const OWNER_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const REPO_RE = /^[a-zA-Z0-9._-]{1,100}$/;

export function parseGitHubUrl(input: string): ParsedGitHubRepo {
  const raw = input.trim();
  if (!raw) {
    throw new GitHubUrlError("URL is required");
  }

  let owner: string | undefined;
  let repo: string | undefined;

  // Format 1: git@github.com:owner/repo.git
  const sshMatch = raw.match(/^git@github\.com:([^/]+)\/([^/]+)/);
  if (sshMatch) {
    owner = sshMatch[1];
    repo = sshMatch[2];
  }

  // Format 2: https://github.com/owner/repo[/.git]/...
  if (owner === undefined) {
    try {
      const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      if (url.hostname === "github.com" || url.hostname === "www.github.com") {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          owner = parts[0];
          repo = parts[1];
        }
      }
    } catch {
      // Not a valid URL — try shorthand below
    }
  }

  // Format 3: git://github.com/owner/repo.git
  if (owner === undefined && raw.startsWith("git://")) {
    try {
      const url = new URL(raw);
      if (url.hostname === "github.com") {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          owner = parts[0];
          repo = parts[1];
        }
      }
    } catch {
      // ignore
    }
  }

  // Format 4: shorthand "owner/repo"
  if (owner === undefined) {
    const shorthand = raw.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (shorthand) {
      owner = shorthand[1];
      repo = shorthand[2];
    }
  }

  if (owner === undefined || repo === undefined) {
    throw new GitHubUrlError(
      `Could not parse GitHub repository from "${raw}". Expected formats: https://github.com/owner/repo, git@github.com:owner/repo.git, or owner/repo`
    );
  }

  // Strip trailing .git from repo name
  repo = repo.replace(/\.git$/, "");

  // Validate owner and repo names
  if (!OWNER_RE.test(owner)) {
    throw new GitHubUrlError(
      `Invalid GitHub owner name: "${owner}". Must be 1-39 alphanumeric characters or hyphens, no leading/trailing hyphen.`
    );
  }
  if (!REPO_RE.test(repo)) {
    throw new GitHubUrlError(
      `Invalid GitHub repository name: "${repo}". Must be 1-100 characters, alphanumeric + hyphens/underscores/dots.`
    );
  }

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
}

// Optionally verify that a GitHub repo exists by hitting the public API.
// Returns true if the repo is accessible, false otherwise.
// Does NOT throw on 404 — returns false. Throws on network errors.
export async function checkRepoExists(
  owner: string,
  repo: string
): Promise<boolean> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "FeedbackFlowAI/1.0",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
  });
  return res.ok;
}
