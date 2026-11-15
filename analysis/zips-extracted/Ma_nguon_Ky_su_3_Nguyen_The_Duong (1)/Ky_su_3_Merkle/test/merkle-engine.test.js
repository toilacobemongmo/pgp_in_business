'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MerkleEngine, canonicalize, hashLeaf, verifyProof, verifyInclusion, EMPTY_ROOT } = require('../backend/merkle-engine');
const clone = x => JSON.parse(JSON.stringify(x));
const logs = n => Array.from({ length: n }, (_, id) => ({ id, action: 'SIGN', actor: 'Duong' }));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest();
// Separate, deliberately slow recursive oracle; it does not use production hash/tree helpers.
function referenceRoot(records) {
  if (!records.length) return digest(Buffer.alloc(0));
  if (records.length === 1) return digest(Buffer.concat([Buffer.from([0]), Buffer.from(canonicalize(records[0]))]));
  let k = 2 ** Math.floor(Math.log2(records.length));
  if (k === records.length) k /= 2;
  return digest(Buffer.concat([Buffer.from([1]), referenceRoot(records.slice(0, k)), referenceRoot(records.slice(k))]));
}

test('01 Empty tree: known SHA-256 vector and no proof', () => {
  const t = new MerkleEngine();
  assert.equal(EMPTY_ROOT, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(t.getRootHash(), EMPTY_ROOT);
  assert.equal(MerkleEngine.verifyLedger([], t.checkpoint()), true);
  assert.throws(() => t.getProof(0), RangeError);
});
test('02 One leaf: empty path and changed record fails', () => {
  const t = new MerkleEngine([{ x: 1 }]);
  assert.deepEqual(t.getProof(0).auditPath, []);
  assert.equal(verifyInclusion({ x: 1 }, t.getProof(0), t.checkpoint()), true);
  assert.equal(verifyInclusion({ x: 2 }, t.getProof(0), t.checkpoint()), false);
});
test('03 Nested objects and integer-like keys use UTF-16 lexical order', () => {
  assert.equal(canonicalize({ z: { b: 1, a: 2 }, '2': 2, '10': 10 }), '{"10":10,"2":2,"z":{"a":2,"b":1}}');
  assert.equal(hashLeaf({ b: 2, a: 1 }), hashLeaf({ a: 1, b: 2 }));
});
test('04 Unicode key sorting uses code units, not locale or code points', () => {
  const values = { '\ufb33': 7, '\u20ac': 3, '\r': 1, '\ud83d\ude00': 6, '1': 2, '\u0080': 4, '\u00f6': 5 };
  assert.equal(canonicalize(values), '{"\\r":1,"1":2,"\u0080":4,"ö":5,"€":3,"😀":6,"דּ":7}');
});
test('05 Finite number serialization and negative zero', () => {
  assert.equal(canonicalize([333333333.33333329, 1e30, 4.50, 2e-3, 1e-27, -0]), '[333333333.3333333,1e+30,4.5,0.002,1e-27,0]');
});
test('06 Strings preserve content; Unicode is not normalized', () => {
  assert.equal(canonicalize('a\n\t"\\'), '"a\\n\\t\\"\\\\"');
  assert.notEqual(hashLeaf('\u00e9'), hashLeaf('e\u0301'));
  assert.notEqual(hashLeaf('a b'), hashLeaf('ab'));
});
test('07 Reject invalid JSON values and lone surrogates', () => {
  for (const v of [NaN, Infinity, -Infinity, undefined, 1n, () => 1, Symbol(), '\ud800', '\udc00', { '\ud800': 1 }, [undefined]]) {
    assert.throws(() => canonicalize(v));
  }
});
test('08 Reject cycles, Date, getters, symbols, sparse and extended arrays', () => {
  const cycle = {}; cycle.self = cycle;
  const a = [1]; a.extra = 2;
  const b = []; b[1] = 2;
  for (const v of [cycle, new Date(), { get x() { throw Error('must not invoke getter'); } }, { [Symbol()]: 1 }, a, b]) {
    assert.throws(() => canonicalize(v));
  }
});
test('09 Array order matters; null-prototype objects and shared subobjects work', () => {
  assert.notEqual(hashLeaf([1, 2]), hashLeaf([2, 1]));
  const x = { a: 1 };
  assert.equal(canonicalize([x, x]), '[{"a":1},{"a":1}]');
  const n = Object.create(null); n.a = 1;
  assert.equal(canonicalize(n), '{"a":1}');
});
test('10 All roots and all leaves for sizes 1 to 128 match recursive oracle', () => {
  const records = logs(128), growing = new MerkleEngine();
  for (let size = 1; size <= records.length; size++) {
    growing.append(records[size - 1]);
    const current = records.slice(0, size), t = new MerkleEngine(current);
    assert.equal(t.getRootHash(), referenceRoot(current).toString('hex'));
    assert.equal(growing.getRootHash(), t.getRootHash());
    for (let i = 0; i < size; i++) {
      const proof = growing.getProof(i);
      assert.ok(verifyInclusion(records[i], proof, growing.checkpoint()));
      assert.ok(proof.auditPath.length <= Math.ceil(Math.log2(size)));
    }
  }
});
test('11 Five leaves split 4+1 without duplicating the last leaf', () => {
  const r = logs(5), t = new MerkleEngine(r);
  assert.deepEqual(t.getProof(4).auditPath, [{ direction: 'left', hash: new MerkleEngine(r.slice(0, 4)).getRootHash() }]);
  assert.notEqual(t.getRootHash(), new MerkleEngine([...r, r[4]]).getRootHash());
});
test('12 Changed content, sibling, root and direction are detected', () => {
  const r = logs(5), t = new MerkleEngine(r), p = t.getProof(1), c = t.checkpoint();
  assert.equal(verifyInclusion({ ...r[1], action: 'DELETE' }, p, c), false);
  const badHash = clone(p); badHash.auditPath[0].hash = '0'.repeat(64);
  assert.equal(verifyInclusion(r[1], badHash, c), false);
  const badDirection = clone(p); badDirection.auditPath[0].direction = 'right';
  assert.equal(verifyInclusion(r[1], badDirection, c), false);
  assert.equal(verifyInclusion(r[1], p, { ...c, rootHash: '0'.repeat(64) }), false);
});
test('13 Malformed hex, invalid direction and missing/extra path fail closed', () => {
  const r = logs(4), t = new MerkleEngine(r), p = t.getProof(0), c = t.checkpoint();
  for (const h of ['ab', 'g'.repeat(64), '00'.repeat(33), null]) {
    const q = clone(p); q.auditPath[0].hash = h;
    assert.equal(verifyInclusion(r[0], q, c), false);
  }
  const q = clone(p); q.auditPath[0].direction = 'up';
  assert.equal(verifyProof(r[0], q.auditPath, c.rootHash), false);
  for (const path of [p.auditPath.slice(1), [...p.auditPath, p.auditPath[0]], null]) {
    assert.equal(verifyInclusion(r[0], { ...p, auditPath: path }, c), false);
  }
});
test('14 Proof binds valid leaf index, tree size, version and trusted checkpoint', () => {
  const r = logs(5), t = new MerkleEngine(r), p = t.getProof(0), c = t.checkpoint();
  for (const patch of [{ leafIndex: -1 }, { leafIndex: 1 }, { leafIndex: 5 }, { leafIndex: 0.5 }, { treeSize: 6 }, { version: 'unknown' }]) {
    assert.equal(verifyInclusion(r[0], { ...p, ...patch }, c), false);
  }
  assert.equal(verifyInclusion(r[0], p, null), false);
  assert.equal(verifyInclusion(r[0], null, c), false);
});
test('15 Editing, deletion, insertion and reordering ledger fail old checkpoint', () => {
  const r = logs(5), c = new MerkleEngine(r).checkpoint();
  const edited = clone(r); edited[2].actor = 'Other';
  for (const changed of [edited, r.slice(1), [...r, r[0]], [...r].reverse()]) {
    assert.equal(MerkleEngine.verifyLedger(changed, c), false);
  }
  assert.equal(MerkleEngine.verifyLedger(r, c), true);
});
test('16 Caller mutations cannot alter internal records, proof or checkpoint', () => {
  const r = logs(3), t = new MerkleEngine(r), root = t.getRootHash();
  r[0].id = 99; t.getRecord(1).id = 99;
  t.getProof(0).auditPath[0].hash = '0'.repeat(64); t.checkpoint().rootHash = '0'.repeat(64);
  assert.equal(t.getRootHash(), root);
  assert.equal(t.getRecord(0).id, 0);
  assert.equal(t.getRecord(1).id, 1);
});
test('17 Invalid append is atomic and invalid indexes throw', () => {
  const t = new MerkleEngine(logs(3)), old = t.checkpoint();
  assert.throws(() => t.append({ bad: undefined }));
  assert.deepEqual(t.checkpoint(), old);
  for (const i of [-1, 3, NaN, '1', 0.5]) assert.throws(() => t.getProof(i));
});
test('18 Old proofs require old checkpoints after append', () => {
  const r = logs(3), t = new MerkleEngine(r), p = t.getProof(1), c = t.checkpoint();
  assert.equal(t.append({ id: 3 }), 3);
  assert.equal(verifyInclusion(r[1], p, c), true);
  assert.equal(verifyInclusion(r[1], p, t.checkpoint()), false);
  assert.equal(verifyInclusion(r[1], t.getProof(1), t.checkpoint()), true);
});
test('19 Legacy verifyProof API remains callable from instance and export', () => {
  const r = logs(3), t = new MerkleEngine(r), p = t.getProof(2);
  assert.ok(t.verifyProof(r[2], p.auditPath, t.getRootHash()));
  assert.ok(verifyProof(r[2], p.auditPath, t.getRootHash()));
});
test('20 Demonstrate trust boundary: recomputed malicious root is not evidence', () => {
  const old = new MerkleEngine(logs(3)).checkpoint(), altered = logs(3); altered[1].actor = 'Attacker';
  const fake = new MerkleEngine(altered), proof = fake.getProof(1);
  assert.equal(verifyInclusion(altered[1], proof, old), false);
  assert.equal(verifyInclusion(altered[1], proof, fake.checkpoint()), true);
});
