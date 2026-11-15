'use strict';

/**
 * Directed, multi-edge Web of Trust analysis for OpenPGP certification data.
 * This module analyzes already-parsed/verified certification metadata; it does
 * not parse packets or verify cryptographic signatures.
 */
const CERTIFICATION_WEIGHTS = Object.freeze({ 0x10: 0.5, 0x11: 0.65, 0x12: 0.8, 0x13: 1.0 });
const DEFAULT_GAMMA = 0.85;
const DEFAULT_MAX_HOPS = 4;
const DEFAULT_MAX_PATHS = 3;
const EPSILON = 1e-12;

function assertNodeId(value, name = 'nodeId') {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be a non-empty string`);
}
function assertProbability(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} must be a finite number in [0, 1]`);
}
function certificationWeight(type) {
  const numeric = typeof type === 'string' ? Number(type) : type;
  if (!Object.prototype.hasOwnProperty.call(CERTIFICATION_WEIGHTS, numeric)) throw new RangeError(`Unsupported certification type: ${type}`);
  return CERTIFICATION_WEIGHTS[numeric];
}
function combineParallelWeights(weights) {
  if (!Array.isArray(weights)) throw new TypeError('weights must be an array');
  return 1 - weights.reduce((remaining, weight, i) => {
    assertProbability(weight, `weights[${i}]`);
    return remaining * (1 - weight);
  }, 1);
}
function normalizeEdges(edges) {
  if (!Array.isArray(edges)) throw new TypeError('edges must be an array');
  return edges.map((edge, index) => {
    if (!edge || typeof edge !== 'object') throw new TypeError(`edges[${index}] must be an object`);
    assertNodeId(edge.source, `edges[${index}].source`); assertNodeId(edge.target, `edges[${index}].target`);
    const weight = edge.weight === undefined ? certificationWeight(edge.certificationType) : edge.weight;
    assertProbability(weight, `edges[${index}].weight`);
    return { ...edge, source: edge.source, target: edge.target, weight, id: edge.id === undefined ? index : edge.id };
  });
}
function buildAdjacency(edges) {
  const adjacency = new Map();
  for (const edge of edges) { if (!adjacency.has(edge.source)) adjacency.set(edge.source, []); if (!adjacency.has(edge.target)) adjacency.set(edge.target, []); adjacency.get(edge.source).push(edge); }
  return adjacency;
}
class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) { this.items.push(item); let i = this.items.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.items[p].cost <= item.cost) break; this.items[i] = this.items[p]; i = p; } this.items[i] = item; }
  pop() { if (!this.items.length) return undefined; const root = this.items[0]; const last = this.items.pop(); if (this.items.length) { let i = 0; while (true) { let child = i * 2 + 1; if (child >= this.items.length) break; if (child + 1 < this.items.length && this.items[child + 1].cost < this.items[child].cost) child++; if (this.items[child].cost >= last.cost) break; this.items[i] = this.items[child]; i = child; } this.items[i] = last; } return root; }
}
function validateOptions(options) {
  const gamma = options.gamma === undefined ? DEFAULT_GAMMA : options.gamma;
  const maxHops = options.maxHops === undefined ? DEFAULT_MAX_HOPS : options.maxHops;
  assertProbability(gamma, 'gamma');
  if (gamma <= 0) throw new RangeError('gamma must be greater than zero');
  if (!Number.isInteger(maxHops) || maxHops < 0) throw new RangeError('maxHops must be a non-negative integer');
  return { gamma, maxHops };
}
function dijkstraTrustPath(edges, source, target, options = {}) {
  assertNodeId(source, 'source'); assertNodeId(target, 'target');
  const { gamma, maxHops } = validateOptions(options); const normalized = normalizeEdges(edges); const adjacency = buildAdjacency(normalized);
  if (source === target) return { source, target, capacity: 1, cost: 0, hops: 0, path: [source], edgeIds: [] };
  const best = new Map(); const heap = new MinHeap(); const start = { node: source, hops: 0, cost: 0, capacity: 1, path: [source], edgeIds: [] };
  best.set(`${source}\0${0}`, start); heap.push(start);
  while (heap.size) {
    const current = heap.pop(); const state = best.get(`${current.node}\0${current.hops}`);
    if (!state || Math.abs(state.cost - current.cost) > EPSILON) continue;
    if (current.node === target) return { source, target, capacity: current.capacity, cost: current.cost, hops: current.hops, path: current.path, edgeIds: current.edgeIds };
    if (current.hops >= maxHops) continue;
    for (const edge of adjacency.get(current.node) || []) {
      if (edge.weight <= 0 || current.path.includes(edge.target)) continue;
      const hops = current.hops + 1; const capacity = current.capacity * edge.weight * (hops === 1 ? 1 : gamma); const cost = -Math.log(capacity); const key = `${edge.target}\0${hops}`;
      const previous = best.get(key);
      if (!previous || cost < previous.cost - EPSILON) { const next = { node: edge.target, hops, cost, capacity, path: [...current.path, edge.target], edgeIds: [...current.edgeIds, edge.id] }; best.set(key, next); heap.push(next); }
    }
  }
  return null;
}
function undirectedAdjacency(edges) {
  const graph = new Map(); const add = (a, b) => { if (!graph.has(a)) graph.set(a, []); graph.get(a).push(b); };
  for (const edge of normalizeEdges(edges)) { add(edge.source, edge.target); add(edge.target, edge.source); }
  return graph;
}
function findSecurityBottlenecks(edges) {
  const graph = undirectedAdjacency(edges), discovery = new Map(), low = new Map(), points = new Set(); let timer = 0;
  function visit(node, parent) { discovery.set(node, ++timer); low.set(node, timer); let children = 0; for (const next of graph.get(node) || []) { if (next === parent) continue; if (discovery.has(next)) low.set(node, Math.min(low.get(node), discovery.get(next))); else { children++; visit(next, node); low.set(node, Math.min(low.get(node), low.get(next))); if (parent !== null && low.get(next) >= discovery.get(node)) points.add(node); } } if (parent === null && children > 1) points.add(node); }
  for (const node of graph.keys()) if (!discovery.has(node)) visit(node, null); return [...points].sort();
}
function findIndependentTrustFlow(edges, source, target, options = {}) {
  const normalized = normalizeEdges(edges); const maxPaths = options.maxPaths === undefined ? DEFAULT_MAX_PATHS : options.maxPaths;
  if (!Number.isInteger(maxPaths) || maxPaths < 0) throw new RangeError('maxPaths must be a non-negative integer');
  const paths = []; let remaining = normalized; const usedNodes = new Set();
  while (paths.length < maxPaths) {
    const candidate = dijkstraTrustPath(remaining, source, target, options); if (!candidate) break;
    paths.push(candidate); for (const node of candidate.path.slice(1, -1)) usedNodes.add(node);
    remaining = remaining.filter(edge => !candidate.edgeIds.includes(edge.id) && !usedNodes.has(edge.source) && !usedNodes.has(edge.target));
  }
  return { source, target, paths, aggregateCapacity: combineParallelWeights(paths.map(path => path.capacity)) };
}
module.exports = { CERTIFICATION_WEIGHTS, combineParallelWeights, certificationWeight, dijkstraTrustPath, findIndependentTrustFlow, findSecurityBottlenecks };
