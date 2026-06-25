#!/usr/bin/env node
/* Architecture structural analysis script (Phase 1).
 * Reads three input JSON files (file nodes, import edges, all edges),
 * computes structural patterns, and writes results JSON.
 *
 * Usage: node ua-arch-analyze.js <fileNodesPath> <importEdgesPath> <allEdgesPath> <outputPath>
 */
const fs = require('fs');

function main() {
  const [, , fileNodesPath, importEdgesPath, allEdgesPath, outputPath] = process.argv;
  if (!fileNodesPath || !importEdgesPath || !allEdgesPath || !outputPath) {
    console.error('Usage: node ua-arch-analyze.js <fileNodesPath> <importEdgesPath> <allEdgesPath> <outputPath>');
    process.exit(1);
  }

  const fileNodes = JSON.parse(fs.readFileSync(fileNodesPath, 'utf8'));
  const importEdges = JSON.parse(fs.readFileSync(importEdgesPath, 'utf8'));
  const allEdges = JSON.parse(fs.readFileSync(allEdgesPath, 'utf8'));

  const nodeById = new Map(fileNodes.map((n) => [n.id, n]));

  // --- A. Directory Grouping ---
  // Compute common path prefix among all filePaths.
  const paths = fileNodes.map((n) => n.filePath);
  const commonPrefix = computeCommonPrefix(paths);

  const directoryGroups = {};
  const fileToGroup = new Map();
  for (const n of fileNodes) {
    const rel = n.filePath.startsWith(commonPrefix) ? n.filePath.slice(commonPrefix.length) : n.filePath;
    const segs = rel.split('/');
    let group;
    if (segs.length === 1) {
      group = '__root__';
    } else {
      group = segs[0];
    }
    if (!directoryGroups[group]) directoryGroups[group] = [];
    directoryGroups[group].push(n.id);
    fileToGroup.set(n.id, group);
  }

  // --- B. Node Type Grouping ---
  const nodeTypeGroups = {};
  for (const n of fileNodes) {
    if (!nodeTypeGroups[n.type]) nodeTypeGroups[n.type] = [];
    nodeTypeGroups[n.type].push(n.id);
  }

  // --- C. Import Adjacency Matrix ---
  const fanOut = {};
  const fanIn = {};
  for (const n of fileNodes) { fanOut[n.id] = 0; fanIn[n.id] = 0; }
  for (const e of importEdges) {
    if (fanOut[e.source] !== undefined) fanOut[e.source]++;
    if (fanIn[e.target] !== undefined) fanIn[e.target]++;
  }

  // group-level adjacency
  const groupImportsFrom = {}; // group -> set of groups it imports from
  const groupImportedBy = {};  // group -> set of groups importing it
  for (const e of importEdges) {
    const sg = fileToGroup.get(e.source);
    const tg = fileToGroup.get(e.target);
    if (sg && tg && sg !== tg) {
      if (!groupImportsFrom[sg]) groupImportsFrom[sg] = new Set();
      groupImportsFrom[sg].add(tg);
      if (!groupImportedBy[tg]) groupImportedBy[tg] = new Set();
      groupImportedBy[tg].add(sg);
    }
  }

  // --- D. Cross-Category Dependency Analysis ---
  const crossCategoryMap = {};
  for (const e of allEdges) {
    const s = nodeById.get(e.source);
    const t = nodeById.get(e.target);
    if (!s || !t) continue;
    const key = `${s.type}->${t.type}:${e.type}`;
    crossCategoryMap[key] = (crossCategoryMap[key] || 0) + 1;
  }
  const crossCategoryEdges = Object.entries(crossCategoryMap).map(([k, count]) => {
    const [fromType, rest] = k.split('->');
    const [toType, edgeType] = rest.split(':');
    return { fromType, toType, edgeType, count };
  });

  // --- E. Inter-Group Import Frequency ---
  const interGroupMap = {};
  for (const e of importEdges) {
    const sg = fileToGroup.get(e.source);
    const tg = fileToGroup.get(e.target);
    if (sg && tg && sg !== tg) {
      const key = `${sg}->${tg}`;
      interGroupMap[key] = (interGroupMap[key] || 0) + 1;
    }
  }
  const interGroupImports = Object.entries(interGroupMap).map(([k, count]) => {
    const [from, to] = k.split('->');
    return { from, to, count };
  }).sort((a, b) => b.count - a.count);

  // --- F. Intra-Group Import Density ---
  const intraGroupDensity = {};
  for (const g of Object.keys(directoryGroups)) {
    intraGroupDensity[g] = { internalEdges: 0, totalEdges: 0, density: 0 };
  }
  for (const e of importEdges) {
    const sg = fileToGroup.get(e.source);
    const tg = fileToGroup.get(e.target);
    if (!sg || !tg) continue;
    if (sg === tg) {
      intraGroupDensity[sg].internalEdges++;
      intraGroupDensity[sg].totalEdges++;
    } else {
      intraGroupDensity[sg].totalEdges++;
      intraGroupDensity[tg].totalEdges++;
    }
  }
  for (const g of Object.keys(intraGroupDensity)) {
    const d = intraGroupDensity[g];
    d.density = d.totalEdges > 0 ? +(d.internalEdges / d.totalEdges).toFixed(3) : 0;
  }

  // --- G. Directory Pattern Matching ---
  const patternMatches = {};
  for (const g of Object.keys(directoryGroups)) {
    patternMatches[g] = classifyDirectory(g);
  }
  // file-level pattern overrides
  const filePatternMatches = {};
  for (const n of fileNodes) {
    const fp = classifyFile(n.filePath, n.name);
    if (fp) filePatternMatches[n.id] = fp;
  }

  // --- H. Deployment Topology Detection ---
  const infraFiles = [];
  let hasDockerfile = false, hasCompose = false, hasK8s = false, hasTerraform = false, hasCI = false, hasSAM = false;
  for (const n of fileNodes) {
    const fp = n.filePath.toLowerCase();
    if (fp.endsWith('dockerfile') || fp.includes('dockerfile.')) { hasDockerfile = true; infraFiles.push(n.id); }
    if (fp.includes('docker-compose')) { hasCompose = true; infraFiles.push(n.id); }
    if (fp.endsWith('.yaml') && (fp.includes('k8s') || fp.includes('kubernetes') || fp.includes('helm'))) hasK8s = true;
    if (fp.endsWith('.tf') || fp.endsWith('.tfvars')) hasTerraform = true;
    if (fp.includes('.github/workflows') || fp.endsWith('.gitlab-ci.yml') || fp.endsWith('jenkinsfile')) hasCI = true;
    if (fp.endsWith('template.yaml') && fp.includes('aws/')) { hasSAM = true; infraFiles.push(n.id); }
    if (fp.endsWith('amplify.yml')) { hasCI = true; infraFiles.push(n.id); }
    if (n.type === 'service') infraFiles.push(n.id);
  }
  const deploymentTopology = {
    hasDockerfile, hasCompose, hasK8s, hasTerraform, hasCI, hasSAM,
    infraFiles: [...new Set(infraFiles)],
  };

  // --- I. Data Pipeline Detection ---
  const schemaFiles = [];
  const migrationFiles = [];
  const dataModelFiles = [];
  const apiHandlerFiles = [];
  for (const n of fileNodes) {
    if (n.type === 'schema') schemaFiles.push(n.id);
    if (n.type === 'table' && !n.id.includes(':')) migrationFiles.push(n.id);
    if (n.filePath.includes('/lib/prisma') || n.tags.includes('data-model')) dataModelFiles.push(n.id);
    if (n.filePath.includes('/api/') && n.filePath.endsWith('route.ts')) apiHandlerFiles.push(n.id);
  }

  // --- J. Documentation Coverage ---
  const docFiles = fileNodes.filter((n) => n.type === 'document');
  const docDirs = new Set(docFiles.map((n) => fileToGroup.get(n.id)));
  const totalGroups = Object.keys(directoryGroups).length;
  const undocumentedGroups = Object.keys(directoryGroups).filter((g) => !docDirs.has(g));
  const docCoverage = {
    groupsWithDocs: docDirs.size,
    totalGroups,
    coverageRatio: totalGroups > 0 ? +(docDirs.size / totalGroups).toFixed(2) : 0,
    undocumentedGroups,
  };

  // --- K. Dependency Direction ---
  const depDirMap = {};
  for (const e of importEdges) {
    const sg = fileToGroup.get(e.source);
    const tg = fileToGroup.get(e.target);
    if (sg && tg && sg !== tg) {
      const key = `${sg}->${tg}`;
      depDirMap[key] = (depDirMap[key] || 0) + 1;
    }
  }
  const dependencyDirection = [];
  const seen = new Set();
  for (const [key, count] of Object.entries(depDirMap)) {
    const [a, b] = key.split('->');
    const reverse = `${b}->${a}`;
    const reverseCount = depDirMap[reverse] || 0;
    if (count > reverseCount) {
      const dk = `${a}|${b}`;
      if (!seen.has(dk)) { seen.add(dk); dependencyDirection.push({ dependent: a, dependsOn: b, count }); }
    } else if (reverseCount > count) {
      const dk = `${b}|${a}`;
      if (!seen.has(dk)) { seen.add(dk); dependencyDirection.push({ dependent: b, dependsOn: a, count: reverseCount }); }
    }
  }

  // --- File stats ---
  const filesPerGroup = {};
  for (const [g, ids] of Object.entries(directoryGroups)) filesPerGroup[g] = ids.length;
  const nodeTypeCounts = {};
  for (const [t, ids] of Object.entries(nodeTypeGroups)) nodeTypeCounts[t] = ids.length;

  const results = {
    scriptCompleted: true,
    commonPrefix,
    directoryGroups,
    nodeTypeGroups,
    crossCategoryEdges,
    interGroupImports,
    intraGroupDensity,
    patternMatches,
    filePatternMatches,
    deploymentTopology,
    dataPipeline: { schemaFiles, migrationFiles, dataModelFiles, apiHandlerFiles },
    docCoverage,
    dependencyDirection,
    fileStats: {
      totalFileNodes: fileNodes.length,
      filesPerGroup,
      nodeTypeCounts,
    },
    fileFanIn: fanIn,
    fileFanOut: fanOut,
    groupImportsFrom: Object.fromEntries(Object.entries(groupImportsFrom).map(([k, v]) => [k, [...v]])),
    groupImportedBy: Object.fromEntries(Object.entries(groupImportedBy).map(([k, v]) => [k, [...v]])),
  };

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  process.exit(0);
}

