#!/usr/bin/env node
// Phase 1 topology analysis for tour-builder.
// Usage: node ua-tour-analyze.js <input.json> <output.json>

import { readFileSync, writeFileSync } from 'fs';

function main() {
  const inPath = process.argv[2];
  const outPath = process.argv[3];
  if (!inPath || !outPath) {
    console.error('Usage: node ua-tour-analyze.js <input.json> <output.json>');
    process.exit(1);
  }
  const { nodes, edges, layers } = JSON.parse(readFileSync(inPath, 'utf8'));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // ---- A. Fan-in ----
  const fanIn = new Map(nodes.map((n) => [n.id, 0]));
  const fanOut = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (nodeIds.has(e.target)) fanIn.set(e.target, (fanIn.get(e.target) || 0) + 1);
    if (nodeIds.has(e.source)) fanOut.set(e.source, (fanOut.get(e.source) || 0) + 1);
  }
  const fanInRanking = [...fanIn.entries()]
    .map(([id, c]) => ({ id, fanIn: c, name: nodeById.get(id)?.name }))
    .sort((a, b) => b.fanIn - a.fanIn)
    .slice(0, 20);
  const fanOutRanking = [...fanOut.entries()]
    .map(([id, c]) => ({ id, fanOut: c, name: nodeById.get(id)?.name }))
    .sort((a, b) => b.fanOut - a.fanOut)
    .slice(0, 20);

  // ---- C. Entry point candidates ----
  const entryFilenames = new Set([
    'index.ts','index.js','main.ts','main.js','app.ts','app.js','server.ts','server.js',
    'mod.rs','main.go','main.py','main.rs','manage.py','app.py','wsgi.py','asgi.py',
    'run.py','__main__.py','Application.java','Main.java','Program.cs','config.ru',
    'index.php','App.swift','Application.kt','main.cpp','main.c'
  ]);
  const fanOutValues = [...fanOut.values()].sort((a, b) => b - a);
  const fanOutTop10PctThreshold = fanOutValues.length
    ? fanOutValues[Math.floor(fanOutValues.length * 0.1)]
    : Infinity;
  const fanInValues = [...fanIn.values()].sort((a, b) => a - b);
  const fanInBottom25PctThreshold = fanInValues.length
    ? fanInValues[Math.floor(fanInValues.length * 0.25)]
    : 0;

  const entryScores = nodes.map((n) => {
    let score = 0;
    const depth = n.filePath.split('/').length - 1;
    if (n.type === 'document') {
      if (n.name === 'README.md' && depth === 0) score += 5;
      else if (/\.md$/.test(n.name) && depth === 0) score += 2;
    } else if (n.type === 'file') {
      if (entryFilenames.has(n.name)) score += 3;
      if (depth <= 1) score += 1;
      if ((fanOut.get(n.id) || 0) >= fanOutTop10PctThreshold) score += 1;
      if ((fanIn.get(n.id) || 0) <= fanInBottom25PctThreshold) score += 1;
    }
    return { id: n.id, score, name: n.name, type: n.type, summary: n.summary };
  });
  const entryPointCandidates = entryScores
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // ---- D. BFS from top code entry point ----
  const topCodeEntry = entryScores
    .filter((e) => e.type === 'file')
    .sort((a, b) => b.score - a.score)[0];
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (e.type === 'imports' || e.type === 'calls') {
      if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
        adj.get(e.source).push(e.target);
      }
    }
  }
  const bfsOrder = [];
  const depthMap = {};
  const byDepth = {};
  if (topCodeEntry) {
    const start = topCodeEntry.id;
    const visited = new Set([start]);
    const queue = [{ id: start, depth: 0 }];
    depthMap[start] = 0;
    while (queue.length) {
      const { id, depth } = queue.shift();
      bfsOrder.push(id);
      (byDepth[depth] = byDepth[depth] || []).push(id);
      for (const t of adj.get(id) || []) {
        if (!visited.has(t)) {
          visited.add(t);
          depthMap[t] = depth + 1;
          queue.push({ id: t, depth: depth + 1 });
        }
      }
    }
  }

  // ---- E. Non-code file inventory ----
  const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
  for (const n of nodes) {
    const entry = { id: n.id, name: n.name, type: n.type, summary: n.summary };
    if (n.type === 'document') nonCodeFiles.documentation.push(entry);
    else if (['service', 'pipeline', 'resource'].includes(n.type)) nonCodeFiles.infrastructure.push(entry);
    else if (['table', 'schema', 'endpoint'].includes(n.type)) nonCodeFiles.data.push(entry);
    else if (n.type === 'config') nonCodeFiles.config.push(entry);
  }

  // ---- F. Tightly coupled clusters ----
  // bidirectional pairs (imports/calls both ways)
  const edgeSet = new Set(edges.filter(e => e.type==='imports'||e.type==='calls').map(e => `${e.source}|${e.target}`));
  const clusters = [];
  const seenPair = new Set();
  for (const e of edges) {
    if (e.type !== 'imports' && e.type !== 'calls') continue;
    const key = `${e.source}|${e.target}`;
    const rev = `${e.target}|${e.source}`;
    if (edgeSet.has(rev) && !seenPair.has(key) && !seenPair.has(rev)) {
      seenPair.add(key); seenPair.add(rev);
      clusters.push({ nodes: [e.source, e.target], edgeCount: 2 });
    }
  }
  // expand clusters by adding nodes connecting to 2+ members
  // (simple expansion)
  // sort by edgeCount desc, take top 10
  clusters.sort((a,b)=>b.edgeCount-a.edgeCount);

  // ---- G. Layers ----
  const layerList = layers.map((l) => ({ id: l.id, name: l.name, description: l.description }));

  // ---- H. Node summary index ----
  const nodeSummaryIndex = {};
  for (const n of nodes) nodeSummaryIndex[n.id] = { name: n.name, type: n.type, summary: n.summary };

  const result = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking,
    fanOutRanking,
    bfsTraversal: {
      startNode: topCodeEntry ? topCodeEntry.id : null,
      order: bfsOrder,
      depthMap,
      byDepth,
    },
    nonCodeFiles,
    clusters: clusters.slice(0, 10),
    layers: { count: layers.length, list: layerList },
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length,
  };

  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('analysis complete: wrote', outPath);
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error('FATAL:', err);
  process.exit(1);
}
