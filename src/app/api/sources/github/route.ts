import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import {
  parseGitHubUrl,
  checkRepoExists,
  GitHubUrlError,
} from "@/lib/sources/github-url";

// POST /api/sources/github — submit a GitHub repository URL and create a
// SourceConfig for it. Optionally validates the repo exists via the GitHub API.
//
// Body: { url: string, label?: string, validate?: boolean }
// Returns: 201 with the created SourceConfig, or 400/409 on errors.

const BodySchema = z.object({
  url: z.string().min(1).max(500),
  label: z.string().min(1).max(200).optional(),
  validate: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 1. Parse the GitHub URL
  let repoInfo;
  try {
    repoInfo = parseGitHubUrl(parsed.data.url);
  } catch (err) {
    if (err instanceof GitHubUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const { owner, repo } = repoInfo;
  const sourceKey = `github:${owner}/${repo}`;
  const label = parsed.data.label ?? `GitHub Issues — ${owner}/${repo}`;

  // 2. Optionally validate the repo exists
  if (parsed.data.validate) {
    try {
      const exists = await checkRepoExists(owner, repo);
      if (!exists) {
        return NextResponse.json(
          {
            error: `Repository "${owner}/${repo}" not found or not accessible. Check the URL or set GITHUB_TOKEN for private repos.`,
            repoExists: false,
          },
          { status: 400 }
        );
      }
    } catch (err) {
      // Network error during validation — don't block, just warn
      console.warn(
        `[sources/github] repo validation failed: ${(err as Error).message}`
      );
    }
  }

  // 3. Check for duplicate source
  const existing = await prisma.sourceConfig.findUnique({
    where: { sourceKey },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: `A source for "${owner}/${repo}" already exists.`,
        existing,
      },
      { status: 409 }
    );
  }

  // 4. Create the SourceConfig
  const created = await prisma.sourceConfig.create({
    data: {
      sourceKey,
      label,
      adapter: "github",
      config: { owner, repo } as never,
      enabled: true,
    },
  });

  return NextResponse.json(
    {
      ...created,
      repoInfo: { owner, repo, url: repoInfo.url },
    },
    { status: 201 }
  );
}
