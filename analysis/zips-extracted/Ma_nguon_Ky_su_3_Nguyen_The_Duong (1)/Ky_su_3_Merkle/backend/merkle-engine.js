'use strict';

// Engineer 3: JSON audit records, RFC 6962 tree shape and inclusion proofs.
// This is a local engine, NOT a complete Certificate Transparency service.
const crypto = require('node:crypto');
const VERSION = 'merkle-jcs-sha256-v1';
const HEX = /^[0-9a-f]{64}$/;
const EMPTY_ROOT = crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex');

function validUnicode(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError('Lone surrogate');
    } else if (c >= 0xdc00 && c <= 0xdfff) throw new TypeError('Lone surrogate');
  }
  return s;
}

/** JCS for in-memory plain JSON values. Duplicate JSON names must be rejected
 * by the ingress parser BEFORE constructing an object (JSON.parse loses them).
 * No Unicode normalization, Date conversion, undefined dropping or toJSON calls.
 */
function canonicalize(value) {
  const active = new Set();
  function visit(v) {
    if (v === null) return 'null';
    if (typeof v === 'string') return JSON.stringify(validUnicode(v));
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new TypeError('Non-finite number');
      return JSON.stringify(v);
    }
    if (typeof v !== 'object') throw new TypeError('Expected plain JSON data');
    if (active.has(v)) throw new TypeError('Circular input');
    const isArray = Array.isArray(v);
    if (!isArray && ![Object.prototype, null].includes(Object.getPrototypeOf(v))) {
      throw new TypeError('Expected plain object');
    }
    active.add(v);
    try {
      const keys = Reflect.ownKeys(v);
      if (keys.some(k => typeof k !== 'string')) throw new TypeError('Symbol key');
      for (const k of keys) {
        if (isArray && k === 'length') continue;
        const d = Object.getOwnPropertyDescriptor(v, k);
        if (!d.enumerable || !('value' in d)) throw new TypeError('Accessor/hidden property');
      }
      if (isArray) {
        if (keys.length !== v.length + 1) throw new TypeError('Sparse/extended array');
        const items = [];
        for (let i = 0; i < v.length; i++) {
          if (!Object.hasOwn(v, i)) throw new TypeError('Sparse array');
          items.push(visit(v[i]));
        }
        return '[' + items.join(',') + ']';
      }
      // Serialize keys ourselves: re-stringifying an object would reorder integer keys.
      return '{' + Object.keys(v).sort().map(k =>
        JSON.stringify(validUnicode(k)) + ':' + visit(v[k])).join(',') + '}';
    } finally { active.delete(v); }
  }
  return visit(value);
}

function leafFromCanonical(s) {
  return crypto.createHash('sha256').update(Buffer.from([0])).update(s, 'utf8').digest();
}
function hashLeaf(record) { return leafFromCanonical(canonicalize(record)).toString('hex'); }
function parentHash(left, right) {
  return crypto.createHash('sha256').update(Buffer.from([1])).update(left).update(right).digest();
}
function join(left, right) {
  return { size: left.size + right.size, hash: parentHash(left.hash, right.hash), left, right };
}
function split(n) {
  let k = 2 ** Math.floor(Math.log2(n));
  // Also correct rounding of log2 just below a large power of two.
  if (k >= n) k /= 2;
  return k;
}
function appendNode(tree, leaf) {
  if (!tree) return leaf;
  // A power-of-two subtree is full; otherwise update only the right frontier.
  if (tree.size === 1 || tree.left.size === tree.right.size) return join(tree, leaf);
  return join(tree.left, appendNode(tree.right, leaf));
}
function buildNodes(leaves, start = 0, size = leaves.length) {
  if (!size) return null;
  if (size === 1) return leaves[start];
  const k = split(size);
  return join(buildNodes(leaves, start, k), buildNodes(leaves, start + k, size - k));
}
function validCheckpoint(c) {
  return c && c.version === VERSION && Number.isSafeInteger(c.treeSize) &&
    c.treeSize >= 0 && typeof c.rootHash === 'string' && HEX.test(c.rootHash);
}

/** Low-level compatibility API from the assignment. Does not bind size/index.
 * For integration prefer verifyInclusion with an independently trusted checkpoint.
 */
