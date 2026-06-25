// Bundle the AWS Lambda handler with esbuild into a single file plus the
// Prisma client + engine binaries, ready for `sam deploy`.
// Output: aws/lambda/dist/index.js (and copied prisma engine).
//
// Run: `npm run ingest:lambda`

import { build } from "esbuild";
import { cpSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(process.cwd());
const OUT_DIR = join(ROOT, "aws", "lambda", "dist");
const ENTRY = join(ROOT, "aws", "lambda", "handler.ts");

mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  await build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    tsconfig: join(ROOT, "tsconfig.json"),
    outfile: join(OUT_DIR, "index.js"),
    // Prisma client needs to be external so it can locate its engine binary
    // that we copy next to the bundle. @prisma/client re-exports from
    // .prisma/client which is generated under node_modules.
    external: ["@prisma/client", "@prisma/client/runtime"],
    logLevel: "info",
    banner: {
      js: '// FeedbackFlow AI - ingest Lambda bundle (generated, do not edit)',
    },
  });

  // Copy the generated Prisma client + query engine binary next to the bundle
  // so the Lambda runtime can find it. The Lambda's Prisma client is generated
  // by `prisma generate` during the build step (see aws/README.md).
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

  console.log("Lambda bundle written to aws/lambda/dist/index.js");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
