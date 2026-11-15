// Non-invasive probes against the repo modules (no data mutation, no server start).
import { ShamirSecretSharing } from '../backend/shamir-service.js';
import { MerkleTreeEngine } from '../backend/merkle-engine.js';
import { WebOfTrustAnalyzer } from '../backend/wot-analyzer.js';
import * as openpgp from 'openpgp';

const out = [];
const log = (s) => out.push(s);

// ---------- PROBE 1: Shamir round-trip + share format ----------
try {
  const secret = 'EnterpriseRootCAPassphrase@2026';
  const shares = ShamirSecretSharing.split(secret, 5, 3);
  const recovered3 = ShamirSecretSharing.combine(shares.slice(0, 3).map(s => s.shareKey));
  const recovered2 = (() => { try { return ShamirSecretSharing.combine(shares.slice(0, 2).map(s => s.shareKey)); } catch (e) { return 'THROWS: ' + e.message; } })();
  log('[P1] split/combine 3-of-5 round-trip OK      : ' + (recovered3 === secret));
  log('[P1] combine with only 2 shares               : ' + (typeof recovered2 === 'string' && recovered2.startsWith('THROWS') ? recovered2 : 'NOT BLOCKED -> ' + JSON.stringify(recovered2)));
  // Does a share string reveal the secret length?
  log('[P1] share string sample (truncated)          : ' + shares[0].shareKey.slice(0, 40) + '...  len=' + shares[0].shareKey.length);
  log('[P1] byte-length of secret recoverable from share: ' + ((shares[0].shareKey.split('-')[3].length) / 2) + ' bytes (secret is ' + Buffer.from(secret).length + ' bytes)');
  // Non-ASCII secret (multi-byte) round trip
  const uni = 'Khóa bí mật tiếng Việt ✓';
  const s2 = ShamirSecretSharing.split(uni, 3, 2);
  const r2 = ShamirSecretSharing.combine(s2.map(s => s.shareKey));
  log('[P1] non-ASCII secret round-trip              : ' + (r2 === uni));
} catch (e) { log('[P1] ERROR: ' + e.message); }

// ---------- PROBE 2: Merkle parity with RFC-style odd handling ----------
try {
  const logs = [{ id: 'a', action: 'X', actor: 'u', details: 'd', status: 'SUCCESS', timestamp: 't1' }];
  const t1 = MerkleTreeEngine.buildTree(logs);
  log('[P2] single-leaf tree: root == leaf?          : ' + (t1.root === MerkleTreeEngine.hashLeaf(logs[0])) + ' (this repo duplicates the leaf: H(01||leaf||leaf))');
  // Tamper detection
  const logs3 = [1, 2, 3].map(i => ({ id: 'l' + i, action: 'A' + i, actor: 'u', details: 'd', status: 'SUCCESS', timestamp: 't' + i }));
  const t3 = MerkleTreeEngine.buildTree(logs3);
  const p = MerkleTreeEngine.generateProof(logs3, 'l2');
  const good = MerkleTreeEngine.verifyProof(p.leafHash, p.proofPath, t3.root);
  const badLeaf = MerkleTreeEngine.hashLeaf({ ...logs3[1], details: 'TAMPERED' });
  const bad = MerkleTreeEngine.verifyProof(badLeaf, p.proofPath, t3.root);
  log('[P2] proof verify (untouched)                 : ' + JSON.stringify(good));
  log('[P2] proof verify (tampered leaf)             : ' + JSON.stringify(bad));
  log('[P2] proof object exposes merkleRoot/leafHash : ' + Object.keys(p).join(','));
} catch (e) { log('[P2] ERROR: ' + e.message); }

