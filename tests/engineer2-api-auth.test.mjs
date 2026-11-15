/**
 * KỸ SƯ 2 — WORKSTREAM A: Kiểm thử XÁC THỰC & PHÂN QUYỀN (HTTP thật)
 * ------------------------------------------------------------------
 * Chạy:  node tests/engineer2-api-auth.test.mjs
 *
 * Yêu cầu: KHÔNG có backend nào chiếm cổng 5002.
 *
 * Mục tiêu: chứng minh phân quyền do MÁY CHỦ quyết định, không phải client.
 * Với từng nhóm route, kiểm tra 3 trạng thái:
 *   - KHÔNG token                -> 401 AUTH_REQUIRED
 *   - SAI role (token employee)  -> 403 FORBIDDEN
 *   - ĐÚNG role (token admin)    -> 200 (hoặc 423 nếu CA đang SEALED, vẫn là
 *                                   bằng chứng đã QUA được lớp phân quyền)
 *
 * Bổ sung:
 *   - /api/auth/whoami trả role theo token.
 *   - Route công khai (status, directory, documents/verify) -> 200 khi không token.
 *   - Token sai/không tồn tại -> 401, không bị nhầm thành "public".
 *   - AUTH_DISABLED=true -> mở toàn bộ (chỉ dùng demo cục bộ), có cảnh báo.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const DB_FILE = path.join(ROOT, 'backend', 'data', 'db.auth.json');
const DB_BAK = path.join(ROOT, 'backend', 'data', 'db.auth.json.bak');
const PORT = 5002;
const BASE = `http://127.0.0.1:${PORT}`;
const CA_PASSPHRASE = 'AuthTestPassphrase#2026';

const T_ADMIN = 'authtest-admin-token-0123456789';
const T_EMPLOYEE = 'authtest-employee-token-0123456789';
const T_PARTNER = 'authtest-partner-token-0123456789';

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  \u2705 PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \u274c FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, urlPath, body, token) {
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
  } catch {
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
    } catch {
      // server chưa lên
    }
    await sleep(400);
  }
  return false;
}

function cleanup() {
  for (const f of [DB_FILE, DB_BAK]) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch { /* ignore */ }
  }
}

