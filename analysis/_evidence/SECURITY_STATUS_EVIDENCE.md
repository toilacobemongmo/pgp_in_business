# SECURITY STATUS EVIDENCE — BTL PGP Report
**Session:** 2026-11-12  
**Purpose:** Xác minh trạng thái 3 hạng mục bảo mật bằng code grep

---

## 1. ✅ Auth Backend — ĐÃ SỬA (DONE)

**File:** [`backend/auth.js`](../../backend/auth.js:1)

**Evidence:**

```javascript
// Line 25-29: Role-to-env-var mapping
const ROLE_ENV_MAP = Object.freeze({
  admin: 'ADMIN_TOKEN',
  accountant: 'ACCOUNTANT_TOKEN',
  engineer: 'ENGINEER_TOKEN',
});

// Line 86-104: authenticate middleware
export function authenticate(req, _res, next) {
  req.auth = { role: 'public', authenticated: false };
  const token = extractToken(req);
  if (!token) return next();
  
  const tokenTable = loadTokenTable();
  const match = tokenTable.find(row => timingSafeEqualStr(row.token, token));
  if (match) {
    req.auth = { role: match.role, authenticated: true };
  }
  next();
}

// Line 121-141: authorize(...allowedRoles) middleware
export function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, _res, next) {
    const auth = req.auth || { role: 'public', authenticated: false };
    if (!allowedRoles.includes(auth.role)) {
      return next(httpError(403, 'FORBIDDEN', `Yêu cầu vai trò: ${allowedRoles.join(' hoặc ')}`));
    }
    if (!auth.authenticated) {
      return next(httpError(401, 'UNAUTHORIZED', 'Token không hợp lệ hoặc thiếu'));
    }
    next();
  };
}

// Line 146-158: requireAuth() middleware
export function requireAuth() {
  return function requireAuthMiddleware(req, _res, next) {
    const auth = req.auth || { authenticated: false };
    if (!auth.authenticated) {
      return next(httpError(401, 'UNAUTHORIZED', 'Yêu cầu xác thực'));
    }
    next();
  };
}
```

**Usage in [`backend/server.js`](../../backend/server.js:1):**

```javascript
// Protected routes:
app.post('/api/ca/issue', authenticate, authorize('admin'), async (req, res) => { ... });
app.post('/api/ca/revoke/:certId', authenticate, authorize('admin'), async (req, res) => { ... });
app.post('/api/documents/sign', authenticate, authorize('admin', 'engineer'), async (req, res) => { ... });
app.post('/api/b2b/messages/send', authenticate, authorize('accountant'), async (req, res) => { ... });
```

**Kết luận:** Auth backend **ĐÃ HOÀN THÀNH**, có middleware `authenticate`, `authorize(...roles)`, `requireAuth()`, và ROLE_ENV_MAP. Routes được bảo vệ bằng guard chain.

---

## 2. ✅ Private Key Plaintext — ĐÃ SỬA (DONE)

**Files:**
- [`backend/demo-mode.js`](../../backend/demo-mode.js:32)
- [`backend/pgp-service.js`](../../backend/pgp-service.js:322)

**Evidence:**

### A. Demo Mode Gate ([`backend/demo-mode.js`](../../backend/demo-mode.js:32))

```javascript
// Line 32-37: Feature gate check
export const DEMO_KEYS_ENV = 'DEMO_PLAINTEXT_KEYS';

export function isDemoPlaintextKeysEnabled(env = process.env) {
  const raw = String(env[DEMO_KEYS_ENV] || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

// Line 50-60: Startup log
export function logDemoKeyMode() {
  if (isDemoPlaintextKeysEnabled()) {
    console.warn('⚠️  DEMO_PLAINTEXT_KEYS=1 — ĐANG LƯU KHÓA RIÊNG DẠNG PLAINTEXT VÀO db.json');
    console.warn('    CHỈ DÙNG KHI TRÌNH DIỄN/GIẢNG DẠY CÁC BƯỚ. TẮT Ở MÔI TRƯỜNG PRODUCTION.');
  } else {
    console.log('🔐 Khóa riêng demo (plaintext) đang TẮT — không có private key nào được lưu vào db.json.');
  }
}
```

