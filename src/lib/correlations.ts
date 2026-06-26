import { prisma } from "@/lib/prisma";

export type CorrelationStrength = "strong" | "moderate" | "weak";

export interface TopicCorrelation {
  topicA: string;
  topicB: string;
  count: number;
  strength: CorrelationStrength;
}

// Thresholds for translating a raw co-occurrence count into a strength label.
// - count > 20  -> "strong"
// - count > 10  -> "moderate"
// - otherwise   -> "weak"
const STRONG_THRESHOLD = 20;
const MODERATE_THRESHOLD = 10;

// Classify a co-occurrence count into a strength label. Kept as a pure helper
// so it can be unit-tested independently of the matrix builder.
export function strengthForCount(count: number): CorrelationStrength {
  if (count > STRONG_THRESHOLD) return "strong";
  if (count > MODERATE_THRESHOLD) return "moderate";
  return "weak";
}

// Build a co-occurrence matrix from an array of topic-arrays.
//
// For each set of topics that appeared together in a single feedback analysis,
// every unordered pair of *distinct* topics is counted once. Self-pairs
// (a topic with itself) are never counted, and duplicate topics within a single
// analysis are de-duplicated so a pair is only incremented once per analysis.
//
// The matrix is returned as a Map keyed by "topicA|topicB" where the two
// topics are sorted alphabetically to guarantee a canonical key for each
// unordered pair. The value is the number of analyses in which the pair
// co-occurred.
export function buildCoOccurrenceMatrix(
  allTopics: string[][]
): Map<string, number> {
  const matrix = new Map<string, number>();

  for (const topics of allTopics) {
    if (!Array.isArray(topics) || topics.length < 2) continue;

    // De-duplicate topics within a single analysis so a pair only counts
    // once per record, even if a topic is repeated.
    const unique = Array.from(new Set(topics.filter((t) => typeof t === "string")));
    if (unique.length < 2) continue;

    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        // Sort alphabetically for a canonical unordered-pair key.
        const [a, b] =
          unique[i] <= unique[j]
            ? [unique[i], unique[j]]
            : [unique[j], unique[i]];
        const key = `${a}|${b}`;
        matrix.set(key, (matrix.get(key) ?? 0) + 1);
      }
    }
  }

  return matrix;
}

// Fetch FeedbackAnalysis records from the last `days` days, build a topic
// co-occurrence matrix, and return the correlations sorted by count descending.
//
// `days` defaults to 30. Only analyses whose `topics` field is a JSON array
// of strings are considered. Pairs with a count of 0 are never produced.
export async function getTopicCorrelations(
  days: number = 30
): Promise<TopicCorrelation[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const analyses = await prisma.feedbackAnalysis.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { topics: true },
  });

  const allTopics: string[][] = analyses.map((a) =>
    Array.isArray(a.topics) ? (a.topics as string[]) : []
  );

  const matrix = buildCoOccurrenceMatrix(allTopics);

  const correlations: TopicCorrelation[] = [];
  for (const [key, count] of matrix.entries()) {
    const [topicA, topicB] = key.split("|");
    correlations.push({
      topicA,
      topicB,
      count,
      strength: strengthForCount(count),
    });
  }

  // Sort by count descending, then alphabetically by pair for stable ordering.
  correlations.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.topicA !== b.topicA) return a.topicA.localeCompare(b.topicA);
    return a.topicB.localeCompare(b.topicB);
  });

  return correlations;
}
