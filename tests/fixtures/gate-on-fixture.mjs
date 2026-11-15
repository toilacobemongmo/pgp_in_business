/**
 * Fixture chạy trong tiến trình con với DEMO_PLAINTEXT_KEYS=1.
 * store.js đọc DB_FILE_OVERRIDE một lần lúc module load, nên phải chạy
 * trong process riêng để DB path mới được bind đúng.
 *
 * Output: JSON object { certsWithDemo, totalCerts, dirWithDemoCount, partnerKeyOk } ra stdout.
 *
 * LƯU Ý: KHÔNG gọi process.exit() bên trong try — Node bỏ qua khối finally
 * khi process.exit() được gọi, khiến mảnh quorum và DB tạm sót lại trên đĩa
 * (đúng lỗi đã quan sát được). Dùng process.exitCode rồi để luồng chạy hết.
 */
import fs from 'fs';
import { PgpService } from '../../backend/pgp-service.js';
import { purgeShards, QUORUM_SHARD_CONSTANTS } from '../../backend/quorum-shard-store.js';

const SHARD_DIR = QUORUM_SHARD_CONSTANTS.SHARD_DIR;

const TMP_DB = process.env.DB_FILE_OVERRIDE;
if (!TMP_DB) {
  console.error('DB_FILE_OVERRIDE không được set');
  process.exit(2);
}

try {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);

  await PgpService.initCA();

  const db = JSON.parse(fs.readFileSync(TMP_DB, 'utf-8'));

  const certsWithDemo = db.certificates.filter(c => 'demoPrivateKeyArmored' in c).length;
  const totalCerts    = db.certificates.length;
  const dirWithDemo   = db.key_directory.filter(d => 'privateKeyArmoredDemo' in d);
  const partnerEntry  = dirWithDemo[0];
  const partnerKeyOk  = partnerEntry
    ? (typeof partnerEntry.privateKeyArmoredDemo === 'string'
       && partnerEntry.privateKeyArmoredDemo.includes('BEGIN PGP PRIVATE KEY'))
    : false;

  console.log(JSON.stringify({
    certsWithDemo,
    totalCerts,
    dirWithDemoCount: dirWithDemo.length,
    partnerKeyOk,
  }));
  process.exitCode = 0;
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  // Dọn sạch mọi thứ initCA sinh ra trong lúc test: DB tạm + mảnh quorum.
  if (fs.existsSync(TMP_DB)) {
    try { fs.unlinkSync(TMP_DB); } catch (_) { /* bỏ qua */ }
  }
  try { purgeShards(); } catch (_) { /* bỏ qua nếu không còn */ }
  // purgeShards() chỉ xóa FILE, giữ lại thư mục rỗng — xóa nốt để không sót.
  try { fs.rmdirSync(SHARD_DIR); } catch (_) { /* thư mục không rỗng hoặc không tồn tại */ }
}
