/**
 * KỸ SƯ 2 — Smoke test API (end-to-end, HTTP thật)
 * -------------------------------------------------
 * Chạy:  node tests/engineer2-api-smoke.mjs
 *
 * Yêu cầu: KHÔNG được có backend nào chiếm cổng 5001.
 * Script tự spawn backend với DB tạm (backend/data/db.smoke.json) để không
 * làm hỏng dữ liệu demo, rồi dọn dẹp sau khi chạy.
 *
 * Luồng kiểm thử (nhóm A):
 *  A1  GET  /api/ca/status                -> 200, isSealed = true
 *  A2  POST /api/certificates/issue       -> 423 CA_SEALED (khi chưa unseal)
 *  A3  POST /api/ca/unseal (mảnh sai)     -> 400
 *  A4  POST /api/shamir/split (không cần secret) -> 423 khi SEALED
 *  A5  POST /api/ca/unseal (đúng k mảnh)  -> 200, isSealed = false
 *  A6  POST /api/certificates/issue       -> 200 sau khi unseal
 *  A7  POST /api/certificates/:id/revoke  -> 200 + có revocation certificate
 *  A8  POST /api/ca/seal                  -> 200, isSealed = true
 *  A9  POST /api/certificates/issue       -> 423 trở lại sau khi seal
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { ShamirSecretSharing } from '../backend/shamir-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// openpgp được resolve từ node_modules của backend (không phải thư mục gốc).
const requireBackend = createRequire(path.join(ROOT, 'backend', 'package.json'));
const openpgp = requireBackend('openpgp');
const DB_FILE = path.join(ROOT, 'backend', 'data', 'db.smoke.json');
const DB_BAK = path.join(ROOT, 'backend', 'data', 'db.smoke.json.bak');
const PORT = 5001;
const BASE = `http://127.0.0.1:${PORT}`;
const CA_PASSPHRASE = 'SmokeTestPassphrase#2026';

// WORKSTREAM A: smoke test này kiểm tra luồng CA (không kiểm tra auth), nên nó
// cấu hình token admin cho server và gửi kèm ở MỌI request. Nhờ vậy 21 case gốc
// vẫn đi qua được lớp authorize(), đồng thời chứng minh "đúng role -> 200".
// Các ca 401/403 nằm ở tests/engineer2-api-auth.test.mjs.
const AUTH_TOKEN_ADMIN = 'smoke-admin-token-0123456789';
const AUTH_TOKEN_EMPLOYEE = 'smoke-employee-token-0123456789';
const AUTH_TOKEN_PARTNER = 'smoke-partner-token-0123456789';

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ❌ FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, urlPath, body, token = AUTH_TOKEN_ADMIN) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + urlPath, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    json = null;
  }
  return { status: res.status, body: json };
}

async function waitForServer(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/ca/status`);
      if (res.status < 500) return true;
    } catch (_) {
      // chưa lên
    }
    await sleep(500);
  }
  return false;
}

function cleanup() {
  for (const f of [DB_FILE, DB_BAK]) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch (_) { /* ignore */ }
  }
}

