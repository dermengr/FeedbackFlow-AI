// Seed script: `npm run seed`
// Creates a demo user and (optionally) a few sample feedback items with
// analyses so the UI has data even before the first real ingest runs.
// Pass `--with-samples` to also insert sample feedback.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function main() {
  const email = "demo@feedbackflow.dev";
  const password = "password123";

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, hashedPassword: hashed, name: "Demo User" },
  });
  console.log(`Seeded user: ${user.email} (password: ${password})`);

  if (process.argv.includes("--with-samples")) {
    await seedSamples();
  }

  console.log("Seed complete.");
}

async function seedSamples() {
  const samples: Array<{
    externalId: string;
    title: string;
    rawContent: string;
    authorLogin: string;
    url: string;
    daysAgo: number;
    sentiment: "positive" | "neutral" | "negative";
    topics: string[];
    severity: number;
    summary: string;
  }> = [
    {
      externalId: "sample/seed-1",
      title: "App crashes on login with SSO",
      rawContent:
        "Every time I try to log in via Google SSO, the app freezes and then crashes after a few seconds. This is blocking my whole team. Repro: Chrome 120, macOS 14.",
      authorLogin: "alex.r",
      url: "https://example.com/feedback/1",
      daysAgo: 1,
      sentiment: "negative",
      topics: ["Bug Report", "Security", "Performance"],
      severity: 5,
      summary: "Critical login crash via Google SSO blocking an entire team on Chrome/macOS.",
    },
    {
      externalId: "sample/seed-2",
      title: "Would love a dark mode",
      rawContent:
        "Great product overall, but I'd really love a dark mode for late-night work. The current white theme is hard on the eyes.",
      authorLogin: "jamie.k",
      url: "https://example.com/feedback/2",
      daysAgo: 2,
      sentiment: "positive",
      topics: ["Feature Request", "UX/UI"],
      severity: 2,
      summary: "Happy user requesting a dark mode theme for evening use.",
    },
    {
      externalId: "sample/seed-3",
      title: "Pricing is unclear for annual plan",
      rawContent:
        "I can't find anywhere what the annual plan costs vs monthly. The pricing page only shows monthly. Please clarify.",
      authorLogin: "sam.p",
      url: "https://example.com/feedback/3",
      daysAgo: 3,
      sentiment: "neutral",
      topics: ["Pricing", "Documentation"],
      severity: 3,
      summary: "Customer wants annual pricing visibility on the pricing page.",
    },
    {
      externalId: "sample/seed-4",
      title: "API rate limits too aggressive",
      rawContent:
        "We hit the 100 req/min limit constantly during batch imports. This is severely impacting our integration. Need a higher tier or configurable limits.",
      authorLogin: "morgan.t",
      url: "https://example.com/feedback/4",
      daysAgo: 4,
      sentiment: "negative",
      topics: ["Performance", "Integration", "Pricing"],
      severity: 4,
      summary: "Aggressive API rate limits are breaking batch imports; requesting higher tier.",
    },
    {
      externalId: "sample/seed-5",
      title: "Onboarding wizard is fantastic",
      rawContent:
        "Just wanted to say the new onboarding wizard is incredibly well designed. Got our whole team set up in 10 minutes. Great job!",
      authorLogin: "casey.l",
      url: "https://example.com/feedback/5",
      daysAgo: 5,
      sentiment: "positive",
      topics: ["Onboarding", "UX/UI"],
      severity: 1,
      summary: "Glowing review of the new onboarding wizard's design and speed.",
    },
  ];

  for (const s of samples) {
    const originalTimestamp = new Date();
    originalTimestamp.setDate(originalTimestamp.getDate() - s.daysAgo);

    const item = await prisma.feedbackItem.upsert({
      where: { externalId: s.externalId },
      update: {},
      create: {
        source: "Sample",
        externalId: s.externalId,
        title: s.title,
        rawContent: s.rawContent,
        authorLogin: s.authorLogin,
        url: s.url,
        originalTimestamp,
      },
    });

    await prisma.feedbackAnalysis.upsert({
      where: { feedbackItemId: item.id },
      update: {},
      create: {
        feedbackItemId: item.id,
        sentiment: s.sentiment,
        topics: s.topics,
        severityScore: s.severity,
        summary: s.summary,
        status: "NEW",
      },
    });
  }
  console.log(`Seeded ${samples.length} sample feedback items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
