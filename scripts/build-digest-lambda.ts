// Bundle the AWS Lambda digest handler with esbuild into a single file plus the
// Prisma client + engine binaries, ready for `sam deploy`.
// Output: aws/lambda/dist/digest.js (and copied prisma engine).
//
// Run: `npm run digest:lambda`

import { build } from "esbuild";
import { cpSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(process.cwd());
const OUT_DIR = join(ROOT, "aws", "lambda", "dist");
const ENTRY = join(ROOT, "aws", "lambda", "digest-handler.ts");

mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  await build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    tsconfig: join(ROOT, "tsconfig.json"),
    outfile: join(OUT_DIR, "digest.js"),
    external: ["@prisma/client", "@prisma/client/runtime"],
    logLevel: "info",
    banner: {
      js: '// FeedbackFlow AI - digest Lambda bundle (generated, do not edit)',
    },
  });

  // Copy the generated Prisma client + query engine binary next to the bundle
  // (shared with the ingest Lambda bundle in the same dist/ directory).
  const prismaClientDir = join(ROOT, "node_modules", ".prisma", "client");
  if (existsSync(prismaClientDir)) {
    cpSync(prismaClientDir, join(OUT_DIR, "prisma-client"), {
      recursive: true,
    });
    console.log("Copied generated Prisma client to dist/prisma-client");
  } else {
    console.warn(
      "WARNING: node_modules/.prisma/client not found. Run `npx prisma generate` before bundling."
    );
  }

  // Copy schema.prisma so the client can resolve the datasource.
  cpSync(
    join(ROOT, "prisma", "schema.prisma"),
    join(OUT_DIR, "prisma-client", "schema.prisma")
  );

  console.log("Digest Lambda bundle written to aws/lambda/dist/digest.js");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
