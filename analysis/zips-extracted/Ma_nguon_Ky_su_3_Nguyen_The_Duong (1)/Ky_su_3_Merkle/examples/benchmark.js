'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { MerkleEngine, verifyInclusion } = require('../backend/merkle-engine');
const count = Number(process.argv[2] || 100000);
if (!Number.isSafeInteger(count) || count < 1 || count > 1000000) throw Error('Use 1..1000000 records');
const records = Array.from({ length: count }, (_, id) => ({ id, action: 'SIGN', resource: `doc-${id}`, result: 'SUCCESS' }));
const start = performance.now(); const tree = new MerkleEngine(records); const buildMs = performance.now() - start;
const index = Math.floor(count / 2), checkpoint = tree.checkpoint();
let t = performance.now(); const proof = tree.getProof(index); const proofMs = performance.now() - t;
for (let i = 0; i < 100; i++) verifyInclusion(records[index], proof, checkpoint);
t = performance.now();
for (let i = 0; i < 1000; i++) {
  if (!verifyInclusion(records[index], proof, checkpoint)) throw Error('Verification failed');
}
const verifyMeanMs = (performance.now() - t) / 1000;
t = performance.now(); tree.append({ id: count, action: 'SIGN', resource: `doc-${count}`, result: 'SUCCESS' });
const appendMs = performance.now() - t;
const out = { node: process.version, platform: `${process.platform}/${process.arch}`, cpu: os.cpus()[0]?.model,
  count, leafIndex: index, buildMs, proofMs, verifyMeanMs, verifyIterations: 1000, appendMs,
  proofHashes: proof.auditPath.length, hashPayloadBytes: proof.auditPath.length * 32,
  proofJsonBytes: Buffer.byteLength(JSON.stringify(proof)), rssMiB: process.memoryUsage().rss / 1024 / 1024,
  checkpoint, note: 'Single local run, warmed verification mean; timings depend on machine and load. RSS is a sample, not peak.' };
const dir = path.join(__dirname, '..', 'results'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'benchmark-results.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
