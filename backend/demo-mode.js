/**
 * DEMO MODE GATE (WORKSTREAM C)
 * -----------------------------
 * Vấn đề gốc: hệ thống sinh thêm khóa riêng "demo" cho từng chứng chỉ / đối tác
 * và lưu thẳng vào `db.json` dưới các trường:
 *   - `certificates[].demoPrivateKeyArmored`
 *   - `key_directory[].demoPrivateKeyArmored`
 *   - `key_directory[].privateKeyArmoredDemo`
 *
 * Đây là khóa riêng PLAINTEXT trên đĩa, chỉ phục vụ việc trình diễn UI (tải khóa
 * về máy, ký số demo, gửi/nhận tin nhắn B2B demo). Không luồng nghiệp vụ thật
 * nào cần tới nó — người dùng thật phải tự sinh khóa ở máy họ và chỉ gửi CSR /
 * public key lên CA.
 *
 * Vì 6 component UI đang phụ thuộc trực tiếp vào các trường này, KHÔNG thể xóa
 * ngay mà không phá luồng demo. Theo yêu cầu Workstream C, chúng được đưa ra sau
 * một cờ môi trường DEV-ONLY, MẶC ĐỊNH TẮT:
 *
 *   DEMO_PLAINTEXT_KEYS=1   -> bật (chỉ dùng khi trình diễn/giảng dạy cục bộ)
 *   (không set) / =0        -> tắt  (mặc định, an toàn)
 *
 * Khi tắt: backend không sinh, không lưu và không trả khóa riêng demo;
 * các nút UI tương ứng sẽ tự ẩn vì không nhận được dữ liệu.
 */

export const DEMO_KEYS_ENV = 'DEMO_PLAINTEXT_KEYS';

/**
 * Cờ bật/tắt khóa riêng plaintext dạng demo. Mặc định TẮT.
 * Chỉ đúng khi biến môi trường được set thành 1/true/yes/on (không phân biệt hoa thường).
 */
export function isDemoPlaintextKeysEnabled(env = process.env) {
  const raw = env[DEMO_KEYS_ENV];
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Trả khóa riêng demo nếu cờ bật, ngược lại trả null.
 * Dùng ở mọi chỗ ghi `demoPrivateKeyArmored` / `privateKeyArmoredDemo` vào DB.
 */
export function demoPrivateKeyOrNull(armoredPrivateKey, env = process.env) {
  return isDemoPlaintextKeysEnabled(env) ? (armoredPrivateKey || null) : null;
}

/**
 * Ghi log MỘT LẦN lúc khởi động để người vận hành biết trạng thái.
 */
export function logDemoKeyMode() {
  if (isDemoPlaintextKeysEnabled()) {
    console.warn('');
    console.warn('⚠️  DEMO_PLAINTEXT_KEYS=1 — ĐANG LƯU KHÓA RIÊNG DẠNG PLAINTEXT VÀO db.json');
    console.warn('    Đây là cấu hình CHỈ dùng cho trình diễn/giảng dạy cục bộ.');
    console.warn('    TUYỆT ĐỐI không dùng ở môi trường thật. Tắt bằng cách bỏ biến này.');
    console.warn('');
  } else {
    console.log('🔐 Khóa riêng demo (plaintext) đang TẮT — không có private key nào được lưu vào db.json.');
  }
}