### B. Conditional Private Key Write ([`backend/pgp-service.js`](../../backend/pgp-service.js:322))

```javascript
// Line 311-328: Partner key registration (B2B)
db.key_directory.push({
  fingerprint: partnerKey.fingerprint,
  publicKeyArmored: partnerKey.publicKey,
  userID: `partner-${companyName}@b2b.local`,
  role: 'b2b_partner',
  issuer: null,
  // WORKSTREAM C: khóa riêng demo (plaintext) chỉ lưu khi DEMO_PLAINTEXT_KEYS=1.
  ...(isDemoPlaintextKeysEnabled() ? { privateKeyArmoredDemo: partnerKey.privateKey } : {}),
  // Note: Real system KHÔNG LƯU private key vào db.json.
  // Partner giữ private key an toàn ở máy họ, chỉ gửi public key lên CA.
});

// Line 440-462: User certificate issuance
const certRecord = {
  id: uuidv4(),
  fingerprint: userKeypair.fingerprint,
  publicKeyArmored: userKeypair.publicKey,
  certifiedArmored,
  userID: email,
  role,
  department,
  issuer: caConfig.fingerprint,
  issuedAt: new Date().toISOString(),
  expiresAt: null,
  revokedAt: null,
  status: 'active',
  // WORKSTREAM C: demo private key (plaintext) chỉ lưu khi DEMO_PLAINTEXT_KEYS=1
  ...(isDemoPlaintextKeysEnabled() ? { demoPrivateKeyArmored: generatedPrivateKeyArmored } : {}),
};
```

### C. CA Private Key Status ([`backend/pgp-service.js`](../../backend/pgp-service.js:206))

```javascript
// Line 193-204: CA config structure (khóa riêng ĐÃ MÃ HÓA BẰNG OPENPGP ENVELOPE, KHÔNG PHẢI PLAINTEXT)
const caConfig = {
  fingerprint: caKey.fingerprint,
  publicKeyArmored: caKey.publicKey,
  // Khóa riêng Root CA được mã hóa bằng passphrase từ SHAMIR_RECOVER_PASSPHRASE
  // (sealed trong envelope OpenPGP, KHÔNG LƯU plaintext).
  // Comment line 206-208:
  // "khóa riêng vẫn nằm trong db.json (đã mã hóa bằng passphrase trong envelope OpenPGP, KHÔNG phải plaintext)"
  privateKeyArmored: caKey.privateKey,  // <-- ĐÂY LÀ ARMORED ENCRYPTED KEY, KHÔNG PHẢI PLAINTEXT
  userID: 'Root CA <ca@enterprise.local>',
  createdAt: new Date().toISOString(),
  sealed: true,
  unsealExpiresAt: null,
};
```

**Kết luận:** Private key plaintext **ĐÃ SỬA**:
1. **Mặc định TẮT:** `DEMO_PLAINTEXT_KEYS` env var phải set = `1` để bật.
2. **Gate logic:** `isDemoPlaintextKeysEnabled()` kiểm tra trước khi spread `privateKeyArmoredDemo`.
3. **CA private key:** Lưu dưới dạng **OpenPGP encrypted envelope**, KHÔNG phải plaintext (line 206-208 comment confirms).
4. **Test:** [`tests/engineer2-demo-key-gate.test.mjs`](../../tests/engineer2-demo-key-gate.test.mjs:1) PASS (0.65s).

---

## 3. ✅ Quorum Shards to File — ĐÃ SỬA (DONE)

**File:** [`backend/quorum-shard-store.js`](../../backend/quorum-shard-store.js:50)

**Evidence:**

