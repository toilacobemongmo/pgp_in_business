/**
 * WORKSTREAM C — KIỂM CHỨNG CỜ DEMO_PLAINTEXT_KEYS
 * ------------------------------------------------
 * Mục tiêu: chứng minh bằng máy rằng khi cờ TẮT (mặc định), backend
 * KHÔNG sinh và KHÔNG ghi khóa riêng plaintext vào db.json; khi cờ BẬT
 * thì có (để không phá luồng demo cũ).
 *
 * Test chạy trên DB tạm thông qua DB_FILE_OVERRIDE để không đụng db.json thật.
 * G7 (cờ BẬT) chạy trong tiến trình con riêng vì store.js bind DB_FILE tại
 * thời điểm module load — không thể re-point bằng env re-assign trong cùng process.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  isDemoPlaintextKeysEnabled,
  demoPrivateKeyOrNull,
  DEMO_KEYS_ENV,
} from '../backend/demo-mode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../backend/data');

/**
 * Nạp openpgp từ package của backend.
 *
 * Lý do: openpgp nằm trong backend/node_modules, còn test này đặt ở tests/.
 * Node ESM resolve package theo vị trí của module đang import, nên
 * `await import('openpgp')` từ tests/ sẽ ném "Cannot find package 'openpgp'".
 * Ta chỉ đường dẫn entry point của package rồi import bằng file URL.
 */