// ---------- PROBE 3: WoT trust path semantics in repo implementation ----------
try {
  // Chain A->B->C where A->B weight 0.9 and B->C weight 0.1, and a direct A->C weight 0.5
  const graph = {
    nodes: ['A', 'B', 'C', 'D'].map(id => ({ id, label: id, type: 'x', trustWeight: 1, status: 'active' })),
    edges: [
      { source: 'A', target: 'B', sourceName: 'A', targetName: 'B', relation: 'R', weight: 0.99, type: 't', valid: true },
      { source: 'B', target: 'C', sourceName: 'B', targetName: 'C', relation: 'R', weight: 0.01, type: 't', valid: true },
      { source: 'A', target: 'D', sourceName: 'A', targetName: 'D', relation: 'R', weight: 0.5, type: 't', valid: true },
      { source: 'D', target: 'C', sourceName: 'D', targetName: 'C', relation: 'R', weight: 0.5, type: 't', valid: true }
    ]
  };
  const r1 = WebOfTrustAnalyzer.findTrustPath(graph, 'A', 'C');
  log('[P3] path A->C chosen                         : ' + (r1.path || []).map(n => n.id).join('->') + ' trust=' + r1.aggregatedTrustScore + ' (0.99*0.01=0.0099 vs 0.5*0.5=0.25 expected winner)');
  const rev = WebOfTrustAnalyzer.findTrustPath({ nodes: graph.nodes, edges: [{ source: 'A', target: 'B', sourceName: 'A', targetName: 'B', relation: 'R', weight: 1, type: 't', valid: true }] }, 'B', 'A');
  log('[P3] reverse direction B->A found?            : ' + rev.found + ' (edges are directed; expected false)');
} catch (e) { log('[P3] ERROR: ' + e.message); }

// ---------- PROBE 4: Does repo's certify path really build a verifiable CA certification? ----------
try {
  const ca = await openpgp.generateKey({ type: 'ecc', userIDs: [{ name: 'CA', email: 'ca@example.org' }], passphrase: 'p' });
  const user = await openpgp.generateKey({ type: 'ecc', userIDs: [{ name: 'U', email: 'u@example.org' }] });
  const caPriv = await openpgp.decryptKey({ privateKey: await openpgp.readPrivateKey({ armoredKey: ca.privateKey }), passphrase: 'p' });
  const caPub = await openpgp.readKey({ armoredKey: ca.publicKey });
  const userPub = await openpgp.readKey({ armoredKey: user.publicKey });
  const certified = await userPub.signPrimaryUser([caPriv]);
  const verifs = await certified.verifyPrimaryUser([caPub]);
  log('[P4] CA certification verifies                : ' + verifs.some(v => v.valid === true));
  // Now: un-certified key must NOT verify
  const plain = await openpgp.readKey({ armoredKey: user.publicKey });
  const v2 = await plain.verifyPrimaryUser([caPub]);
  log('[P4] un-certified key rejected                : ' + !v2.some(v => v.valid === true));
} catch (e) { log('[P4] ERROR: ' + e.message); }

// ---------- PROBE 5: Signature verification is bound to content? ----------
try {
  const u = await openpgp.generateKey({ type: 'ecc', userIDs: [{ name: 'S', email: 's@example.org' }] });
  const priv = await openpgp.readPrivateKey({ armoredKey: u.privateKey });
  const pub = await openpgp.readKey({ armoredKey: u.publicKey });
  const msg = await openpgp.createMessage({ text: 'Hợp đồng 1 tỷ VND' });
  const sig = await openpgp.sign({ message: msg, signingKeys: priv, detached: true });
  const det = await openpgp.readSignature({ armoredSignature: sig });
  const ok = await openpgp.verify({ message: await openpgp.createMessage({ text: 'Hợp đồng 1 tỷ VND' }), signature: det, verificationKeys: pub });
  const bad = await openpgp.verify({ message: await openpgp.createMessage({ text: 'Hợp đồng 10 tỷ VND' }), signature: det, verificationKeys: pub });
  log('[P5] detached sig valid on same text          : ' + Boolean(await ok.signatures[0].verified) + '  (assert throws on tampered in openpgp v6)');
  let tamperedResult;
  try { tamperedResult = Boolean(await bad.signatures[0].verified); } catch (e) { tamperedResult = 'THROWS (' + e.message.slice(0, 60) + ')'; }
  log('[P5] detached sig on tampered text            : ' + tamperedResult);
} catch (e) { log('[P5] ERROR: ' + e.message); }

console.log(out.join('\n'));
