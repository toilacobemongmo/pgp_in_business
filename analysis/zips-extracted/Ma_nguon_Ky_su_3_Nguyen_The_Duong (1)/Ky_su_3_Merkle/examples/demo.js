'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { MerkleEngine, verifyInclusion } = require('../backend/merkle-engine');
const records = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1, timestamp: `2026-11-11T09:00:0${i}Z`, actor: 'Nguyen The Duong',
  action: ['CREATE_KEY', 'CERTIFY_KEY', 'SIGN_DOCUMENT', 'VERIFY_SIGNATURE', 'REVOKE_KEY'][i],
  resource: `sample-${i + 1}`, result: 'SUCCESS'
}));
const tree = new MerkleEngine(records);
// In production this checkpoint MUST come from a signed or protected independent store.
const trusted = tree.checkpoint();
const proof = tree.getProof(2);
const changed = { ...records[2], action: 'DELETE_DOCUMENT' };
const editedDatabase = JSON.parse(JSON.stringify(records)); editedDatabase[2] = changed;
const forgedTree = new MerkleEngine(editedDatabase);
const results = {
  originalRecordValid: verifyInclusion(records[2], proof, trusted),
  tamperedRecordValid: verifyInclusion(changed, proof, trusted),
  originalDatabaseValid: MerkleEngine.verifyLedger(records, trusted),
  editedDatabaseValid: MerkleEngine.verifyLedger(editedDatabase, trusted),
  deletedDatabaseValid: MerkleEngine.verifyLedger(records.slice(0, 4), trusted),
  reorderedDatabaseValid: MerkleEngine.verifyLedger([...records].reverse(), trusted),
  forgedProofAgainstTrustedRootValid: verifyInclusion(changed, forgedTree.getProof(2), trusted),
  forgedProofAgainstForgedRootValid: verifyInclusion(changed, forgedTree.getProof(2), forgedTree.checkpoint())
};
assert.deepEqual(Object.values(results), [true, false, true, false, false, false, false, true]);
const output = { checkpoint: trusted, record: records[2], proof, results,
  note: 'Last true is expected: trusting an attacker-controlled root defeats tamper detection.' };
const dir = path.join(__dirname, '..', 'results'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'demo-results.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