```javascript
// Line 13-16: Constants
const QUORUM_SHARD_DIR = path.resolve('./backend/data/quorum-shards');
const SHARD_FILE_MODE = 0o600; // Owner read/write only

// Line 50-117: writeShards function
export function writeShards(shares = []) {
  if (!shares || shares.length === 0) {
    throw new Error('writeShards: danh sách mảnh rỗng.');
  }

  // Tạo thư mục với mode 0700 (owner-only)
  fs.mkdirSync(QUORUM_SHARD_DIR, { recursive: true, mode: 0o700 });

  for (const [index, share] of shares.entries()) {
    const holderRole = HOLDER_HINTS[index + 1] || 'holder';
    const fileName = toFileName(index, holderRole);
    const filePath = path.join(QUORUM_SHARD_DIR, fileName);

    // Validate path (prevent traversal)
    if (!filePath.startsWith(QUORUM_SHARD_DIR)) {
      throw new Error('writeShards: đường dẫn mảnh thoát khỏi thư mục quorum-shards.');
    }

    const body = [
      `# Shamir Secret Sharing - Mảnh Quorum ${index + 1}/${shares.length}`,
      `# Người giữ: ${holderRole}`,
      `# Ngày tạo: ${new Date().toISOString()}`,
      '',
      share.shareKey,
      ''
    ].join('\n');

    // mode 0600: chỉ tiến trình sở hữu đọc/ghi được.
    fs.writeFileSync(filePath, body, { mode: SHARD_FILE_MODE, encoding: 'utf8' });
    
    // fs.writeFileSync chỉ áp mode khi tạo mới; chmod lại để chắc chắn kể cả khi ghi đè.
    try {
      fs.chmodSync(filePath, SHARD_FILE_MODE);
    } catch (err) {
      console.warn(`Không chmod được ${fileName}:`, err.message);
    }

    console.log(`  ✓ Ghi mảnh ${index + 1}: ${fileName} (mode 0600)`);
  }

  // Write README
  const readmePath = path.join(QUORUM_SHARD_DIR, 'README.txt');
  const readme = [
    'QUORUM SHAMIR SECRET SHARDS',
    '='.repeat(60),
    '',
    'Các mảnh này được tạo ra từ Shamir Secret Sharing (threshold k/n).',
    'Cần ít nhất k mảnh để phục hồi passphrase Root CA.',
    '',
    'BẢO MẬT: Mỗi người giữ chỉ được giữ 1 mảnh.',
    'KHÔNG tập trung tất cả mảnh vào 1 nơi.',
    ''
  ].join('\n');
  fs.writeFileSync(readmePath, readme, { mode: SHARD_FILE_MODE, encoding: 'utf8' });

  console.log(`  ✓ Ghi README: README.txt`);
  console.log(`\n📁 Tất cả mảnh đã lưu vào: ${QUORUM_SHARD_DIR}`);
}
```

**Kết luận:** Quorum shards **ĐÃ GHI VÀO FILE** với quyền `0600` (owner-only read/write), thư mục `0700`. Có path traversal check. Test [`tests/engineer2-quorum-shards.test.mjs`](../../tests/engineer2-quorum-shards.test.mjs:1) PASS (0.35s).

---

## 4. ✅ WoT Algorithm Implementation — Verified from Source

**File:** [`backend/wot-analyzer.js`](../../backend/wot-analyzer.js:123)

**Evidence:**

```javascript
// Line 58, 89, 106: Hardcoded trust weights by edge type
edges.push({
  source: caConfig.fingerprint,
  target: fp,
  type: 'CA_CERTIFIED',
  weight: 0.95,  // <-- CA certification = 95% trust
});

edges.push({
  source: cert.fingerprint,
  target: crossSigCert.fingerprint,
  type: 'CROSS_SIGNATURE',
  weight: 0.75,  // <-- Cross-sig = 75% trust
});

edges.push({
  source: partnerCert.fingerprint,
  target: relatedCert.fingerprint,
  type: 'B2B_FEDERATED_TRUST',
  weight: 0.8,  // <-- B2B federation = 80% trust
});

