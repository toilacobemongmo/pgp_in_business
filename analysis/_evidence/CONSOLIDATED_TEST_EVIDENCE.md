# CONSOLIDATED TEST EVIDENCE — BTL PGP Report
**Session:** 2026-11-12  
**Purpose:** Thu thập bằng chứng test trước khi dispatch swarm workers viết báo cáo

---

## ✅ KS2 — Main Project Tests (6/6 PASS)

### 1. Smoke Test (21/21 PASS)
**Command:** `node tests/engineer2-api-smoke.mjs`  
**Elapsed:** 1.8s  
**Evidence:** `analysis/_evidence/ks2_smoke.txt`

Key assertions:
- CA SEALED/UNSEALED state machine
- Unseal with k=3 Shamir shards
- Issue certificate when UNSEALED → 200
- Issue when SEALED → 423 CA_SEALED
- Revoke → packet tag=2, signatureType=32 (keyRevocation)
- Seal → isSealed=true, subsequent issue → 423

### 2. Auth Test (PASS)
**Command:** `node tests/engineer2-api-auth.test.mjs`  
**Elapsed:** 3.54s

### 3. Quorum CA Test (PASS)
**Command:** `node tests/engineer2-quorum-ca.test.mjs`  
**Elapsed:** 0.13s

### 4. Quorum Shards Test (PASS)
**Command:** `node tests/engineer2-quorum-shards.test.mjs`  
**Elapsed:** 0.35s

### 5. Demo Key Gate Test (PASS)
**Command:** `node tests/engineer2-demo-key-gate.test.mjs`  
**Elapsed:** 0.65s

### 6. TTL Expiry Test (PASS)
**Command:** `node tests/engineer2-ttl-expiry.test.mjs`  
**Elapsed:** 2.53s

---

## ✅ KS3 — Merkle Audit Tree (PASS)

**Command:** `cd "analysis\zips-extracted\Ma_nguon_Ky_su_3_Nguyen_The_Duong (1)\Ky_su_3_Merkle" && node test/merkle-engine.test.js`  
**Elapsed:** 0.39s  
**Exit code:** 0

Kỹ sư 3 (Nguyễn Thế Dương) — MerkleTreeEngine verified.

---

## ✅ KS4 — Web of Trust (8/8 PASS)

**Command:** `cd analysis\tmp_wot_run\test && node wot-analyzer.test.js`  
**Elapsed:** 16.86ms  
**Exit code:** 0

Tests:
- ✔ maps all OpenPGP certification types
- ✔ handles empty graphs and parallel probability aggregation
- ✔ finds the maximum-capacity path with negative logarithmic costs and hop decay
- ✔ handles cycles without looping and enforces hop limits
- ✔ supports directed multi-edges and fragmented graphs
- ✔ rejects invalid probability and options
- ✔ identifies articulation points, including SPoF edge cases
- ✔ extracts node-disjoint independent paths and aggregates capacity

**Note:** Original KS4 test required `../backend/wot-analyzer` path; copied to `analysis/tmp_wot_run/{backend,test}/` for test execution.

---

## ✅ KS5 — OpenPGP Packet Inspector (7/7 PASS, structural only)

**Command:** `node analysis\ks5_verify\verify_packet_inspector.mjs`  
**Elapsed:** < 1s  
**Exit code:** 0

Verified capabilities:
- ✓ Dearmor PUBLIC KEY BLOCK
- ✓ Parse Public-Key/Subkey packets (tag 6, 14)
- ✓ Parse Signature packet (tag 2) with details object
- ✓ Handle clearsign text (may return 0 packets for ASCII-armored cleartext)
- ✓ Parse binary .pgp key files

**Limitations noted:**
- CRC24 validation logic: **chưa implement** (original demo used `gpg --list-packets` for validation)
- Truncation detection: **chưa implement**
- Weak hash flagging (SHA-1): **chưa có logic cảnh báo**

Inspector performs **structural parsing only**, not cryptographic validation. Original KS5 demo (`run-demo.js`) required `gpg` CLI for verification, which is not installed on this machine. The backend module [`backend/pgp-packet-inspector.js`](../../backend/pgp-packet-inspector.js:494) successfully parses packet structure per RFC 4880.

---

## 📊 Summary Table

| Engineer | Test Suite | Command | Exit Code | Status | Elapsed |
|----------|-----------|---------|-----------|--------|---------|
| KS2 | Smoke (21 assertions) | `node tests/engineer2-api-smoke.mjs` | 0 | ✅ PASS | 1.8s |
| KS2 | Auth | `node tests/engineer2-api-auth.test.mjs` | 0 | ✅ PASS | 3.54s |
| KS2 | Quorum CA | `node tests/engineer2-quorum-ca.test.mjs` | 0 | ✅ PASS | 0.13s |
| KS2 | Quorum Shards | `node tests/engineer2-quorum-shards.test.mjs` | 0 | ✅ PASS | 0.35s |
| KS2 | Demo Key Gate | `node tests/engineer2-demo-key-gate.test.mjs` | 0 | ✅ PASS | 0.65s |
| KS2 | TTL Expiry | `node tests/engineer2-ttl-expiry.test.mjs` | 0 | ✅ PASS | 2.53s |
| KS3 | Merkle Engine | `cd ... && node test/merkle-engine.test.js` | 0 | ✅ PASS | 0.39s |
| KS4 | WoT Analyzer (8 tests) | `cd analysis\tmp_wot_run\test && node wot-analyzer.test.js` | 0 | ✅ PASS | 16.86ms |
| KS5 | Packet Inspector (7 checks) | `node analysis\ks5_verify\verify_packet_inspector.mjs` | 0 | ✅ PASS | <1s |

**Total:** 9 test suites, all PASS (KS2: 6 suites; KS3/KS4/KS5: 1 suite each)

---

## 🔍 Code Grep Evidence (Pending)

Next step: Grep for:
1. WoT algorithm implementation in [`backend/wot-analyzer.js`](../../backend/wot-analyzer.js:123)
2. Auth backend guards in [`backend/auth.js`](../../backend/auth.js:1)
3. Private key plaintext status in [`backend/pgp-service.js`](../../backend/pgp-service.js:1) and [`backend/demo-mode.js`](../../backend/demo-mode.js:1)
4. Quorum shard file write in [`backend/quorum-shard-store.js`](../../backend/quorum-shard-store.js:50)

---

**Files referenced:**
- `analysis/_evidence/ks2_smoke.txt` (21 PASS assertions)
- `analysis/_evidence/test_summary.txt` (all KS2 tests)
- `analysis/_evidence/test_runs.json` (full test output JSON)
- `analysis/_evidence/ks5_verify.txt` (KS5 packet inspector output)
- `analysis/tmp_wot_run/test/wot-analyzer.test.js` (KS4 test run console output above)
