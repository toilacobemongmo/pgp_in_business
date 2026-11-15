/**
 * Workstream E — TTL-expiry test for CA_UNSEAL_TTL_MS
 *
 * Verifies that after `CA_UNSEAL_TTL_MS` milliseconds the CA session is
 * considered sealed (via getSealState()) even though the auto-seal
 * setTimeout may not have fired yet, and that requireUnsealed() throws
 * a 423 error once the TTL window has elapsed.
 *
 * Key design decisions:
 *  - TTL set to 2000 ms so the test completes quickly.
 *  - Uses the same env-var-before-import pattern as engineer2-quorum-shards.test.mjs
 *    because UNSEAL_TTL_MS is captured at module load time (pgp-service.js line 19).
 *  - Copies the real db.json (which already has ca_config) to a temp DB so
 *    unsealCA() finds caConfig.privateKeyArmored (the 409 guard).
 *  - Cleans up shards + temp DB in a finally block.
 *
 * Run:  node tests/engineer2-ttl-expiry.test.mjs
 * Expected: ALL PASS, 0 FAIL
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── paths ────────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'backend', 'data');
const REAL_DB  = path.join(DATA_DIR, 'db.json');
const TMP_DB   = path.join(DATA_DIR, `db.ttl-expiry.${process.pid}.json`);

// ── test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(label, cond) {
  if (cond) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL  ${label}`);
    failed++;
  }
}

function eq(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ PASS  ${label}  (= ${JSON.stringify(actual)})`);
    passed++;
  } else {
    console.error(`  ❌ FAIL  ${label}  expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
    failed++;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  // ── setup: env vars BEFORE any import of pgp-service ─────────────────────
  // These are captured at module-load time; they MUST be set first.
  const TTL_MS = 2000; // 2 seconds — short enough for a fast test

  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);

  // Start from an EMPTY temp DB and let initCA() create a fresh CA + write the
  // 5 quorum shards. We deliberately do NOT copy the real db.json: the real
  // DB may have ca_config without shard files on disk (the shard test's
  // teardown calls purgeShards()), and initCA() returns early when ca_config
  // already exists — so a copied DB would leave us with 0 shard files.

  process.env.DB_FILE_OVERRIDE   = TMP_DB;
  process.env.CA_PASSPHRASE      = process.env.CA_PASSPHRASE || 'TTLExpiry#TestPass2026';
  process.env.CA_UNSEAL_TTL_MS   = String(TTL_MS);

  // ── dynamic imports (AFTER env vars) ────────────────────────────────────
  const { PgpService }                                        = await import('../backend/pgp-service.js');
  const { readShardKeys, purgeShards, listShardFiles }        = await import('../backend/quorum-shard-store.js');

  try {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  Workstream E — TTL-expiry test  (CA_UNSEAL_TTL_MS = 2 s)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ── E1: pre-condition: CA starts sealed ─────────────────────────────────
    console.log('── E1  Pre-condition ─────────────────────────────────────────');
    const stateBefore = PgpService.getSealState();
    ok('E1.1 CA bắt đầu ở trạng thái SEALED', stateBefore.isSealed === true);
    eq('E1.2 ttlMs đọc được từ getSealState() = 2000', stateBefore.ttlMs, TTL_MS);

    // ── E2: initCA() sinh CA mới + ghi 5 mảnh shard ra đĩa ──────────────────
    console.log('\n── E2  initCA() + đọc mảnh Shamir từ file ───────────────────');
    const caConfig = await PgpService.initCA();
    ok('E2.0 initCA() trả về caConfig có publicKeyArmored',
       typeof caConfig?.publicKeyArmored === 'string' && caConfig.publicKeyArmored.length > 0);

    const shardFiles = listShardFiles();
    eq('E2.1 số file mảnh trên disk = 5', shardFiles.length, 5);

    let threeKeys;
    try {
      threeKeys = readShardKeys(3);
      ok('E2.2 readShardKeys(3) thành công', true);
      eq('E2.3 lấy được đúng 3 share key', threeKeys.length, 3);
    } catch (err) {
      ok(`E2.2 readShardKeys(3) thất bại — ${err.message}`, false);
      ok('E2.3 (skipped)', false);
      throw err; // abort: cannot unseal without shards
    }

    // ── E3: unseal ───────────────────────────────────────────────────────────
    console.log('\n── E3  Unseal với 3 mảnh ────────────────────────────────────');
    const unsealResult = await PgpService.unsealCA(threeKeys);
    ok('E3.1 unsealCA trả về success = true',      unsealResult?.success === true);
    ok('E3.2 alreadyUnsealed = false',             unsealResult?.alreadyUnsealed === false);

    const stateAfterUnseal = PgpService.getSealState();
    ok('E3.3 isSealed = false ngay sau unseal',    stateAfterUnseal.isSealed === false);
    ok('E3.4 unsealedAt được đặt',                 stateAfterUnseal.unsealedAt !== null);
    ok('E3.5 expiresAt được đặt',                  stateAfterUnseal.expiresAt !== null);

    // sanity: expiresAt is roughly TTL_MS in the future
    const expiresAtMs  = new Date(stateAfterUnseal.expiresAt).getTime();
    const nowMs        = Date.now();
    const remaining    = expiresAtMs - nowMs;
    ok('E3.6 thời gian còn lại trong TTL (> 0 ms)', remaining > 0);
    ok('E3.7 thời gian còn lại trong TTL (<= TTL_MS)', remaining <= TTL_MS);
    console.log(`       (remaining ≈ ${remaining} ms)`);

    // ── E4: requireUnsealed() should succeed while session is live ────────
    console.log('\n── E4  requireUnsealed() trong cửa sổ TTL ───────────────────');
    let noThrowWhileLive = false;
    try {
      PgpService.requireUnsealed();
      noThrowWhileLive = true;
    } catch (_) {
      noThrowWhileLive = false;
    }
    ok('E4.1 requireUnsealed() không throw khi CA đang mở niêm phong', noThrowWhileLive);

    // ── E5: wait for TTL to expire ───────────────────────────────────────────
    const waitMs = TTL_MS + 150; // 150 ms buffer
    console.log(`\n── E5  Chờ TTL hết hạn (sleep ${waitMs} ms) ─────────────────`);
    await sleep(waitMs);

    // ── E6: state should now be sealed (time-based check in getSealState) ───
    console.log('\n── E6  Kiểm tra trạng thái sau khi TTL hết hạn ─────────────');
    const stateExpired = PgpService.getSealState();
    ok('E6.1 isSealed = true sau khi TTL hết hạn',   stateExpired.isSealed === true);
    ok('E6.2 unsealedAt = null sau khi TTL hết hạn',  stateExpired.unsealedAt === null);
    ok('E6.3 expiresAt = null sau khi TTL hết hạn',   stateExpired.expiresAt === null);

    // ── E7: requireUnsealed() must throw 423 after expiry ───────────────────
    console.log('\n── E7  requireUnsealed() sau TTL hết hạn ────────────────────');
    let threw423 = false;
    let caughtCode = null;
    try {
      PgpService.requireUnsealed();
    } catch (err) {
      threw423  = err.statusCode === 423;
      caughtCode = err.statusCode;
    }
    ok(`E7.1 requireUnsealed() throw sau TTL hết hạn (statusCode=${caughtCode})`, threw423);

    // ── E8: double-check with a re-unseal cycle ──────────────────────────────
    console.log('\n── E8  Re-unseal cycle (kiểm tra idempotency sau expiry) ────');
    const threeKeysAgain  = readShardKeys(3);
    const reseal2         = await PgpService.unsealCA(threeKeysAgain);
    ok('E8.1 unsealCA hoạt động lại sau khi TTL hết hạn',   reseal2?.success === true);
    ok('E8.2 alreadyUnsealed = false (session đã expire)',   reseal2?.alreadyUnsealed === false);

    const state2 = PgpService.getSealState();
    ok('E8.3 CA unsealed sau lần re-unseal',                 state2.isSealed === false);

    // manually seal so cleanup is tidy
    PgpService.sealCA('test-teardown-after-reseal');
    const stateFinal = PgpService.getSealState();
    ok('E8.4 sealCA("test-teardown") → isSealed = true',    stateFinal.isSealed === true);

  } finally {
    // ── cleanup ──────────────────────────────────────────────────────────────
    console.log('\n── Cleanup ───────────────────────────────────────────────────');
    try { purgeShards(); console.log('  purgeShards() OK'); } catch (e) { console.warn('  purgeShards() skipped:', e.message); }
    try { PgpService.sealCA('test-teardown'); } catch (_) {}
    if (fs.existsSync(TMP_DB)) {
      fs.unlinkSync(TMP_DB);
      console.log('  temp DB unlinked');
    }

    // ── summary ──────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  TOTAL: ${passed + failed}  PASS: ${passed}  FAIL: ${failed}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exit(failed === 0 ? 0 : 1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  // best-effort cleanup
  try {
    if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
  } catch (_) {}
  process.exit(1);
});