function computeCommonPrefix(paths) {
  if (paths.length === 0) return '';
  const splitPaths = paths.map((p) => p.split('/'));
  let prefix = [];
  for (let i = 0; i < splitPaths[0].length - 1; i++) {
    const seg = splitPaths[0][i];
    if (splitPaths.every((sp) => sp[i] === seg)) prefix.push(seg);
    else break;
  }
  if (prefix.length === 0) return '';
  return prefix.join('/') + '/';
}

const DIR_PATTERNS = [
  ['routes|api|controllers|endpoints|handlers', 'api'],
  ['services|core|lib|domain|logic', 'service'],
  ['models|db|data|persistence|repository|entities', 'data'],
  ['components|views|pages|ui|layouts|screens', 'ui'],
  ['middleware|plugins|interceptors|guards', 'middleware'],
  ['utils|helpers|common|shared|tools', 'utility'],
  ['config|constants|env|settings', 'config'],
  ['__tests__|test|tests|spec|specs', 'test'],
  ['types|interfaces|schemas|contracts|dtos', 'types'],
  ['hooks', 'hooks'],
  ['store|state|reducers|actions|slices', 'state'],
  ['assets|static|public', 'assets'],
  ['migrations', 'data'],
  ['docs|documentation|wiki', 'documentation'],
  ['deploy|deployment|infra|infrastructure', 'infrastructure'],
  ['aws', 'infrastructure'],
  ['scripts', 'utility'],
  ['prisma', 'data'],
];