function startServer(extraEnv = {}) {
  return spawn(process.execPath, ['backend/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      CA_PASSPHRASE,
      CA_UNSEAL_TTL_MS: '60000',
      DB_FILE_OVERRIDE: DB_FILE,
      AUTH_TOKEN_ADMIN: T_ADMIN,
      AUTH_TOKEN_EMPLOYEE: T_EMPLOYEE,
      AUTH_TOKEN_PARTNER: T_PARTNER,
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

/**
 * Kiểm tra bộ 3 trạng thái cho một route.
 * acceptedStatuses: các status được coi là "đã qua lớp phân quyền".
 * Với route cần CA mở, 423 CA_SEALED cũng là bằng chứng hợp lệ.
 */
async function assertGuarded(name, method, urlPath, body, acceptedStatuses = [200], wrongRole = 'employee') {
  const anon = await req(method, urlPath, body, null);
  ok(
    `${name} | không token -> 401`,
    anon.status === 401,
    `nhận ${anon.status} ${anon.body?.code || ''}`
  );
  ok(
    `${name} | không token -> code AUTH_REQUIRED`,
    anon.body?.code === 'AUTH_REQUIRED',
    `nhận code=${anon.body?.code}`
  );

  const wrongToken = wrongRole === 'partner' ? T_PARTNER : T_EMPLOYEE;
  const wrong = await req(method, urlPath, body, wrongToken);
  ok(
    `${name} | sai role (${wrongRole}) -> 403`,
    wrong.status === 403,
    `nhận ${wrong.status} ${wrong.body?.code || ''}`
  );
  ok(
    `${name} | sai role -> code FORBIDDEN`,
    wrong.body?.code === 'FORBIDDEN',
    `nhận code=${wrong.body?.code}`
  );

  const good = await req(method, urlPath, body, T_ADMIN);
  ok(
    `${name} | đúng role (admin) -> ${acceptedStatuses.join('|')}`,
    acceptedStatuses.includes(good.status),
    `nhận ${good.status} ${good.body?.code || ''}`
  );
}

async function main() {
  console.log('============================================================');
  console.log(' KỸ SƯ 2 — TEST XÁC THỰC & PHÂN QUYỀN (HTTP end-to-end)');
  console.log('============================================================');

  cleanup();

  const child = startServer();
  let serverLog = '';
  child.stdout.on('data', (d) => { serverLog += d.toString(); });
  child.stderr.on('data', (d) => { serverLog += d.toString(); });

  const up = await waitForServer();
  if (!up) {
    console.log('❌ Backend không khởi động được. Log:');
    console.log(serverLog.slice(-3000));
    cleanup();
    child.kill();
    process.exit(1);
  }

  try {
    // ---------- B1. whoami ----------
    console.log('\n[B1] /api/auth/whoami');
    const anonWho = await req('GET', '/api/auth/whoami');
    ok('B1.1 không token -> role public', anonWho.body?.role === 'public', JSON.stringify(anonWho.body));
    ok('B1.2 không token -> authenticated=false', anonWho.body?.authenticated === false);

    const adminWho = await req('GET', '/api/auth/whoami', null, T_ADMIN);
    ok('B1.3 token admin -> role admin', adminWho.body?.role === 'admin', JSON.stringify(adminWho.body));
    ok('B1.4 token admin -> authenticated=true', adminWho.body?.authenticated === true);

    const empWho = await req('GET', '/api/auth/whoami', null, T_EMPLOYEE);
    ok('B1.5 token employee -> role employee', empWho.body?.role === 'employee', JSON.stringify(empWho.body));

    const partWho = await req('GET', '/api/auth/whoami', null, T_PARTNER);
    ok('B1.6 token partner -> role partner', partWho.body?.role === 'partner', JSON.stringify(partWho.body));

    const bogusWho = await req('GET', '/api/auth/whoami', null, 'token-khong-ton-tai-0123456789');
    ok('B1.7 token rác -> KHÔNG được thành admin', bogusWho.body?.role === 'public', JSON.stringify(bogusWho.body));
    ok('B1.8 token rác -> authenticated=false', bogusWho.body?.authenticated === false);

    // Bypass kiểu gửi header giả
    const resXApi = await fetch(`${BASE}/api/auth/whoami`, { headers: { 'X-API-Key': T_ADMIN } });
    const xApiBody = await resXApi.json();
    ok('B1.9 X-API-Key cũng được nhận diện', xApiBody.role === 'admin', JSON.stringify(xApiBody));

    // ---------- B2. Route công khai ----------
    console.log('\n[B2] Route công khai (không cần token)');
    const st = await req('GET', '/api/ca/status');
    ok('B2.1 GET /api/ca/status -> 200', st.status === 200, `nhận ${st.status}`);
    ok('B2.2 status trả isSealed', typeof st.body?.ca?.isSealed === 'boolean', JSON.stringify(st.body?.ca));

    const dir = await req('GET', '/api/directory');
    ok('B2.3 GET /api/directory -> 200', dir.status === 200, `nhận ${dir.status}`);

    const verifyAnon = await req('POST', '/api/documents/verify', { signedContent: 'x' });
    ok(
      'B2.4 POST /api/documents/verify không token -> KHÔNG bị 401/403',
      verifyAnon.status !== 401 && verifyAnon.status !== 403,
      `nhận ${verifyAnon.status}`
    );

    // ---------- B3. Nhóm admin: certificates ----------
    console.log('\n[B3] Nhóm certificates');
    // GET /api/certificates cho phép admin + employee (employee cần đọc để ký).
    // => "sai role" phải dùng partner; employee là ca HỢP LỆ, kiểm tra riêng bên dưới.
    await assertGuarded('B3.1 GET  /api/certificates', 'GET', '/api/certificates', null, [200], 'partner');
    const certsEmp = await req('GET', '/api/certificates', null, T_EMPLOYEE);
    ok('B3.1b GET /api/certificates | employee -> 200 (đúng thiết kế)', certsEmp.status === 200, `nhận ${certsEmp.status}`);
    const certsPart = await req('GET', '/api/certificates', null, T_PARTNER);
    ok('B3.1c GET /api/certificates | partner -> 403 (không được xem hồ sơ nhân sự)', certsPart.status === 403, `nhận ${certsPart.status}`);
    await assertGuarded('B3.2 POST /api/certificates/issue', 'POST', '/api/certificates/issue', {
      name: 'Auth Test User', email: 'authtest@example.com', department: 'QA'
    }, [200, 423]);
    await assertGuarded('B3.3 POST /api/certificates/:id/revoke', 'POST', '/api/certificates/khong-ton-tai/revoke', {
      reason: 'test'
    }, [200, 400, 404, 423]);

    // ---------- B4. Nhóm admin: CA lifecycle ----------
    console.log('\n[B4] Nhóm CA lifecycle');
    await assertGuarded('B4.1 POST /api/ca/unseal', 'POST', '/api/ca/unseal', { shareKeys: ['bad'] }, [200, 400]);
    await assertGuarded('B4.2 POST /api/ca/seal', 'POST', '/api/ca/seal', {}, [200]);

    // ---------- B5. Shamir ----------
    console.log('\n[B5] Nhóm Shamir (admin only)');
    await assertGuarded('B5.1 POST /api/shamir/split', 'POST', '/api/shamir/split', {
      secret: 'test-secret', totalShares: 5, threshold: 3
    }, [200, 423]);
    await assertGuarded('B5.2 POST /api/shamir/recover', 'POST', '/api/shamir/recover', {
      shareKeys: ['bad']
    }, [200, 400, 423]);

    // ---------- B6. Merkle ----------
    console.log('\n[B6] Nhóm Merkle (admin only)');
    await assertGuarded('B6.1 GET  /api/merkle/status', 'GET', '/api/merkle/status');
    // logId không tồn tại -> service ném lỗi, route trả 400. Điều cần chứng minh
    // ở đây là đã QUA được lớp phân quyền, nên chấp nhận 200 hoặc 400.
    await assertGuarded('B6.2 GET  /api/merkle/proof/:logId', 'GET', '/api/merkle/proof/khong-ton-tai', null, [200, 400]);
    await assertGuarded('B6.3 POST /api/merkle/verify', 'POST', '/api/merkle/verify', {
      logId: 'x', proofPath: [], expectedRoot: 'x'
    }, [200, 400]);

    // ---------- B7. Directory write ----------
    console.log('\n[B7] Nhóm directory (ghi)');
    await assertGuarded('B7.1 DELETE /api/directory/:id', 'DELETE', '/api/directory/khong-ton-tai', null, [200, 404]);
    // import: admin + partner đều được → partner phải qua được, employee thì không.
    const impEmp = await req('POST', '/api/directory/import', {}, T_EMPLOYEE);
    ok('B7.2 POST /api/directory/import | employee -> 403', impEmp.status === 403, `nhận ${impEmp.status}`);
    const impAnon = await req('POST', '/api/directory/import', {}, null);
    ok('B7.3 POST /api/directory/import | không token -> 401', impAnon.status === 401, `nhận ${impAnon.status}`);

    // ---------- B8. Documents ----------
    console.log('\n[B8] Nhóm documents');
    const docAnon = await req('GET', '/api/documents', null, null);
    ok('B8.1 GET /api/documents | không token -> 401', docAnon.status === 401, `nhận ${docAnon.status}`);
    const docPart = await req('GET', '/api/documents', null, T_PARTNER);
    ok('B8.2 GET /api/documents | partner -> 200', docPart.status === 200, `nhận ${docPart.status}`);
    const docEmp = await req('GET', '/api/documents', null, T_EMPLOYEE);
    ok('B8.3 GET /api/documents | employee -> 200', docEmp.status === 200, `nhận ${docEmp.status}`);
    const signPart = await req('POST', '/api/documents/sign', { content: 'x' }, T_PARTNER);
    ok('B8.4 POST /api/documents/sign | partner -> 403', signPart.status === 403, `nhận ${signPart.status}`);
    const signAnon = await req('POST', '/api/documents/sign', { content: 'x' }, null);
    ok('B8.5 POST /api/documents/sign | không token -> 401', signAnon.status === 401, `nhận ${signAnon.status}`);

    // ---------- B9. Messages ----------
    console.log('\n[B9] Nhóm messages');
    const msgAnon = await req('GET', '/api/messages', null, null);
    ok('B9.1 GET /api/messages | không token -> 401', msgAnon.status === 401, `nhận ${msgAnon.status}`);
    const msgPart = await req('GET', '/api/messages', null, T_PARTNER);
    ok('B9.2 GET /api/messages | partner -> 200', msgPart.status === 200, `nhận ${msgPart.status}`);
    const decAnon = await req('POST', '/api/messages/decrypt', { messageId: 'x' }, null);
    ok('B9.3 POST /api/messages/decrypt | không token -> 401', decAnon.status === 401, `nhận ${decAnon.status}`);

    // ---------- B10. Audit logs ----------
    console.log('\n[B10] Nhóm audit logs');
    // audit-logs: admin + employee. "Sai role" hợp lệ để thử = partner.
    await assertGuarded('B10.1 GET /api/audit-logs', 'GET', '/api/audit-logs', null, [200], 'partner');
    const auditPart = await req('GET', '/api/audit-logs', null, T_PARTNER);
    ok('B10.2 GET /api/audit-logs | partner -> 403', auditPart.status === 403, `nhận ${auditPart.status}`);
    const auditEmp = await req('GET', '/api/audit-logs', null, T_EMPLOYEE);
    ok('B10.3 GET /api/audit-logs | employee -> 200 (đúng thiết kế)', auditEmp.status === 200, `nhận ${auditEmp.status}`);

    // ---------- B11. WoT + Inspector ----------
    console.log('\n[B11] Nhóm WoT & Inspector');
    // wot: admin + employee. "Sai role" hợp lệ để thử = partner.
    await assertGuarded('B11.1 GET  /api/wot/graph', 'GET', '/api/wot/graph', null, [200], 'partner');
    await assertGuarded('B11.2 POST /api/wot/path', 'POST', '/api/wot/path', { sourceId: 'a', targetId: 'b' }, [200, 400], 'partner');
    const inspAnon = await req('POST', '/api/inspector/analyze', { armoredText: 'x' }, null);
    ok('B11.3 POST /api/inspector/analyze | không token -> 401', inspAnon.status === 401, `nhận ${inspAnon.status}`);
    const inspPart = await req('POST', '/api/inspector/analyze', { armoredText: 'x' }, T_PARTNER);
    ok(
      'B11.4 POST /api/inspector/analyze | partner -> qua được phân quyền',
      inspPart.status !== 401 && inspPart.status !== 403,
      `nhận ${inspPart.status}`
    );

    // ---------- B12. 423 CA_SEALED vẫn trả đúng sau khi qua auth ----------
    console.log('\n[B12] 423 CA_SEALED khi đã qua lớp auth');
    const sealNow = await req('POST', '/api/ca/seal', {}, T_ADMIN);
    ok('B12.1 seal bằng admin -> 200', sealNow.status === 200, `nhận ${sealNow.status}`);
    const issueSealed = await req('POST', '/api/certificates/issue', {
      name: 'Sealed Test', email: 'sealed@example.com', department: 'QA'
    }, T_ADMIN);
    ok('B12.2 issue khi SEALED -> 423', issueSealed.status === 423, `nhận ${issueSealed.status}`);
    ok('B12.3 issue khi SEALED -> code CA_SEALED', issueSealed.body?.code === 'CA_SEALED', JSON.stringify(issueSealed.body));
    const issueSealedAnon = await req('POST', '/api/certificates/issue', {
      name: 'Sealed Test', email: 'sealed@example.com', department: 'QA'
    }, null);
    ok(
      'B12.4 issue khi SEALED + không token -> 401 (auth kiểm tra TRƯỚC state)',
      issueSealedAnon.status === 401,
      `nhận ${issueSealedAnon.status}`
    );

    // ---------- B13. Fail-closed khi server chưa cấu hình token ----------
    console.log('\n[B13] Fail-closed khi không cấu hình token nào');
    child.kill();
    await sleep(1500);
    cleanup();

    const child2 = startServer({
      AUTH_TOKEN_ADMIN: '',
      AUTH_TOKEN_EMPLOYEE: '',
      AUTH_TOKEN_PARTNER: ''
    });
    let log2 = '';
    child2.stdout.on('data', (d) => { log2 += d.toString(); });
    child2.stderr.on('data', (d) => { log2 += d.toString(); });

    const up2 = await waitForServer();
    ok('B13.1 server khởi động lại được', up2);

    if (up2) {
      const fo = await req('GET', '/api/certificates', null, null);
      ok('B13.2 không token nào được cấu hình -> 401 (fail-closed)', fo.status === 401, `nhận ${fo.status}`);
      const foAdmin = await req('GET', '/api/certificates', null, T_ADMIN);
      ok(
        'B13.3 token cũ không còn hiệu lực khi env rỗng -> 401',
        foAdmin.status === 401,
        `nhận ${foAdmin.status}`
      );
      const foStatus = await req('GET', '/api/ca/status');
      ok('B13.4 route công khai vẫn 200', foStatus.status === 200, `nhận ${foStatus.status}`);
    }

    child2.kill();
  } finally {
    try { child.kill(); } catch { /* ignore */ }
    await sleep(500);
    cleanup();
  }

  console.log('\n============================================================');
  console.log(` KẾT QUẢ: ${passed} PASS / ${failed} FAIL / ${passed + failed} TOTAL`);
  console.log('============================================================');
  if (failed > 0) {
    console.log('Các ca thất bại:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Lỗi không mong đợi:', err);
  cleanup();
  process.exit(1);
});
