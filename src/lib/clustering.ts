// Pure math utilities for cosine similarity and greedy clustering.
// No DB or OpenAI dependencies — pure TypeScript math.

/**
 * Cosine similarity between two vectors. Returns 0 for empty/degenerate vectors.
 * Handles different-length vectors by using the min length.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const len = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < len; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  if (magA === 0 || magB === 0) return 0;

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Find the k most similar items to a target vector from a list of candidates.
 * Returns Array<{ id: string; similarity: number }> sorted desc,
 * filtered by threshold (default 0.75). k defaults to 5.
 */
export function findSimilar(
  target: number[],
  candidates: Array<{ id: string; embedding: number[] }>,
  k?: number,
  threshold?: number
): Array<{ id: string; similarity: number }> {
  const topK = k ?? 5;
  const minThreshold = threshold ?? 0.75;

  const results = candidates
    .map((c) => ({ id: c.id, similarity: cosineSimilarity(target, c.embedding) }))
    .filter((r) => r.similarity >= minThreshold)
    .sort((x, y) => y.similarity - x.similarity);

  return results.slice(0, topK);
}

/**
 * Group items into clusters by similarity. Simple greedy single-linkage approach:
 * For each unassigned item, find all items with similarity >= threshold and form a cluster.
 * Returns Array<Array<string>> (array of clusters, each cluster is array of item ids).
 * Default threshold 0.85.
 */
export function clusterBySimilarity(
  items: Array<{ id: string; embedding: number[] }>,
  threshold?: number
): Array<Array<string>> {
  const minThreshold = threshold ?? 0.85;
  const assigned = new Set<string>();
  const clusters: Array<Array<string>> = [];

  for (let i = 0; i < items.length; i++) {
    const seed = items[i];
    if (assigned.has(seed.id)) continue;

    const cluster: string[] = [seed.id];
    assigned.add(seed.id);

    for (let j = i + 1; j < items.length; j++) {
      const other = items[j];
      if (assigned.has(other.id)) continue;

      if (cosineSimilarity(seed.embedding, other.embedding) >= minThreshold) {
        cluster.push(other.id);
        assigned.add(other.id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Normalize a vector to unit length (for cosine = dot product of normalized).
 * Returns a zero vector if the input is empty or has zero magnitude.
 */
export function normalize(vec: number[]): number[] {
  if (vec.length === 0) return [];

  let mag = 0;
  for (const v of vec) {
    mag += v * v;
  }
  mag = Math.sqrt(mag);

  if (mag === 0) return vec.map(() => 0);

  return vec.map((v) => v / mag);
}