function classifyDirectory(dir) {
  const lower = dir.toLowerCase();
  for (const [pattern, label] of DIR_PATTERNS) {
    if (pattern.split('|').includes(lower)) return label;
  }
  // route group like (app)
  if (lower.startsWith('(') && lower.endsWith(')')) return 'ui';
  return 'unknown';
}

function classifyFile(filePath, name) {
  const lower = (filePath || '').toLowerCase();
  if (lower.match(/\.test\.|\.spec\.|_test\.|test_|spec$/)) return 'test';
  if (lower.endsWith('.d.ts')) return 'types';
  if (lower.endsWith('docker-compose') || lower.endsWith('docker-compose.yml') || lower.endsWith('docker-compose.yaml')) return 'infrastructure';
  if (lower.endsWith('dockerfile')) return 'infrastructure';
  if (lower.endsWith('.tf') || lower.endsWith('.tfvars')) return 'infrastructure';
  if (lower.endsWith('amplify.yml')) return 'infrastructure';
  if (lower.endsWith('makefile')) return 'infrastructure';
  if (lower.endsWith('.md') || lower.endsWith('.rst')) return 'documentation';
  if (lower.endsWith('.sql')) return 'data';
  if (lower.endsWith('.prisma')) return 'data';
  if (lower.endsWith('next.config.mjs')) return 'config';
  if (lower.endsWith('postcss.config.js') || lower.endsWith('tailwind.config.ts')) return 'config';
  if (lower.endsWith('tsconfig.tsbuildinfo')) return 'config';
  return null;
}

main();
