import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  findSimilar,
  clusterBySimilarity,
  normalize,
} from '../clustering';

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0, 6);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 6);
  });

  it('returns -1.0 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1.0, 6);
  });

  it('returns 0 for empty arrays', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [])).toBe(0);
  });

  it('handles different-length arrays using min length', () => {
    // Only the first two components are compared: [1, 0] vs [1, 0] => 1.0
    expect(cosineSimilarity([1, 0, 5, 9], [1, 0])).toBeCloseTo(1.0, 6);
  });

  it('returns 0 for zero-magnitude vectors', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

describe('findSimilar', () => {
  const target = [1, 0];
  const candidates = [
    { id: 'a', embedding: [1, 0] }, // sim = 1.0
    { id: 'b', embedding: [0, 1] }, // sim = 0.0
    { id: 'c', embedding: [1, 1] }, // sim = 0.707
    { id: 'd', embedding: [0.99, 0.01] }, // sim ~ 0.9999
    { id: 'e', embedding: [-1, 0] }, // sim = -1.0
  ];

  it('returns sorted results above threshold', () => {
    const results = findSimilar(target, candidates, 5, 0.75);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('a');
    expect(ids).toContain('d');
    expect(ids).not.toContain('b');
    expect(ids).not.toContain('c');
    expect(ids).not.toContain('e');
    // descending order
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
  });

  it('respects k limit', () => {
    const results = findSimilar(target, candidates, 1, 0.75);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a');
  });

  it('uses default k=5 and threshold=0.75', () => {
    const results = findSimilar(target, candidates);
    expect(results.length).toBeLessThanOrEqual(5);
    for (const r of results) {
      expect(r.similarity).toBeGreaterThanOrEqual(0.75);
    }
  });
});

describe('clusterBySimilarity', () => {
  it('groups similar items together', () => {
    const items = [
      { id: 'a', embedding: [1, 0] },
      { id: 'b', embedding: [0.99, 0.01] }, // ~1.0 with a
      { id: 'c', embedding: [0, 1] },
      { id: 'd', embedding: [0.01, 0.99] }, // ~1.0 with c
    ];

    const clusters = clusterBySimilarity(items, 0.85);
    expect(clusters).toHaveLength(2);

    const aCluster = clusters.find((c) => c.includes('a'));
    const cCluster = clusters.find((c) => c.includes('c'));
    expect(aCluster).toBeDefined();
    expect(cCluster).toBeDefined();
    expect(aCluster).toContain('b');
    expect(cCluster).toContain('d');
  });

  it('leaves dissimilar items in singleton clusters', () => {
    const items = [
      { id: 'a', embedding: [1, 0] },
      { id: 'b', embedding: [0, 1] },
      { id: 'c', embedding: [-1, 0] },
    ];

    const clusters = clusterBySimilarity(items, 0.85);
    expect(clusters).toHaveLength(3);
    expect(clusters.flat().sort()).toEqual(['a', 'b', 'c']);
  });

  it('uses default threshold 0.85', () => {
    const items = [
      { id: 'a', embedding: [1, 0] },
      { id: 'b', embedding: [1, 1] }, // sim ~ 0.707 < 0.85
    ];
    const clusters = clusterBySimilarity(items);
    expect(clusters).toHaveLength(2);
  });
});

describe('normalize', () => {
  it('produces a unit vector', () => {
    const v = [3, 4];
    const n = normalize(v);
    const mag = Math.sqrt(n[0] ** 2 + n[1] ** 2);
    expect(mag).toBeCloseTo(1.0, 6);
  });

  it('preserves direction', () => {
    const v = [2, 0];
    const n = normalize(v);
    expect(n[0]).toBeCloseTo(1.0, 6);
    expect(n[1]).toBeCloseTo(0.0, 6);
  });

  it('handles empty vector', () => {
    expect(normalize([])).toEqual([]);
  });

  it('handles zero vector', () => {
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});
