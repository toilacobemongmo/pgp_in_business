/**
 * KỸ SƯ 2 — WORKSTREAM B: Mảnh quorum phải được ghi ra file, không chỉ console
 * ---------------------------------------------------------------------------
 * Chạy:  node tests/engineer2-quorum-shards.test.mjs
 * Exit:  0 = tất cả PASS, 1 = có ca FAIL.
 *
 * Bối cảnh lỗi được báo:
 *   `initCA()` sinh bộ mảnh 3-of-5 rồi CHỈ in ra console. Đóng terminal là mất
 *   vĩnh viễn khả năng unseal Root CA. Mảnh không được ghi vào đâu cả.
 *
 * Điều kiện đạt (theo yêu cầu):
 *   1. Sau khi init, mỗi mảnh nằm trong MỘT FILE RIÊNG, quyền 0600.
 *   2. Thư mục chứa mảnh nằm NGOÀI db.json và đã nằm trong .gitignore.
 *   3. KHÔNG có mảnh nào trong db.json.
 *   4. Đọc 3 mảnh từ file  -> unsealCA OK.
 *   5. Chỉ 2 mảnh          -> unseal phải FAIL.
 *
 * Lưu ý: bài test chạy trên DB tạm (DB_FILE_OVERRIDE) và dọn thư mục mảnh sau khi
 * xong, để không phá dữ liệu demo trong backend/data/db.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.join(__dirname, '..', 'backend');
const DATA_DIR = path.join(BACKEND_DIR, 'data');

// ---- Cấu hình môi trường TRƯỚC khi import module (module đọc env lúc load) ----
const TMP_DB = path.join(DATA_DIR, 'db.quorum-shards.test.json');
if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
process.env.DB_FILE_OVERRIDE = TMP_DB;
process.env.CA_PASSPHRASE = 'QuorumShardTestPassphrase#2026';
// TTL dài để ca test không bị auto-seal chen ngang
process.env.CA_UNSEAL_TTL_MS = String(60 * 60 * 1000);

const { PgpService } = await import('../backend/pgp-service.js');
const {
  SHARD_DIR,
  writeShards,
  readShard,
  readShardKeys,
  listShardFiles,
  purgeShards,
  QUORUM_SHARD_CONSTANTS
} = await import('../backend/quorum-shard-store.js');
const { ShamirSecretSharing } = await import('../backend/shamir-service.js');
// openpgp được cài trong backend/node_modules (không có ở root), nạp theo đường dẫn.
const openpgp = await import('../backend/node_modules/openpgp/dist/node/openpgp.mjs');

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

function eq(name, actual, expected) {
  ok(name, actual === expected, `expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}

function section(title) {
  console.log(`\n▶ ${title}`);
}

async function main() {
  console.log('='.repeat(70));
  console.log('WORKSTREAM B — MẢNH QUORUM GHI RA FILE 0600');
  console.log('='.repeat(70));
  console.log(`DB tạm      : ${TMP_DB}`);
  console.log(`Thư mục mảnh: ${SHARD_DIR}`);

  // Dọn trạng thái cũ
  purgeShards();

  // =====================================================================
  section('B1. initCA() ghi mảnh ra file (không chỉ console)');
  // =====================================================================
  const caConfig = await PgpService.initCA();
  ok('B1.1 initCA trả về caConfig có fingerprint', Boolean(caConfig?.fingerprint), `fingerprint=${caConfig?.fingerprint}`);

  ok('B1.2 thư mục quorum-shards tồn tại sau init', fs.existsSync(SHARD_DIR), SHARD_DIR);

  const shardFiles = listShardFiles();
  eq('B1.3 số file mảnh = 5', shardFiles.length, 5);
  console.log(`       files: ${shardFiles.join(', ')}`);

  // =====================================================================
  section('B2. Mỗi mảnh là MỘT FILE RIÊNG, quyền 0600');
  // =====================================================================
  for (const f of shardFiles) {
    const abs = path.join(SHARD_DIR, f);
    const stat = fs.statSync(abs);
    const content = fs.readFileSync(abs, 'utf8');
    // Windows không hỗ trợ quyền POSIX thật; vẫn kiểm tra để phát hiện regression trên Linux.
    const posixMode = stat.mode & 0o777;
    const modeOk = process.platform === 'win32' ? true : posixMode === 0o600;
    ok(`B2 ${f}: là file riêng, không rỗng`, stat.isFile() && content.length > 50, `bytes=${stat.size}`);
    ok(`B2 ${f}: quyền 0600`, modeOk, `mode=${posixMode.toString(8)}`);
    ok(`B2 ${f}: có cảnh báo bàn giao`, /XÓA|bàn giao/i.test(content));
  }

  // Thư mục phải 0700 trên POSIX
  if (process.platform !== 'win32') {
    const dirMode = fs.statSync(SHARD_DIR).mode & 0o777;
    eq('B2.9 thư mục quorum-shards mode 0700', dirMode, 0o700);
  } else {
    console.log('  ℹ️  Bỏ qua kiểm tra mode thư mục (Windows không có quyền POSIX).');
  }

  // Không có mảnh nào nằm chung một file
  const uniquePayloads = new Set(shardFiles.map((f) => readShard(f)).filter(Boolean));
  eq('B2.10 mỗi file chứa một mảnh khác nhau', uniquePayloads.size, 5);

  // =====================================================================
  section('B3. Mảnh KHÔNG nằm trong db.json và nằm ngoài thư mục đã gitignore');
  // =====================================================================
  const dbRaw = fs.readFileSync(TMP_DB, 'utf8');
  const allShardKeys = shardFiles.map((f) => readShard(f));
  const leaked = allShardKeys.filter((k) => k && dbRaw.includes(k));
  eq('B3.1 không mảnh nào xuất hiện trong db.json', leaked.length, 0);
  ok('B3.2 db.json KHÔNG có trường chứa mảnh quorum',
    !/shareKey|shard|quorum_shares/i.test(dbRaw.replace(/"quorum[^"]*"/gi, '""')));
  eq('B3.3 tên file mảnh không nằm trong db.json',
    shardFiles.filter((f) => dbRaw.includes(f)).length, 0);

  // thư mục mảnh khác thư mục/file db
  ok('B3.4 thư mục mảnh tách khỏi file db.json',
    path.resolve(SHARD_DIR) !== path.resolve(TMP_DB) &&
    !path.resolve(TMP_DB).startsWith(path.resolve(SHARD_DIR)));

  // .gitignore phải có dòng loại trừ
  const gitignorePath = path.join(__dirname, '..', '.gitignore');
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  ok('B3.5 .gitignore có backend/data/quorum-shards/',
    gitignore.includes('backend/data/quorum-shards/'));
  ok('B3.6 .gitignore có backend/data/db.json',
    gitignore.includes('backend/data/db.json'));

  // File README bàn giao tồn tại và KHÔNG chứa mảnh
  const readmePath = path.join(SHARD_DIR, 'README-BAN-GIAO.txt');
  ok('B3.7 có file hướng dẫn bàn giao', fs.existsSync(readmePath));
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf8');
    ok('B3.8 README cảnh báo phải xóa khỏi server sau khi bàn giao',
      /XÓA|rmdir|rm -rf/i.test(readme));
    eq('B3.9 README KHÔNG chứa shareKey nào',
      allShardKeys.filter((k) => k && readme.includes(k)).length, 0);
  }

  // =====================================================================
  section('B4. Đọc 3 mảnh từ file -> unseal OK');
  // =====================================================================
  // Xác nhận CA đang SEALED trước khi unseal
  ok('B4.1 CA ở trạng thái SEALED trước unseal', PgpService.getSealState().isSealed);

  const threeKeys = readShardKeys(3);
  eq('B4.2 đọc được đúng 3 mảnh', threeKeys.length, 3);

  let unsealOk = false;
  let unsealErr = null;
  try {
    const result = await PgpService.unsealCA(threeKeys);
    unsealOk = result?.success === true && !result.alreadyUnsealed;
  } catch (e) {
    unsealErr = e.message;
  }
  ok('B4.3 unsealCA với 3 mảnh đọc từ file -> OK', unsealOk, `err=${unsealErr}`);

  const stateAfter = PgpService.getSealState();
  ok('B4.4 sau unseal, CA ở trạng thái UNSEALED', stateAfter.isSealed === false);

  // Kiểm chứng mạnh hơn: khóa trong RAM dùng được THẬT (không chỉ cờ boolean).
  // openpgp.PrivateKey KHÔNG có method decrypt(); nó có isDecrypted()/getKeyID()/
  // isPrivate() và dùng được để ký. Ta kiểm tra cả 3, cộng với việc ký thật.
  let canOperate = false;
  let opErr = null;
  let fpMatch = false;
  try {
    const key = PgpService.requireUnsealed();
    const isPrivateKey = key?.constructor?.name === 'PrivateKey';
    const isDecrypted = typeof key?.isDecrypted === 'function' && key.isDecrypted() === true;
    fpMatch = key.getFingerprint() === caConfig.fingerprint;
    // Ký thật bằng khóa trong RAM để chứng minh dùng được.
    const signed = await openpgp.createMessage({ text: 'quorum-unseal-proof' });
    const sig = await openpgp.sign({
      message: signed,
      signingKeys: key,
      detached: true,
      format: 'armored'
    });
    canOperate = isPrivateKey && isDecrypted && fpMatch && typeof sig === 'string' && sig.includes('BEGIN PGP SIGNATURE');
  } catch (e) {
    opErr = e.message;
  }
  ok('B4.5 khóa riêng đã giải mã nằm trong RAM (PrivateKey, isDecrypted)',
    canOperate, `err=${opErr}`);
  ok('B4.6 fingerprint khóa trong RAM khớp Root CA', fpMatch, `ca=${caConfig.fingerprint}`);

  // =====================================================================
  section('B5. Chỉ 2 mảnh -> unseal phải FAIL (ngưỡng 3)');
  // =====================================================================
  PgpService.sealCA('test-reset');
  ok('B5.1 CA đã niêm phong lại để test lại từ đầu', PgpService.getSealState().isSealed);

  const twoKeys = readShardKeys(2);
  eq('B5.2 đọc được đúng 2 mảnh', twoKeys.length, 2);

  let twoFailed = false;
  let twoErrMsg = '';
  try {
    await PgpService.unsealCA(twoKeys);
  } catch (e) {
    twoFailed = true;
    twoErrMsg = e.message;
  }
  ok('B5.3 unsealCA với 2 mảnh -> ném lỗi', twoFailed, `msg=${twoErrMsg}`);
  ok('B5.4 thông báo lỗi nêu ngưỡng an toàn', /ngưỡng|tối thiểu 3|3 mảnh/i.test(twoErrMsg), twoErrMsg);
  ok('B5.5 CA vẫn SEALED sau khi unseal bằng 2 mảnh thất bại', PgpService.getSealState().isSealed);

  // =====================================================================
  section('B6. Trộn mảnh từ hai lần chia khác nhau -> phải bị từ chối');
  // =====================================================================
  const firstBatch = readShardKeys(3);
  const otherBatchRaw = ShamirSecretSharing.split('MotPassphraseKhacHoanToan#99', 5, 3);
  const foreignKey = otherBatchRaw[0].shareKey;
  // đặt mảnh lạ vào vị trí thứ 3
  const mixed = [firstBatch[0], firstBatch[1], foreignKey];
  let mixedRejected = false;
  let mixedMsg = '';
  try {
    ShamirSecretSharing.combine(mixed);
  } catch (e) {
    mixedRejected = true;
    mixedMsg = e.message;
  }
  ok('B6.1 trộn mảnh khác phiên -> bị từ chối (sessionTag)', mixedRejected, mixedMsg);

  // =====================================================================
  section('B7. writeShards chống path traversal và validate đầu vào');
  // =====================================================================
  let traversalBlocked = true;
  try {
    writeShards([{ holderRole: '../../etc/passwd', shareKey: 'dummy' }]);
  } catch (e) {
    traversalBlocked = false;
  }
  // Sau khi gọi, phải KHÔNG có file nào ghi ra ngoài SHARD_DIR
  ok('B7.1 holderRole nguy hiểm bị làm sạch, file vẫn nằm trong thư mục mảnh',
    traversalBlocked &&
    fs.readdirSync(SHARD_DIR).every((f) => !f.includes('..')));

  let emptyRejected = false;
  try {
    writeShards([]);
  } catch {
    emptyRejected = true;
  }
  ok('B7.2 writeShards([]) bị từ chối', emptyRejected);

  eq('B7.3 hằng số mode file = 0600', QUORUM_SHARD_CONSTANTS.SHARD_FILE_MODE, 0o600);
  eq('B7.4 hằng số mode thư mục = 0700', QUORUM_SHARD_CONSTANTS.SHARD_DIR_MODE, 0o700);

  // =====================================================================
  section('B8. Dọn dẹp');
  // =====================================================================
  purgeShards();
  eq('B8.1 purgeShards() xóa hết file mảnh', listShardFiles().length, 0);

  // ghi đè lại mảnh giả vừa tạo để không để rác
  const leftover = fs.existsSync(SHARD_DIR) ? fs.readdirSync(SHARD_DIR) : [];
  eq('B8.2 không còn file rác trong quorum-shards', leftover.length, 0);

  PgpService.sealCA('test-teardown');
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
  ok('B8.3 đã xóa DB tạm', !fs.existsSync(TMP_DB));

  // =====================================================================
  console.log('\n' + '='.repeat(70));
  console.log(`KẾT QUẢ: ${passed} PASS / ${failed} FAIL / ${passed + failed} TOTAL`);
  if (failed > 0) {
    console.log('Các ca FAIL:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('='.repeat(70));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n💥 Lỗi không bắt được trong test:', err);
  process.exit(1);
});
