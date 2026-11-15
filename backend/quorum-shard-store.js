/**
 * QUORUM SHARD STORE (WORKSTREAM B)
 * ---------------------------------
 * Vấn đề gốc: `PgpService.initCA()` sinh bộ mảnh Shamir 3-of-5 và CHỈ in ra
 * console. Đóng terminal là mất vĩnh viễn khả năng unseal (Root CA chết).
 *
 * Giải pháp: mỗi mảnh được ghi ra MỘT FILE RIÊNG
 *   - nằm ngoài db.json  -> không bao giờ lẫn vào dữ liệu ứng dụng
 *   - quyền 0600 (chỉ owner đọc/ghi), thư mục 0700
 *   - nằm trong thư mục đã gitignore -> không bị commit nhầm
 *
 * Ràng buộc quan trọng:
 *   - KHÔNG ghi mảnh vào db.json (không gọi store.write với shard).
 *   - Mảnh là dữ liệu bí mật: sau khi bàn giao cho 5 người giữ khác nhau,
 *     quản trị viên PHẢI xóa thư mục này khỏi server.
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './store.js';

// Thư mục chứa mảnh: backend/data/quorum-shards/
// Dùng chung gốc dữ liệu với store.js để kế thừa ràng buộc đường dẫn.
export const SHARD_DIR = path.join(DATA_DIR, 'quorum-shards');

const SHARD_FILE_MODE = 0o600;
const SHARD_DIR_MODE = 0o700;

// Nhãn không bí mật để đối chiếu mảnh với người giữ.
const HOLDER_HINTS = {
  ADMIN: 'Quản trị viên An ninh #1 (CA Admin)',
  SECURITY_OFFICER: 'Cán bộ An ninh thông tin #2',
  CTO: 'Giám đốc Kỹ thuật (CTO) #3',
  AUDITOR: 'Kiểm toán viên Nội bộ #4',
  DPO: 'Cán bộ Bảo vệ Dữ liệu (DPO) #5',
};

/** Chuẩn hóa tên holder thành tên file an toàn (chống path traversal). */
function toFileName(index, holderRole) {
  const safe = String(holderRole || 'holder')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 40);
  return `share-${String(index + 1).padStart(2, '0')}-${safe}.txt`;
}

/**
 * Ghi từng mảnh ra file riêng. Trả về metadata (KHÔNG chứa shareKey).
 * @param {Array<{holderRole: string, shareKey: string}>} shares
 * @returns {Array<{index: number, holderRole: string, fileName: string, filePath: string}>}
 */