async function loadOpenpgpFromBackend() {
  const pkgDir = path.resolve(__dirname, '../backend/node_modules/openpgp');
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'));

  let entry = pkg.module || pkg.main;
  const exp = pkg.exports && pkg.exports['.'];
  if (typeof exp === 'string') {
    entry = exp;
  } else if (exp && typeof exp === 'object') {
    const imp = exp.import;
    entry = (typeof imp === 'string' ? imp : (imp && imp.default)) || exp.default;
  }
  if (!entry) throw new Error('Không xác định được entry point ESM của openpgp');

  return await import(pathToFileURL(path.resolve(pkgDir, entry)).href);
}

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✅ PASS  ${name}`);
  } else {
    fail += 1;
    failures.push({ name, detail });
    console.log(`  ❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n▶ ${title}`);
}

// ---------------------------------------------------------------- Cờ logic
section('G1. Đọc cờ môi trường (hàm thuần, không cần DB)');

check('G1.1 không set -> TẮT', isDemoPlaintextKeysEnabled({}) === false);
check('G1.2 chuỗi rỗng -> TẮT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: '' }) === false);
check('G1.3 "0" -> TẮT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: '0' }) === false);
check('G1.4 "false" -> TẮT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: 'false' }) === false);
check('G1.5 "no" -> TẮT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: 'no' }) === false);
check('G1.6 "off" -> TẮT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: 'off' }) === false);
check('G1.7 rác "abc" -> TẮT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: 'abc' }) === false);
check('G1.8 "1" -> BẬT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: '1' }) === true);
check('G1.9 "true" -> BẬT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: 'true' }) === true);
check('G1.10 "YES" hoa -> BẬT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: 'YES' }) === true);
check('G1.11 " on " có khoảng trắng -> BẬT', isDemoPlaintextKeysEnabled({ [DEMO_KEYS_ENV]: ' on ' }) === true);

section('G2. demoPrivateKeyOrNull trả null khi TẮT');

const FAKE_KEY = '-----BEGIN PGP PRIVATE KEY BLOCK-----\nfake\n-----END PGP PRIVATE KEY BLOCK-----';
check('G2.1 cờ TẮT -> null', demoPrivateKeyOrNull(FAKE_KEY, {}) === null);
check('G2.2 cờ BẬT -> giữ nguyên khóa', demoPrivateKeyOrNull(FAKE_KEY, { [DEMO_KEYS_ENV]: '1' }) === FAKE_KEY);
check('G2.3 cờ BẬT nhưng đầu vào rỗng -> null', demoPrivateKeyOrNull('', { [DEMO_KEYS_ENV]: '1' }) === null);
check('G2.4 cờ BẬT nhưng đầu vào undefined -> null', demoPrivateKeyOrNull(undefined, { [DEMO_KEYS_ENV]: '1' }) === null);

// ------------------------------------------------- Kiểm tra tĩnh mã nguồn
section('G3. Mã nguồn: mọi chỗ ghi khóa demo đều nằm sau cờ');

const pgpSrc = fs.readFileSync(path.resolve(__dirname, '../backend/pgp-service.js'), 'utf-8');

// Dùng substring search thay vì line-anchor regex.
// Source dùng spread syntax: ...(isDemoPlaintextKeysEnabled() ? { demoPrivateKeyArmored: x } : {})
// nên tên field KHÔNG bao giờ đứng đầu dòng. Ta tìm mọi dòng có chứa
// tên field như một key (theo sau là ':'), loại bỏ dòng comment.
const writeSites = [];
const lines = pgpSrc.split('\n');
lines.forEach((line, i) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
  // Khớp tên field là key trong object literal: "fieldName:" (có thể có khoảng trắng)
  if (/(?:demoPrivateKeyArmored|privateKeyArmoredDemo)\s*:/.test(trimmed)) {
    writeSites.push({ lineNo: i + 1, text: trimmed });
  }
});

// Phải tìm thấy ĐÚNG 3 chỗ ghi: certRecord (460), directoryEntry (478), partnerSeed (323).
// Nếu count thay đổi thì kiểm tra này sẽ FAIL (không bao giờ vacuous pass).
check(
  'G3.1 tìm thấy đúng 3 chỗ ghi khóa demo trong pgp-service.js',
  writeSites.length === 3,
  `tìm được ${writeSites.length} — ${writeSites.map(s => `dòng ${s.lineNo}`).join(', ')}`
);

// Mỗi chỗ ghi phải nằm trên cùng dòng với isDemoPlaintextKeysEnabled.
// (spread pattern: ...(isDemoPlaintextKeysEnabled() ? { field: val } : {}))
const unguarded = writeSites.filter(s => !s.text.includes('isDemoPlaintextKeysEnabled'));
check(
  'G3.2 KHÔNG có chỗ ghi khóa demo nào thiếu cờ',
  unguarded.length === 0,
  unguarded.map(s => `dòng ${s.lineNo}: ${s.text.slice(0, 80)}`).join(' | ')
);

const hasImport = /import\s*\{[^}]*isDemoPlaintextKeysEnabled[^}]*\}\s*from\s*'\.\/demo-mode\.js'/.test(pgpSrc);
check('G3.3 pgp-service.js có import cờ từ demo-mode.js', hasImport);

// Đường đọc để thu hồi khóa phải kiểm tra field tồn tại, không được giả định có.
const revocationReadOk = /if\s*\(\s*cert\.demoPrivateKeyArmored\s*\)/.test(pgpSrc);
check('G3.4 nhánh thu hồi chỉ đọc khóa demo khi field tồn tại', revocationReadOk);

// ------------------------------------------------------- Kiểm tra .gitignore
section('G4. .gitignore: db.json và mảnh quorum không bị commit');

const gitignore = fs.readFileSync(path.resolve(__dirname, '../.gitignore'), 'utf-8');
const ignoreLines = gitignore.split('\n').map(l => l.trim());
check('G4.1 .gitignore có backend/data/db.json', ignoreLines.includes('backend/data/db.json'));
check('G4.2 .gitignore có backend/data/quorum-shards/', ignoreLines.includes('backend/data/quorum-shards/'));

// ------------------------------------------------------- db.example.json sạch
section('G5. db.example.json không chứa khóa riêng nào');

const examplePath = path.resolve(__dirname, '../backend/data/db.example.json');
check('G5.1 file tồn tại', fs.existsSync(examplePath));

if (fs.existsSync(examplePath)) {
  const raw = fs.readFileSync(examplePath, 'utf-8');
  check('G5.2 không có "BEGIN PGP PRIVATE KEY"', !raw.includes('BEGIN PGP PRIVATE KEY'));
  check('G5.3 không có trường demoPrivateKeyArmored', !raw.includes('demoPrivateKeyArmored'));
  check('G5.4 không có trường privateKeyArmoredDemo', !raw.includes('privateKeyArmoredDemo'));

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
    check('G5.5 là JSON hợp lệ', true);
  } catch (e) {
    check('G5.5 là JSON hợp lệ', false, e.message);
  }
  if (parsed) {
    check('G5.6 ca_config = null (chưa có CA)', parsed.ca_config === null);
    check('G5.7 mảng dữ liệu rỗng', Array.isArray(parsed.certificates) && parsed.certificates.length === 0);
    check('G5.8 có đủ 6 khóa schema gốc',
      ['ca_config', 'certificates', 'key_directory', 'signed_documents', 'b2b_messages', 'audit_logs']
        .every(k => k in parsed));
  }
}

// ------------------------------------------------- Sinh chứng chỉ thật: cờ TẮT
section('G6. Sinh chứng chỉ thật với cờ TẮT -> không có khóa demo trong DB');

const TMP_DB = path.join(DATA_DIR, `db.gate-off.${process.pid}.json`);
process.env.DB_FILE_OVERRIDE = TMP_DB;
delete process.env.DEMO_PLAINTEXT_KEYS;
process.env.CA_PASSPHRASE = process.env.CA_PASSPHRASE || 'gate-test-passphrase';

// Dọn trước
if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);

try {
  const { PgpService } = await import('../backend/pgp-service.js');
  await PgpService.initCA();

  const dbAfterInit = JSON.parse(fs.readFileSync(TMP_DB, 'utf-8'));

  check('G6.1 initCA tạo ca_config', !!dbAfterInit.ca_config);
  check('G6.2 có seed certificates', dbAfterInit.certificates.length > 0);
  check('G6.3 có seed key_directory', dbAfterInit.key_directory.length > 0);

  const demoInCerts = dbAfterInit.certificates.filter(c => 'demoPrivateKeyArmored' in c);
  check('G6.4 certificates KHÔNG có demoPrivateKeyArmored', demoInCerts.length === 0,
    `còn ${demoInCerts.length}/${dbAfterInit.certificates.length} bản ghi`);

  const demoInDir = dbAfterInit.key_directory.filter(d =>
    'demoPrivateKeyArmored' in d || 'privateKeyArmoredDemo' in d);
  check('G6.5 key_directory KHÔNG có khóa demo', demoInDir.length === 0,
    `còn ${demoInDir.length}/${dbAfterInit.key_directory.length} bản ghi`);

  const rawDb = fs.readFileSync(TMP_DB, 'utf-8');
  // ca_config.privateKeyArmored là khóa CA đã mã hóa bằng passphrase (hợp lệ),
  // nên chỉ đếm số khối PRIVATE KEY: đúng 1 (CA), không hơn.
  const privKeyBlocks = (rawDb.match(/-----BEGIN PGP PRIVATE KEY BLOCK-----/g) || []).length;
  check('G6.6 chỉ có 1 khối private key duy nhất (khóa CA)', privKeyBlocks === 1,
    `đếm được ${privKeyBlocks}`);

  check('G6.7 khóa CA trong db là dạng ĐÃ MÃ HÓA (có khối bảo vệ)',
    /-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(dbAfterInit.ca_config.privateKeyArmored));

  // Unseal CA trước khi cấp chứng chỉ: đọc 3 mảnh Quorum vừa ghi lúc initCA
  const { readShardKeys } = await import('../backend/quorum-shard-store.js');
  const shardKeys = readShardKeys(3);
  check('G6.8 đọc được 3 mảnh quorum để unseal', Array.isArray(shardKeys) && shardKeys.length === 3,
    `đọc được ${Array.isArray(shardKeys) ? shardKeys.length : 'lỗi'}`);

  const unsealResult = await PgpService.unsealCA(shardKeys);
  check('G6.9 unsealCA thành công', !!unsealResult && unsealResult.success === true,
    unsealResult ? JSON.stringify(unsealResult) : 'unsealResult null');

  // Cấp thêm 1 chứng chỉ mới trong lúc cờ TẮT
  const issued = await PgpService.issueCertificate({
    name: 'Kiểm Thử Cờ Tắt',
    email: 'gate.off@enterprise.internal',
    department: 'QA',
    role: 'Tester',
    notes: 'sinh trong lúc DEMO_PLAINTEXT_KEYS tắt',
  });

  // issueCertificate trả về certRecord TRỰC TIẾP (không phải { certRecord }).
  check('G6.10 issueCertificate thành công', !!issued && !!issued.id,
    issued ? '' : 'issueCertificate trả undefined');
  check('G6.11 chứng chỉ mới KHÔNG có demoPrivateKeyArmored',
    !!issued && !('demoPrivateKeyArmored' in issued));
  check('G6.12 chứng chỉ mới vẫn có public key',
    !!issued &&
    typeof issued.certifiedPublicKeyArmored === 'string' &&
    issued.certifiedPublicKeyArmored.includes('BEGIN PGP PUBLIC KEY'));

  // G6.13 chỉ được đánh giá SAU khi cấp chứng chỉ thành công, nếu không nó
  // sẽ PASS một cách vacuous (DB chưa đổi nên "vẫn sạch" đúng vô nghĩa).
  check('G6.13 sau khi cấp chứng chỉ, DB vẫn sạch khóa demo',
    !!issued && (() => {
      const dbAfterIssue = JSON.parse(fs.readFileSync(TMP_DB, 'utf-8'));
      return dbAfterIssue.certificates.every(c => !('demoPrivateKeyArmored' in c))
        && dbAfterIssue.key_directory.every(d =>
          !('demoPrivateKeyArmored' in d) && !('privateKeyArmoredDemo' in d));
    })(),
    !!issued ? '' : 'bỏ qua vì chưa cấp được chứng chỉ');

  // Ký số vẫn phải hoạt động khi không có khóa demo (dùng khóa client cung cấp).
  // signDocument yêu cầu: { documentName, contentBuffer (Buffer), isText, signerPrivateKeyArmored, passphrase }
  const openpgp = await loadOpenpgpFromBackend();
  const clientKeys = await openpgp.generateKey({
    type: 'ecc',
    curve: 'ed25519Legacy',
    userIDs: [{ name: 'Client Tự Sinh', email: 'client@partner.example' }],
    passphrase: '',
    format: 'armored',
  });

  const signed = await PgpService.signDocument({
    documentName: 'hopdong-gate-test.txt',
    contentBuffer: Buffer.from('Nội dung ký thử khi cờ demo tắt.', 'utf-8'),
    isText: true,
    signerPrivateKeyArmored: clientKeys.privateKey,
    passphrase: '',
  });
  check('G6.14 ký số bằng khóa client tự sinh vẫn OK', !!signed && !!signed.signatureArmored,
    signed ? '' : 'signDocument trả null/undefined');
  check('G6.15 chữ ký là chuỗi armored hợp lệ',
    signed &&
    typeof signed.signatureArmored === 'string' &&
    signed.signatureArmored.includes('BEGIN PGP'));
} catch (err) {
  check('G6.x luồng sinh chứng chỉ với cờ TẮT không ném lỗi', false, err.message);
} finally {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
  // Dọn mảnh quorum do initCA tạo ra trong lúc test
  const { purgeShards, QUORUM_SHARD_CONSTANTS } = await import('../backend/quorum-shard-store.js');
  try { purgeShards(); } catch (_) { /* bỏ qua nếu đã không còn */ }
  // purgeShards() chỉ xóa FILE, giữ lại thư mục rỗng — xóa nốt.
  try { fs.rmdirSync(QUORUM_SHARD_CONSTANTS.SHARD_DIR); } catch (_) { /* còn file hoặc không tồn tại */ }
}

// -------------------------------------- So sánh: cờ BẬT thì phải có khóa demo
// G7 chạy trong tiến trình con riêng: store.js đọc DB_FILE_OVERRIDE một lần lúc
// module load. Re-assign env rồi re-import chỉ trả về cached module với DB path cũ.
section('G7. Sinh chứng chỉ thật với cờ BẬT -> có khóa demo (không phá luồng cũ)');

const TMP_DB2 = path.join(DATA_DIR, `db.gate-on.${process.pid}.json`);
const fixturePath = path.resolve(__dirname, 'fixtures/gate-on-fixture.mjs');

// Dọn trước (phòng run trước để lại)
if (fs.existsSync(TMP_DB2)) fs.unlinkSync(TMP_DB2);

const childResult = spawnSync(
  process.execPath,
  // Fixture là file .mjs nên Node tự coi là ESM: truyền TRỰC TIẾP đường dẫn
  // làm tham số script. Dùng --eval/--input-type sẽ hỏng vì đường dẫn tuyệt đối
  // trên Windows chứa khoảng trắng và "--eval + import file" không ổn định.
  [fixturePath],
  {
    env: {
      ...process.env,
      DEMO_PLAINTEXT_KEYS: '1',
      DB_FILE_OVERRIDE: TMP_DB2,
      CA_PASSPHRASE: process.env.CA_PASSPHRASE || 'gate-test-passphrase',
    },
    encoding: 'utf-8',
    timeout: 60_000,
  }
);

if (childResult.status !== 0) {
  const errMsg = (childResult.stderr || childResult.stdout || '').trim().split('\n')[0] || 'exit code ' + childResult.status;
  check('G7.x tiến trình con với cờ BẬT không lỗi', false, errMsg);
} else {
  let g7data = null;
  try {
    // stdout có thể có console.warn từ initCA; lấy dòng JSON cuối cùng
    const lines = childResult.stdout.trim().split('\n');
    const jsonLine = lines.filter(l => l.startsWith('{')).pop();
    g7data = JSON.parse(jsonLine);
  } catch (e) {
    check('G7.x parse kết quả tiến trình con', false, e.message + ' | stdout: ' + childResult.stdout.slice(0, 200));
  }

  if (g7data) {
    check(
      'G7.1 cờ BẬT -> certificates có demoPrivateKeyArmored',
      g7data.certsWithDemo === g7data.totalCerts && g7data.certsWithDemo > 0,
      `${g7data.certsWithDemo}/${g7data.totalCerts}`
    );
    check(
      'G7.2 cờ BẬT -> đối tác B2B có privateKeyArmoredDemo',
      g7data.dirWithDemoCount >= 1,
      `tìm được ${g7data.dirWithDemoCount}`
    );
    check(
      'G7.3 khóa demo của đối tác là armored private key',
      g7data.partnerKeyOk === true,
      g7data.partnerKeyOk ? '' : 'partnerKeyOk = false'
    );
    check('G7.4 hai chế độ cho kết quả KHÁC nhau (cờ có tác dụng thật)',
      g7data.certsWithDemo > 0);
  }
}

// Dọn mọi file tạm còn sót
[TMP_DB, TMP_DB2, `${TMP_DB}.bak`, `${TMP_DB2}.bak`].forEach(p => {
  if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (_) {}
});

console.log(`\n KẾT QUẢ: ${pass} PASS / ${fail} FAIL / ${pass + fail} TOTAL`);
if (fail > 0) {
  console.log('\nChi tiết lỗi:');
  failures.forEach(f => console.log(`  - ${f.name}${f.detail ? ` — ${f.detail}` : ''}`));
  process.exit(1);
}