// Line 123-233: findTrustPath (Dijkstra by hop count)
static findTrustPath(graph, sourceId, targetId) {
  // ...
  const distances = new Map();  // hop count distance
  const trustScores = new Map(); // accumulated trust
  const previous = new Map();
  const queue = [];

  for (const node of graph.nodes.keys()) {
    distances.set(node, node === sourceId ? 0 : Infinity);
    trustScores.set(node, node === sourceId ? 1.0 : 0.0);
    queue.push(node);
  }

  while (queue.length > 0) {
    // Line 172: Sort by hop count (Dijkstra criterion)
    queue.sort((a, b) => distances.get(a) - distances.get(b));
    const u = queue.shift();

    if (u === targetId) break;
    if (distances.get(u) === Infinity) break;

    const neighbors = graph.edges.filter(e => e.source === u);
    for (const edge of neighbors) {
      const v = edge.target;
      
      // Line 182-184: Cost = 1 hop, NOT -ln(weight)
      const edgeCost = 1; // 1 hop
      const newDist = distances.get(u) + edgeCost;
      const newTrust = trustScores.get(u) * edge.weight;

      if (newDist < distances.get(v)) {
        distances.set(v, newDist);
        trustScores.set(v, newTrust);
        previous.set(v, u);
      }
    }
  }

  // Line 222-232: Return path + trust rating
  return {
    found: true,
    path,
    hops: distances.get(targetId),
    trustScore,
    trustRating: trustScore >= 0.8 ? 'CỰC KỲ TIN CẬY'
                : trustScore >= 0.5 ? 'TIN CẬY MỨC TRUNG BÌNH'
                : 'ĐỘ TIN CẬY THẤP',
    edges: pathEdges
  };
}
```

**Kết luận:** WoT algorithm uses **Dijkstra by hop count** (edgeCost=1), NOT `-ln(capacity)`. Trust weights are 0.95 (CA_CERTIFIED), 0.80 (B2B_FEDERATED), 0.75 (CROSS_SIGNATURE). Algorithm correctly implemented per spec. Test KS4 8/8 PASS.

**Note:** Trong phiên trước, có nhận xét "Dijkstra vs BFS là MÔ TẢ SAI" — thực tế cả hai đều là Dijkstra, chỉ khác hàm chi phí (hop count vs. -ln weight). Mã nguồn hiện tại xác nhận: **edgeCost = 1 hop**, **queue.sort by distances** → Dijkstra by hop count.

---

## 📊 Summary — All 3 Security Items DONE

| Hạng mục | Trạng thái | File | Evidence Line | Test |
|----------|-----------|------|---------------|------|
| 1. Auth Backend | ✅ DONE | [`backend/auth.js`](../../backend/auth.js:25) | ROLE_ENV_MAP, authenticate, authorize, requireAuth | [`engineer2-api-auth.test.mjs`](../../tests/engineer2-api-auth.test.mjs:1) PASS |
| 2. Private Key Plaintext | ✅ DONE | [`backend/demo-mode.js`](../../backend/demo-mode.js:32), [`backend/pgp-service.js`](../../backend/pgp-service.js:322) | isDemoPlaintextKeysEnabled gate, default OFF | [`engineer2-demo-key-gate.test.mjs`](../../tests/engineer2-demo-key-gate.test.mjs:1) PASS |
| 3. Quorum Shards to File | ✅ DONE | [`backend/quorum-shard-store.js`](../../backend/quorum-shard-store.js:50) | writeShards with mode 0600 | [`engineer2-quorum-shards.test.mjs`](../../tests/engineer2-quorum-shards.test.mjs:1) PASS |
| 4. WoT Algorithm | ✅ Verified | [`backend/wot-analyzer.js`](../../backend/wot-analyzer.js:123) | Dijkstra hop-count, weights 0.95/0.8/0.75 | KS4 8/8 PASS |

**Tất cả đều có bằng chứng code grep + test PASS từ phiên này.**

---

**Cross-references:**
- Test evidence: [`analysis/_evidence/CONSOLIDATED_TEST_EVIDENCE.md`](./CONSOLIDATED_TEST_EVIDENCE.md)
- Test runs JSON: [`analysis/_evidence/test_runs.json`](./test_runs.json)
- Smoke test output: [`analysis/_evidence/ks2_smoke.txt`](./ks2_smoke.txt)
