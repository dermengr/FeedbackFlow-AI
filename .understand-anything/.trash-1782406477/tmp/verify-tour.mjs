import { readFileSync } from 'fs';
const base = '/workspaces/FeedbackFlow-AI/.understand-anything/';
const nodes = JSON.parse(readFileSync(base + 'tmp/tour-nodes.json', 'utf8'));
const tour = JSON.parse(readFileSync(base + 'intermediate/tour.json', 'utf8'));
const nodeIds = new Set(nodes.map((n) => n.id));
let missing = [];
let orders = [];
for (const step of tour) {
  orders.push(step.order);
  if (!step.nodeIds || step.nodeIds.length === 0) {
    console.error('Step', step.order, 'has empty nodeIds');
  }
  for (const id of step.nodeIds) {
    if (!nodeIds.has(id)) missing.push({ order: step.order, id });
  }
}
console.log('steps:', tour.length);
console.log('orders:', orders.join(','));
console.log('sequential & no gaps:', orders.every((o, i) => o === i + 1));
console.log('missing nodeIds:', missing.length === 0 ? 'NONE' : JSON.stringify(missing, null, 2));