export function writeShards(shares = []) {
  if (!Array.isArray(shares) || shares.length === 0) {
    throw new Error('writeShards: danh sách mảnh rỗng.');
  }

  fs.mkdirSync(SHARD_DIR, { recursive: true, mode: SHARD_DIR_MODE });

  const written = [];
  shares.forEach((share, index) => {
    const fileName = toFileName(index, share.holderRole);
    const filePath = path.join(SHARD_DIR, fileName);

    // Bảo đảm đường dẫn cuối cùng vẫn nằm trong SHARD_DIR.
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(SHARD_DIR) + path.sep)) {
      throw new Error('writeShards: đường dẫn mảnh thoát khỏi thư mục quorum-shards.');
    }

    const body = [
      '# MẢNH QUORUM SHAMIR — TÀI LIỆU TỐI MẬT',
      `# Holder role: ${share.holderRole}`,
      `# Holder gợi ý: ${HOLDER_HINTS[share.holderRole] || 'Người giữ được chỉ định'}`,
      '# Sinh lúc: ' + new Date().toISOString(),
      '#',
      '# CẢNH BÁO: file này cho phép tham gia unseal Root CA.',
      '# - Không copy vào email/chat/issue tracker/hệ thống quản lý mã nguồn.',
      '# - Mỗi mảnh phải do một người giữ KHÁC NHAU nắm giữ.',
      '# - Sau khi bàn giao xong, XÓA thư mục backend/data/quorum-shards/ khỏi server.',
      '#',
      '# Payload (một dòng, không xuống dòng):',
      share.shareKey,
      '',
    ].join('\n');

    // mode 0600: chỉ tiến trình sở hữu đọc/ghi được.
    fs.writeFileSync(filePath, body, { mode: SHARD_FILE_MODE, encoding: 'utf8' });
    // fs.writeFileSync chỉ áp mode khi tạo mới; chmod lại để chắc chắn kể cả khi ghi đè.
    try { fs.chmodSync(filePath, SHARD_FILE_MODE); } catch { /* Windows bỏ qua quyền POSIX */ }

    written.push({ index, holderRole: share.holderRole, fileName, filePath });
  });

  // File hướng dẫn bàn giao — chứa cảnh báo, KHÔNG chứa mảnh.
  const readmePath = path.join(SHARD_DIR, 'README-BAN-GIAO.txt');
  const readme = [
    'BỘ MẢNH QUORUM 3-OF-5 — HƯỚNG DẪN BÀN GIAO',
    '==========================================',
    '',
    `Số mảnh: ${written.length} (ngưỡng cần thiết để unseal: 3)`,
    '',
    'BẮT BUỘC:',
    '1. Bàn giao MỖI mảnh cho MỘT NGƯỜI GIỮ KHÁC NHAU (5 người khác nhau).',
    '2. Không để hai mảnh trong tay một người — như vậy quorum vô hiệu.',
    '3. Không gửi mảnh qua email/chat/ticket. Chuyển tay hoặc kênh mã hóa.',
    '4. Sau khi bàn giao xong: XÓA thư mục backend/data/quorum-shards/ khỏi server.',
    '   Lệnh: rmdir /s /q backend\\data\\quorum-shards   (Windows)',
    '         rm -rf backend/data/quorum-shards          (Linux/macOS)',
    '5. Mất 3 mảnh trở lên = mất vĩnh viễn khả năng unseal Root CA.',
    '',
    'Danh sách file:',
    ...written.map((w) => `  - ${w.fileName}  ->  ${HOLDER_HINTS[w.holderRole] || w.holderRole}`),
    '',
  ].join('\n');
  fs.writeFileSync(readmePath, readme, { mode: SHARD_FILE_MODE, encoding: 'utf8' });
  try { fs.chmodSync(readmePath, SHARD_FILE_MODE); } catch { /* Windows */ }

  return written;
}

/**
 * Đọc lại mảnh đầu tiên có trong file (dùng cho test / khôi phục thủ công).
 * Bỏ qua dòng comment '#' và dòng rỗng.
 */
export function readShard(fileName) {
  const filePath = path.join(SHARD_DIR, fileName);
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  return lines[0] || null;
}

/** Liệt kê các file mảnh hiện có (bỏ README). */
export function listShardFiles() {
  if (!fs.existsSync(SHARD_DIR)) return [];
  return fs.readdirSync(SHARD_DIR)
    .filter((f) => f.startsWith('share-') && f.endsWith('.txt'))
    .sort();
}

/** Đọc n mảnh đầu tiên — tiện cho test "3 mảnh OK / 2 mảnh fail". */
export function readShardKeys(count) {
  const files = listShardFiles().slice(0, count);
  return files.map((f) => readShard(f)).filter(Boolean);
}

/** Xóa sạch thư mục mảnh (dùng sau khi bàn giao hoặc trong test). */
export function purgeShards() {
  if (!fs.existsSync(SHARD_DIR)) return;
  for (const f of fs.readdirSync(SHARD_DIR)) {
    try { fs.unlinkSync(path.join(SHARD_DIR, f)); } catch { /* ignore */ }
  }
}

export const QUORUM_SHARD_CONSTANTS = Object.freeze({
  SHARD_DIR,
  SHARD_FILE_MODE,
  SHARD_DIR_MODE,
  HOLDER_HINTS,
});
