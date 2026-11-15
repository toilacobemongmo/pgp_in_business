'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  combineParallelWeights,
  certificationWeight,
  dijkstraTrustPath,
  findIndependentTrustFlow,
  findSecurityBottlenecks,
} = require('../backend/wot-analyzer');

test('maps all OpenPGP certification types', () => {
  assert.deepEqual([certificationWeight(0x10), certificationWeight(0x11), certificationWeight(0x12), certificationWeight(0x13)], [0.5, 0.65, 0.8, 1]);
  assert.equal(certificationWeight('18'), 0.8);
  assert.throws(() => certificationWeight(0x99), RangeError);
});

test('handles empty graphs and parallel probability aggregation', () => {
  assert.equal(dijkstraTrustPath([], 'A', 'B'), null);
  assert.equal(combineParallelWeights([]), 0);
  assert.ok(Math.abs(combineParallelWeights([0.8, 0.5]) - 0.9) < Number.EPSILON);
});

test('finds the maximum-capacity path with negative logarithmic costs and hop decay', () => {
  const result = dijkstraTrustPath([
    { source: 'A', target: 'B', weight: 0.9 }, { source: 'B', target: 'D', weight: 0.9 },
    { source: 'A', target: 'C', weight: 0.7 }, { source: 'C', target: 'D', weight: 1 },
  ], 'A', 'D', { gamma: 0.85, maxHops: 4 });
  assert.deepEqual(result.path, ['A', 'B', 'D']);
  assert.ok(Math.abs(result.capacity - 0.9 * 0.9 * 0.85) < 1e-12);
  assert.ok(Math.abs(result.cost + Math.log(result.capacity)) < 1e-12);
});

test('handles cycles without looping and enforces hop limits', () => {
  const edges = [{ source: 'A', target: 'B', weight: 1 }, { source: 'B', target: 'A', weight: 1 }, { source: 'B', target: 'C', weight: 1 }];
  assert.equal(dijkstraTrustPath(edges, 'A', 'C', { maxHops: 1 }), null);
  assert.deepEqual(dijkstraTrustPath(edges, 'A', 'C', { maxHops: 3 }).path, ['A', 'B', 'C']);
});

test('supports directed multi-edges and fragmented graphs', () => {
  const result = dijkstraTrustPath([
    { id: 'weak', source: 'A', target: 'B', weight: 0.4 }, { id: 'strong', source: 'A', target: 'B', weight: 0.9 }, { source: 'X', target: 'Y', weight: 1 },
  ], 'A', 'B');
  assert.equal(result.edgeIds[0], 'strong');
  assert.equal(dijkstraTrustPath([{ source: 'X', target: 'Y', weight: 1 }], 'A', 'B'), null);
});

test('rejects invalid probability and options', () => {
  assert.throws(() => dijkstraTrustPath([{ source: 'A', target: 'B', weight: 1.1 }], 'A', 'B'), RangeError);
  assert.throws(() => dijkstraTrustPath([], 'A', 'B', { gamma: 0 }), RangeError);
  assert.throws(() => dijkstraTrustPath([], 'A', 'B', { maxHops: 1.5 }), RangeError);
});

test('identifies articulation points, including SPoF edge cases', () => {
  assert.deepEqual(findSecurityBottlenecks([]), []);
  assert.deepEqual(findSecurityBottlenecks([{ source: 'A', target: 'B', weight: 1 }, { source: 'B', target: 'C', weight: 1 }, { source: 'C', target: 'D', weight: 1 }]), ['B', 'C']);
  assert.deepEqual(findSecurityBottlenecks([{ source: 'A', target: 'B', weight: 1 }, { source: 'B', target: 'C', weight: 1 }, { source: 'C', target: 'A', weight: 1 }]), []);
});

test('extracts node-disjoint independent paths and aggregates capacity', () => {
  const result = findIndependentTrustFlow([
    { source: 'A', target: 'B', weight: 0.8 }, { source: 'B', target: 'D', weight: 0.8 },
    { source: 'A', target: 'C', weight: 0.7 }, { source: 'C', target: 'D', weight: 0.7 },
  ], 'A', 'D', { maxPaths: 2 });
  assert.equal(result.paths.length, 2);
  assert.ok(Math.abs(result.aggregateCapacity - (1 - (1 - 0.544) * (1 - 0.4165))) < 1e-12);
});
