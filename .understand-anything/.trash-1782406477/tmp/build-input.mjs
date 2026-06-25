import { readFileSync, writeFileSync } from 'fs';

const base = '/workspaces/FeedbackFlow-AI/.understand-anything/tmp/';
const nodes = JSON.parse(readFileSync(base + 'tour-nodes.json', 'utf8'));
const edges = JSON.parse(readFileSync(base + 'tour-edges.json', 'utf8'));
const layers = JSON.parse(readFileSync(base + 'tour-layers.json', 'utf8'));

writeFileSync(base + 'ua-tour-input.json', JSON.stringify({ nodes, edges, layers }));
console.log('wrote input', nodes.length, edges.length, layers.length);