function verifyProof(rawLeaf, auditPath, rootHashHex) {
  try {
    if (typeof rootHashHex !== 'string' || !HEX.test(rootHashHex) ||
        !Array.isArray(auditPath) || auditPath.length > 53) return false;
    let current = leafFromCanonical(canonicalize(rawLeaf));
    for (const step of auditPath) {
      if (!step || typeof step.hash !== 'string' || !HEX.test(step.hash) ||
          !['left', 'right'].includes(step.direction)) return false;
      const sibling = Buffer.from(step.hash, 'hex');
      current = step.direction === 'right' ? parentHash(current, sibling) : parentHash(sibling, current);
    }
    return current.toString('hex') === rootHashHex;
  } catch { return false; }
}

function expectedDirections(index, size) {
  const directions = [];
  while (size > 1) {
    const k = split(size);
    if (index < k) {
      directions.push('right'); size = k;
    } else {
      directions.push('left'); index -= k; size -= k;
    }
  }
  return directions.reverse();
}

/** The checkpoint is a separate TRUST input; never trust the root in a proof. */
function verifyInclusion(rawLeaf, proof, checkpoint) {
  try {
    if (!validCheckpoint(checkpoint) || !proof || proof.version !== VERSION ||
        proof.treeSize !== checkpoint.treeSize || !Number.isSafeInteger(proof.leafIndex) ||
        proof.leafIndex < 0 || proof.leafIndex >= proof.treeSize ||
        !Array.isArray(proof.auditPath)) return false;
    const directions = expectedDirections(proof.leafIndex, proof.treeSize);
    if (directions.length !== proof.auditPath.length ||
        directions.some((d, i) => proof.auditPath[i]?.direction !== d)) return false;
    return verifyProof(rawLeaf, proof.auditPath, checkpoint.rootHash);
  } catch { return false; }
}

class MerkleEngine {
  #tree = null;
  #canonical = [];

  constructor(records = []) {
    if (!Array.isArray(records)) throw new TypeError('records must be an array');
    this.#canonical = records.map(canonicalize);
    this.#tree = buildNodes(this.#canonical.map(s => ({ size: 1, hash: leafFromCanonical(s) })));
  }
  get size() { return this.#canonical.length; }
  getRootHash() { return this.#tree ? this.#tree.hash.toString('hex') : EMPTY_ROOT; }
  checkpoint() { return { version: VERSION, treeSize: this.size, rootHash: this.getRootHash() }; }
  append(record) {
    const canonical = canonicalize(record); // Validate before changing state.
    if (this.size >= Number.MAX_SAFE_INTEGER) throw new RangeError('Tree too large');
    const next = appendNode(this.#tree, { size: 1, hash: leafFromCanonical(canonical) });
    const index = this.size;
    this.#canonical.push(canonical);
    this.#tree = next;
    return index;
  }
  getRecord(index) {
    this.#checkIndex(index);
    return JSON.parse(this.#canonical[index]); // Return an isolated copy.
  }
  #checkIndex(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError('Invalid leaf index');
    }
  }
  getProof(index) {
    this.#checkIndex(index);
    const path = [];
    function walk(node, i) {
      if (node.size === 1) return;
      if (i < node.left.size) {
        walk(node.left, i);
        path.push({ direction: 'right', hash: node.right.hash.toString('hex') });
      } else {
        walk(node.right, i - node.left.size);
        path.push({ direction: 'left', hash: node.left.hash.toString('hex') });
      }
    }
    walk(this.#tree, index);
    return { version: VERSION, leafIndex: index, treeSize: this.size, auditPath: path };
  }
  verifyProof(rawLeaf, auditPath, rootHashHex) { return verifyProof(rawLeaf, auditPath, rootHashHex); }
  verifyInclusion(rawLeaf, proof, checkpoint) { return verifyInclusion(rawLeaf, proof, checkpoint); }
  static verifyLedger(records, checkpoint) {
    try {
      if (!validCheckpoint(checkpoint) || !Array.isArray(records) || records.length !== checkpoint.treeSize) return false;
      return new MerkleEngine(records).getRootHash() === checkpoint.rootHash;
    } catch { return false; }
  }
}

module.exports = { MerkleEngine, canonicalize, hashLeaf, verifyProof, verifyInclusion, VERSION, EMPTY_ROOT };