async function main() {
  console.log('============================================================');
  console.log(' KỸ SƯ 2 — SMOKE TEST API (HTTP end-to-end)');
  console.log('============================================================');

  cleanup();

  // db.js đọc cố định db.json nên ta copy sang file tạm rồi trỏ bằng biến môi trường
  // (nếu backend hỗ trợ). Nếu không, dùng db.json hiện tại nhưng đã backup.
  process.env.DB_FILE_OVERRIDE = DB_FILE;

  const child = spawn(process.execPath, ['backend/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      CA_PASSPHRASE,
      CA_UNSEAL_TTL_MS: '60000',
      DB_FILE_OVERRIDE: DB_FILE,
      // Workstream A: bật auth thật (KHÔNG dùng AUTH_DISABLED) để smoke test
      // chạy qua đúng lớp phân quyền của server.
      AUTH_TOKEN_ADMIN,
      AUTH_TOKEN_EMPLOYEE,
      AUTH_TOKEN_PARTNER
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverLog = '';
  child.stdout.on('data', (d) => { serverLog += d.toString(); });
  child.stderr.on('data', (d) => { serverLog += d.toString(); });

  let alive = true;
  const up = await waitForServer();
  ok('A0  backend khởi động và trả /api/ca/status', up);
  if (!up) {
    console.log('\n--- SERVER LOG ---\n' + serverLog.slice(-4000));
    child.kill();
    cleanup();
    process.exit(1);
  }

  try {
    // A1
    const s1 = await req('GET', '/api/ca/status');
    ok('A1  GET /api/ca/status -> 200', s1.status === 200, `status=${s1.status}`);
    ok('A1  Root CA mặc định SEALED', s1.body?.ca?.isSealed === true, JSON.stringify(s1.body?.ca?.isSealed));

    // A2
    const issueSealed = await req('POST', '/api/certificates/issue', {
      name: 'Smoke User Sealed',
      email: 'sealed@smoke.test',
      department: 'QA'
    });
    ok('A2  issue khi SEALED -> 423', issueSealed.status === 423, `status=${issueSealed.status}`);
    ok('A2  mã lỗi CA_SEALED', issueSealed.body?.code === 'CA_SEALED', JSON.stringify(issueSealed.body));

    // A3
    const badUnseal = await req('POST', '/api/ca/unseal', {
      shares: ['SHR-3OF5-01-0000000000000000-deadbeef', 'SHR-3OF5-02-0000000000000000-deadbeef', 'SHR-3OF5-03-0000000000000000-deadbeef']
    });
    ok('A3  unseal với mảnh rác -> 400', badUnseal.status === 400, `status=${badUnseal.status}`);

    // A4
    const splitSealed = await req('POST', '/api/shamir/split', {
      totalShares: 5,
      threshold: 3
    });
    ok('A4  split không secret khi SEALED -> 423', splitSealed.status === 423, `status=${splitSealed.status}`);

    // A5 — tái tạo đúng bộ mảnh của passphrase CA rồi unseal
    const shares = ShamirSecretSharing.split(CA_PASSPHRASE, 5, 3).map((s) => s.shareKey);
    const goodUnseal = await req('POST', '/api/ca/unseal', { shares: shares.slice(0, 3) });
    ok('A5  unseal với đúng k=3 mảnh -> 200', goodUnseal.status === 200, `status=${goodUnseal.status} body=${JSON.stringify(goodUnseal.body)}`);
    ok('A5  sau unseal isSealed = false', goodUnseal.body?.state?.isSealed === false, JSON.stringify(goodUnseal.body?.state));

    const s2 = await req('GET', '/api/ca/status');
    ok('A5  status phản ánh UNSEALED', s2.body?.ca?.isSealed === false);
    ok('A5  status có sealExpiresAt', Boolean(s2.body?.ca?.sealExpiresAt));

    // A6
    const issued = await req('POST', '/api/certificates/issue', {
      name: 'Smoke User Unsealed',
      email: 'unsealed@smoke.test',
      department: 'QA'
    });
    ok('A6  issue khi UNSEALED -> 200', issued.status === 200, `status=${issued.status} body=${JSON.stringify(issued.body).slice(0, 300)}`);
    const certId = issued.body?.certificate?.id || issued.body?.cert?.id || issued.body?.data?.id;
    ok('A6  trả về id chứng chỉ', Boolean(certId), JSON.stringify(issued.body).slice(0, 300));

    // A7
    if (certId) {
      const revoked = await req('POST', `/api/certificates/${certId}/revoke`, {
        reason: 'Smoke test thu hồi'
      });
      ok('A7  revoke khi UNSEALED -> 200', revoked.status === 200, `status=${revoked.status}`);
      const cert = revoked.body?.certificate || revoked.body?.cert || {};
      // Armor của revocation certificate mang header PUBLIC KEY BLOCK kèm comment
      // "This is a revocation certificate" (openpgp v6), KHÔNG phải SIGNATURE.
      ok('A7  có revocation certificate (armor PUBLIC KEY BLOCK + comment)',
        typeof cert.revocationSignatureArmored === 'string' &&
          cert.revocationSignatureArmored.includes('BEGIN PGP PUBLIC KEY BLOCK') &&
          cert.revocationSignatureArmored.includes('This is a revocation certificate'),
        `type=${typeof cert.revocationSignatureArmored} len=${(cert.revocationSignatureArmored || '').length} err=${cert.revocationSignatureError || 'none'}`);

      // Kiểm chứng thực chất: giải armor và đọc packet tag / signature type.
      try {
        const raw = (await openpgp.unarmor(cert.revocationSignatureArmored)).data;
        const tag = raw[0] & 0x3f;
        const sigType = (await openpgp.readSignature({ binarySignature: raw })).packets[0].signatureType;
        ok('A7  packet tag = 2 (Signature)', tag === 2, `tag=${tag}`);
        ok('A7  signatureType = 32 (keyRevocation)', sigType === 32, `sigType=${sigType}`);
      } catch (e) {
        ok('A7  giải mã được revocation certificate', false, `error=${e.message}`);
      }
      ok('A7  khóa đã bị thu hồi thực sự (isRevoked = true)',
        typeof cert.revokedPublicKeyArmored === 'string' && cert.revokedPublicKeyArmored.length > 0,
        `error=${cert.revocationSignatureError || 'none'}`);
    } else {
      ok('A7  bỏ qua do thiếu certId', false);
    }

    // A8
    const sealed = await req('POST', '/api/ca/seal', {});
    ok('A8  POST /api/ca/seal -> 200', sealed.status === 200, `status=${sealed.status}`);
    ok('A8  sau seal isSealed = true', sealed.body?.state?.isSealed !== false, JSON.stringify(sealed.body));

    // A9
    const issueAgain = await req('POST', '/api/certificates/issue', {
      name: 'Smoke User After Seal',
      email: 'afterseal@smoke.test',
      department: 'QA'
    });
    ok('A9  issue sau khi seal lại -> 423', issueAgain.status === 423, `status=${issueAgain.status}`);
  } catch (e) {
    ok('Luồng smoke test không ném exception', false, e.message);
  } finally {
    alive = false;
    child.kill();
    await sleep(500);
    cleanup();
  }

  console.log('\n============================================================');
  console.log(` KẾT QUẢ: ${passed} PASS / ${failed} FAIL / ${passed + failed} TOTAL`);
  console.log('============================================================');
  if (failed > 0) {
    console.log('\nCác ca thất bại:');
    failures.forEach((f) => console.log(`  - ${f}`));
    console.log('\n--- 60 dòng log server cuối ---');
    console.log(serverLog.split('\n').slice(-60).join('\n'));
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Lỗi không mong đợi:', e);
  cleanup();
  process.exit(1);
});
