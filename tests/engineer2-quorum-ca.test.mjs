/**
 * KỸ SƯ 2 — Bộ kiểm thử Quorum & Shamir Envelope v2
 * ---------------------------------------------------
 * Chạy:  node tests/engineer2-quorum-ca.test.mjs
 * Exit:  0 = tất cả PASS, 1 = có ca FAIL.
 *
 * Phạm vi:
 *  - Nhóm S: ShamirSecretSharing (envelope v2, chống lộ độ dài, toàn vẹn, validation)
 *  - Nhóm C: Trạng thái SEALED/UNSEALED của Root CA (state machine, 423 Locked)
 *
 * Lưu ý về "chống lộ độ dài": payload được đệm theo khối 16 byte, nên hai bí mật
 * nằm trong CÙNG một khối sẽ có share dài bằng nhau; khác khối thì khác nhau.
 * Đây là bucketization, không phải "mọi độ dài đều bằng nhau" (xem ca S13).
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ShamirSecretSharing,
  ENVELOPE_BLOCK_SIZE,
  ENVELOPE_TAG_LEN,
  ENVELOPE_SESSION_TAG_LEN
} from '../backend/shamir-service.js';

// ---------------------------------------------------------------------------
// CÁCH LY DB (sửa lỗi test ghi bẩn dữ liệu thật):
// Nhóm C gọi PgpService.sealCA(), mà sealCA() ghi audit log qua store.
// Trước đây test này không đặt DB_FILE_OVERRIDE nên log "test-idempotent"
// bị ghi thẳng vào backend/data/db.json thật. Đặt override NGAY tại đây,
// trước khi pgp-service.js (và do đó store.js) được import động ở nhóm C.
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../backend/data');
const REAL_DB = path.join(DATA_DIR, 'db.json');
const TMP_DB = path.join(DATA_DIR, `db.quorum-ca.${process.pid}.json`);
// Seed the temp DB with a copy of the real one so caConfig is present.
// unsealCA() checks caConfig.privateKeyArmored before calling tryCombine;
// without this, C4/C5 hit the 409 "chưa khởi tạo" guard instead of the
// expected "Unseal thất bại" path.
if (fs.existsSync(REAL_DB)) {
  fs.copyFileSync(REAL_DB, TMP_DB);
}
process.env.DB_FILE_OVERRIDE = TMP_DB;

// Helper tính tag 16B giống hệt implementation (chỉ dùng để dựng ca S21)
function computeTag16(buf) {
  return crypto.createHash('sha256').update(buf).digest().subarray(0, ENVELOPE_TAG_LEN);
}

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

function throwsWith(name, fn, fragment) {
  try {
    fn();
    ok(name, false, 'không ném lỗi');
  } catch (e) {
    ok(name, fragment ? String(e.message).includes(fragment) : true, `message="${e.message}"`);
  }
}

async function rejectsWith(name, promiseFactory, fragment) {
  try {
    await promiseFactory();
    ok(name, false, 'không reject');
  } catch (e) {
    ok(name, fragment ? String(e.message).includes(fragment) : true, `message="${e.message}"`);
  }
}

// SHR-<k>OF<n>-<x>-<sessionTagHex>-<dataHex>  =>  dataHex là segment cuối
const payloadLenOf = (shareKey) => shareKey.split('-').pop().length;

// ============================================================
// NHÓM S — SHAMIR ENGINE
// ============================================================
function runShamirTests() {
  console.log('\n=== Nhóm S: ShamirSecretSharing (envelope v2) ===\n');

  // S1: round-trip ASCII
  {
    const shares = ShamirSecretSharing.split('hello-world-secret', 5, 3);
    eq('S1  số mảnh = n', shares.length, 5);
    const recovered = ShamirSecretSharing.combine(shares.slice(0, 3).map(s => s.shareKey));
    eq('S1  round-trip ASCII', recovered, 'hello-world-secret');
  }

  // S2: round-trip UTF-8 tiếng Việt
  {
    const secret = 'Nguyễn Văn An';
    const shares = ShamirSecretSharing.split(secret, 3, 2);
    const recovered = ShamirSecretSharing.combine([shares[0].shareKey, shares[2].shareKey]);
    eq('S2  round-trip UTF-8', recovered, secret);
  }

  // S3: đúng k mảnh bất kỳ đều khôi phục được
  {
    const secret = 'quorum-secret-2026';
    const shares = ShamirSecretSharing.split(secret, 5, 3);
    const combos = [[0, 1, 2], [0, 2, 4], [1, 3, 4], [2, 3, 4]];
    let allOk = true;
    for (const combo of combos) {
      const got = ShamirSecretSharing.combine(combo.map(i => shares[i].shareKey));
      if (got !== secret) allOk = false;
    }
    ok('S3  mọi tổ hợp đúng k=3 mảnh đều khôi phục đúng', allOk);
  }

  // S4: thứ tự mảnh không ảnh hưởng
  {
    const secret = 'order-independent';
    const shares = ShamirSecretSharing.split(secret, 5, 3);
    const a = ShamirSecretSharing.combine([shares[4].shareKey, shares[0].shareKey, shares[2].shareKey]);
    const b = ShamirSecretSharing.combine([shares[2].shareKey, shares[4].shareKey, shares[0].shareKey]);
    ok('S4  combine không phụ thuộc thứ tự đầu vào', a === secret && b === secret);
  }

  // S5: thiếu 1 mảnh (k-1) phải bị từ chối
  {
    const shares = ShamirSecretSharing.split('enough-shares', 5, 3);
    throwsWith('S5  k-1 mảnh bị từ chối', () => ShamirSecretSharing.combine([shares[0].shareKey, shares[1].shareKey]), 'Chưa đủ ngưỡng an toàn');
  }

  // S6: trùng mảnh không được vượt ngưỡng
  {
    const shares = ShamirSecretSharing.split('no-duplicates', 5, 3);
    throwsWith('S6  mảnh trùng x bị từ chối', () => ShamirSecretSharing.combine([shares[0].shareKey, shares[0].shareKey, shares[1].shareKey]), 'trùng');
  }

  // S7: trộn mảnh giữa 2 phiên khác nhau phải bị từ chối
  {
    const setA = ShamirSecretSharing.split('session-A', 5, 3);
    const setB = ShamirSecretSharing.split('session-B', 5, 3);
    throwsWith('S7  trộn mảnh giữa 2 phiên bị từ chối',
      () => ShamirSecretSharing.combine([setA[0].shareKey, setB[1].shareKey, setA[2].shareKey]),
      'phiên');
  }

  // S8: mảnh bị sửa 1 ký tự hex -> integrity tag phải phát hiện
  {
    const shares = ShamirSecretSharing.split('tamper-detection', 5, 3);
    const tampered = shares[0].shareKey.slice(0, -4) + (shares[0].shareKey.slice(-4) === '0000' ? '1111' : '0000');
    const res = ShamirSecretSharing.tryCombine([tampered, shares[1].shareKey, shares[2].shareKey]);
    ok('S8  tryCombine phát hiện mảnh bị sửa (ok=false)', res.ok === false, JSON.stringify(res));
  }

  // S9: envelope v2 có integrity tag
  {
    const shares = ShamirSecretSharing.split('tag-present', 3, 2);
    const parsed = ShamirSecretSharing.parseShare(shares[0].shareKey);
    ok('S9  share đánh dấu encoding envelope-v2', shares[0].encoding === 'envelope-v2');
    ok('S9  payload có độ dài là bội số của block', parsed.data.length % ENVELOPE_BLOCK_SIZE === 0,
      `len=${parsed.data.length} block=${ENVELOPE_BLOCK_SIZE}`);
    ok('S9  payload đủ chỗ cho tag', parsed.data.length >= ENVELOPE_TAG_LEN + ENVELOPE_SESSION_TAG_LEN + 6);
    ok('S9  share mang sessionTag 16 ký tự hex', typeof parsed.sessionTag === 'string' && parsed.sessionTag.length === 16,
      `sessionTag=${parsed.sessionTag}`);
  }

  // S10: version byte 0x02 chỉ quan sát được SAU khi nội suy f(0).
  // Byte đầu của từng share là f(x) với x != 0, không phải a0 = version byte.
  {
    const shares = ShamirSecretSharing.split('version-check', 3, 2);
    const parsed = shares.slice(0, 2).map((s) => ShamirSecretSharing.parseShare(s.shareKey));
    // Tái nội suy trực tiếp để lấy payload f(0), rồi kiểm tra version byte
    const recovered = ShamirSecretSharing.interpolateAtZero(parsed);
    eq('S10 version byte của envelope sau nội suy', recovered[0], 0x02);
    ok('S10 share riêng lẻ KHÔNG chứa plaintext version byte',
      ShamirSecretSharing.parseShare(shares[0].shareKey).data[0] !== 0x02 ||
      ShamirSecretSharing.parseShare(shares[1].shareKey).data[0] !== 0x02,
      'ít nhất một share phải khác 0x02 (ngụ ý đã được chia sẻ)');
  }

  // S11: bí mật rỗng bị từ chối
  throwsWith('S11 bí mật rỗng bị từ chối', () => ShamirSecretSharing.split('', 5, 3), 'rỗng');

  // S12: k > n bị từ chối
  throwsWith('S12 k > n bị từ chối', () => ShamirSecretSharing.split('abc', 3, 4), 'không thể lớn hơn');

  // S13: cùng khối 16 byte => share dài bằng nhau (bucketization)
  {
    // envelope: 1 (ver) + 4 (len) + secret + 16 (tag) = 21 + secret  -> block 16 
    // secret 1..11 byte -> tổng 22..32 -> 2 block = 32 byte
    const a = ShamirSecretSharing.split('a'.repeat(5), 3, 2)[0].shareKey;
    const b = ShamirSecretSharing.split('b'.repeat(11), 3, 2)[0].shareKey;
    eq('S13 cùng khối 16B -> share dài bằng nhau', payloadLenOf(a), payloadLenOf(b));
    // header v2 = 1 (version) + 8 (sessionTag) + 4 (length) = 13 byte
    // secret 5B -> 13+5+16 = 34 -> 3 block = 48 byte = 96 ký tự hex
    ok('S13 share dài = 3 block hex (96 ký tự)', payloadLenOf(a) === 96, `len=${payloadLenOf(a)}`);
  }

  // S14: khác khối => khác độ dài (hành vi mong đợi, không phải lỗi)
  {
    const small = ShamirSecretSharing.split('x'.repeat(5), 3, 2)[0].shareKey;
    const large = ShamirSecretSharing.split('x'.repeat(40), 3, 2)[0].shareKey;
    ok('S14 khác khối -> độ dài share khác nhau (bucket)', payloadLenOf(small) < payloadLenOf(large),
      `small=${payloadLenOf(small)} large=${payloadLenOf(large)}`);
    ok('S14 cả hai vẫn là bội số của block', payloadLenOf(small) % 32 === 0 && payloadLenOf(large) % 32 === 0);
  }

  // S15: ngoài phạm vi GF(256)
  throwsWith('S15 n > 255 bị từ chối', () => ShamirSecretSharing.split('abc', 256, 3), '255');

  // S16: k < 2
  throwsWith('S16 k < 2 bị từ chối', () => ShamirSecretSharing.split('abc', 5, 1), 'tối thiểu');

  // S17: chuỗi share không đúng định dạng
  throwsWith('S17 share sai định dạng bị từ chối', () => ShamirSecretSharing.parseShare('NOT-A-SHARE'), 'Định dạng mảnh khóa không hợp lệ');

  // S18: tryCombine trả cấu trúc {ok, secret}
  {
    const shares = ShamirSecretSharing.split('trycombine-shape', 5, 3);
    const res = ShamirSecretSharing.tryCombine(shares.slice(0, 3).map(s => s.shareKey));
    ok('S18 tryCombine ok=true', res.ok === true);
    eq('S18 tryCombine trả đúng secret', res.secret, 'trycombine-shape');
  }

  // S19: số nguyên hợp lệ (không nhận chuỗi không phải số)
  throwsWith('S19 n không phải số nguyên bị từ chối', () => ShamirSecretSharing.split('abc', 'x', 3), 'số nguyên');

  // S20: mảnh v1 (không có sessionTag) phải bị combine TỪ CHỐI
  //      => không còn nhánh fallback im lặng trả về dữ liệu rác như bí mật.
  {
    const legacyShare = (n, k, x, hex) => `SHR-${k}OF${n}-${x.toString(16).padStart(2, '0')}-${hex}`;
    const legacy = legacyShare(3, 2, 1, '48656c6c6f');
    const parsed = ShamirSecretSharing.parseShare(legacy);
    ok('S20 parseShare đọc được mảnh v1 nhưng sessionTag = null', parsed.sessionTag === null && parsed.x === 1);
    throwsWith('S20 combine từ chối mảnh v1 (không kiểm chứng được toàn vẹn)',
      () => ShamirSecretSharing.combine([legacy, legacyShare(3, 2, 2, '68656c6c6f')]),
      'định dạng cũ');
  }

  // S21: envelope rác (byte đầu không phải 0x02) phải NÉM LỖI, không trả rác
  {
    const shares = ShamirSecretSharing.split('no-silent-fallback', 3, 2);
    const parsed = ShamirSecretSharing.parseShare(shares[0].shareKey);
    // Hỏng byte đầu tiên của MỌI mảnh -> envelope sai phiên bản ở mọi mảnh
    const corrupt = shares.slice(0, 2).map((s) => {
      const d = Buffer.from(ShamirSecretSharing.parseShare(s.shareKey).data);
      // Ghi đè cùng một vị trí nhưng giữ hợp lệ bằng cách đổi version qua cả 2 mảnh
      d[0] = d[0] ^ 0xFF;
      const tag = computeTag16(d.subarray(0, d.length - ENVELOPE_TAG_LEN));
      tag.copy(d, d.length - ENVELOPE_TAG_LEN);
      const parts = s.shareKey.split('-');
      parts[parts.length - 1] = d.toString('hex');
      return parts.join('-');
    });
    // Ở đây tag được tính lại nên envelope tự nhất quán, chỉ sai version
    throwsWith('S21 envelope sai version bị từ chối chứ không trả rác',
      () => ShamirSecretSharing.combine(corrupt), 'envelope v2');
    ok('S21 parseShare vẫn đọc được payload (chỉ combine mới chặn)', parsed.data.length > 0);
  }
}

// ============================================================
// NHÓM C — CA SEAL / UNSEAL STATE MACHINE
// ============================================================
async function runCaStateTests() {
  console.log('\n=== Nhóm C: Root CA Seal / Unseal State Machine ===\n');

  // Import muộn để tránh side effect nặng nếu không cần
  let PgpService;
  try {
    ({ PgpService } = await import('../backend/pgp-service.js'));
  } catch (e) {
    ok('C0  import PgpService', false, e.message);
    return;
  }
  ok('C0  import PgpService thành công', typeof PgpService === 'function');

  // C1: mặc định phải SEALED
  {
    const state = PgpService.getSealState();
    ok('C1  Root CA mặc định ở trạng thái SEALED', state.isSealed === true, JSON.stringify(state));
    ok('C1  ttlMs là số dương', typeof state.ttlMs === 'number' && state.ttlMs > 0, String(state.ttlMs));
  }

  // C2: thao tác khi SEALED phải ném 423
  {
    try {
      PgpService.requireUnsealed();
      ok('C2  requireUnsealed ném lỗi khi SEALED', false);
    } catch (e) {
      eq('C2  statusCode = 423', e.statusCode, 423);
      eq('C2  code = CA_SEALED', e.code, 'CA_SEALED');
    }
  }

  // C3: _getOperatingCaKey cũng phải chặn
  {
    try {
      PgpService._getOperatingCaKey();
      ok('C3  _getOperatingCaKey chặn khi SEALED', false);
    } catch (e) {
      eq('C3  _getOperatingCaKey statusCode = 423', e.statusCode, 423);
    }
  }

  // C4: unsealCA với mảnh sai phải bị từ chối, không rò rỉ secret
  await rejectsWith('C4  unsealCA với mảnh rác bị từ chối',
    () => PgpService.unsealCA(['SHR-3OF5-01-deadbeef']), 'Unseal thất bại');

  // C5: unsealCA với mảng rỗng
  await rejectsWith('C5  unsealCA với mảng rỗng bị từ chối',
    () => PgpService.unsealCA([]), 'Unseal thất bại');

  // C6: sealCA idempotent — seal khi đang sealed không ném lỗi
  {
    let error = null;
    try {
      PgpService.sealCA('test-idempotent');
    } catch (e) {
      error = e;
    }
    ok('C6  sealCA idempotent khi đã SEALED', error === null, error && error.message);
    ok('C6  sau sealCA vẫn SEALED', PgpService.getSealState().isSealed === true);
  }

  // C7: sealCA xóa phiên RAM
  {
    const state = PgpService.getSealState();
    ok('C7  unsealedAt = null sau khi seal', state.unsealedAt === null);
    ok('C7  sealExpiresAt = null sau khi seal', state.expiresAt === null);
  }

  // C8: không có passphrase mặc định nào được nhúng trong mã nguồn
  {
    const fs = await import('fs');
    const src = fs.readFileSync(new URL('../backend/pgp-service.js', import.meta.url), 'utf-8');
    ok('C8  pgp-service.js không còn chuỗi passphrase mặc định',
      !src.includes('EnterpriseRootCAPassphrase') && !src.includes('CA_DEFAULT_PASSPHRASE'));
    ok('C8  pgp-service.js đọc passphrase từ biến môi trường',
      src.includes('CA_PASSPHRASE_ENV') && src.includes('process.env'));
  }

  // C9: TTL cấu hình được qua env
  {
    const fs = await import('fs');
    const src = fs.readFileSync(new URL('../backend/pgp-service.js', import.meta.url), 'utf-8');
    ok('C9  TTL đọc từ CA_UNSEAL_TTL_MS', src.includes('CA_UNSEAL_TTL_MS'));
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('============================================================');
  console.log(' KỸ SƯ 2 — KIỂM THỬ QUORUM ROOT CA & SHAMIR ENVELOPE v2');
  console.log('============================================================');

  try {
    runShamirTests();
    await runCaStateTests();
  } finally {
    // Dọn DB tạm (process.exit bên dưới sẽ bỏ qua finally, nên phải dọn ở đây)
    try { if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB); } catch (_) {}
  }

  console.log('\n============================================================');
  console.log(` KẾT QUẢ: ${passed} PASS / ${failed} FAIL / ${passed + failed} TOTAL`);
  console.log('============================================================');
  if (failed > 0) {
    console.log('\nCác ca thất bại:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Lỗi không mong đợi khi chạy test:', e);
  process.exit(1);
});
