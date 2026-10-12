import crypto from 'crypto';

/**
 * Shamir's Secret Sharing (SSS) Cryptographic Engine
 * Triển khai thuật toán Nội suy Lagrange trên trường Galois GF(256) (GF(2^8))
 * Chuẩn mật mã đa thức bất khả quy: P(x) = x^8 + x^4 + x^3 + x + 1 (0x11D / 285)
 * Dùng để phân mảnh Private Key của Root CA thành n mảnh, cần tối thiểu k mảnh để phục hồi.
 */

// Bảng nhân và lũy thừa trong GF(256)
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

// Khởi tạo bảng tra cứu Galois Field GF(2^8)
(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11D; // Đa thức tối giản AES / Rijndael / Shamir GF(256)
    }
  }
  LOG_TABLE[0] = 0; // log(0) không xác định nhưng gán 0 để tránh crash
})();

function gfAdd(a, b) {
  return a ^ b; // Trong GF(2^8), cộng/trừ tương đương phép XOR
}

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

function gfDiv(a, b) {
  if (b === 0) throw new Error('Phép chia cho 0 trong GF(256)');
  if (a === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] - LOG_TABLE[b] + 255) % 255];
}

export class ShamirSecretSharing {
  /**
   * Đánh giá giá trị của đa thức f(x) tại điểm x trong GF(256)
   * f(x) = a0 + a1*x + a2*x^2 + ... + a_{k-1}*x^{k-1}
   * trong đó a0 là byte bí mật (secret byte)
   */
  static evaluatePolynomial(coefficients, x) {
    let result = 0;
    for (let i = coefficients.length - 1; i >= 0; i--) {
      result = gfAdd(gfMul(result, x), coefficients[i]);
    }
    return result;
  }

  /**
   * Phân rã chuỗi bí mật (Secret String / Key) thành n mảnh (Shares) với ngưỡng k (Threshold)
   * @param {string} secretText - Dữ liệu bí mật (VD: CA Private Key hoặc Root Passphrase)
   * @param {number} totalShares - Tổng số mảnh phát hành (n)
   * @param {number} threshold - Ngưỡng tối thiểu cần để khôi phục (k <= n)
   */
  static split(secretText, totalShares = 5, threshold = 3) {
    if (threshold < 2) throw new Error('Ngưỡng k tối thiểu phải từ 2 trở lên.');
    if (threshold > totalShares) throw new Error('Ngưỡng k không thể lớn hơn tổng số mảnh n.');
    if (totalShares > 255) throw new Error('Tổng số mảnh không vượt quá kích thước GF(256) (255 mảnh).');

    const secretBytes = Buffer.from(secretText, 'utf-8');
    const secretLen = secretBytes.length;

    // Chuẩn bị mảng chứa các shares. Mỗi share có id (x trong GF(256)) từ 1 đến totalShares
    const shares = [];
    for (let i = 1; i <= totalShares; i++) {
      shares.push({
        shareId: i,
        threshold,
        totalShares,
        data: new Uint8Array(secretLen)
      });
    }

    // Với mỗi byte của bí mật, tạo 1 đa thức bậc (k - 1) ngẫu nhiên
    for (let byteIdx = 0; byteIdx < secretLen; byteIdx++) {
      const a0 = secretBytes[byteIdx]; // Hệ số tự do f(0) chính là bí mật
      const coefficients = new Uint8Array(threshold);
      coefficients[0] = a0;

      // Sinh ngẫu nhiên các hệ số còn lại (a1, a2, ..., a_{k-1})
      const randomBytes = crypto.randomBytes(threshold - 1);
      for (let c = 1; c < threshold; c++) {
        // Đảm bảo hệ số bậc cao nhất khác 0 để đa thức đúng bậc
        let randVal = randomBytes[c - 1];
        if (c === threshold - 1 && randVal === 0) randVal = 1;
        coefficients[c] = randVal;
      }

      // Tính điểm f(x) cho từng người giữ mảnh (x = 1 .. n)
      for (let s = 0; s < totalShares; s++) {
        const x = s + 1;
        shares[s].data[byteIdx] = ShamirSecretSharing.evaluatePolynomial(coefficients, x);
      }
    }

    // Định dạng các mảnh dưới dạng Hex String kèm metadata
    return shares.map((s, idx) => ({
      shareIndex: s.shareId,
      threshold: s.threshold,
      totalShares: s.totalShares,
      shareKey: `SHR-${s.threshold}OF${s.totalShares}-${s.shareId.toString(16).padStart(2, '0')}-${Buffer.from(s.data).toString('hex')}`,
      holderRole: `Quản trị viên An ninh số #${s.shareId}`,
      createdAt: new Date().toISOString()
    }));
  }

  /**
   * Khôi phục chuỗi bí mật ban đầu bằng Thuật toán Nội suy Lagrange tại x = 0
   * @param {Array<string>} shareKeyStrings - Danh sách tối thiểu k chuỗi Share Key
   */
  static combine(shareKeyStrings) {
    if (!Array.isArray(shareKeyStrings) || shareKeyStrings.length < 2) {
      throw new Error('Cần cung cấp ít nhất 2 mảnh để thực hiện khôi phục.');
    }

    // Bóc tách format SHR-kOFn-xx-DATAHEX
    const parsedShares = shareKeyStrings.map(str => {
      const trimmed = str.trim();
      const parts = trimmed.split('-');
      if (parts.length < 4 || parts[0] !== 'SHR') {
        throw new Error(`Định dạng mảnh khóa không hợp lệ: "${trimmed.substring(0, 16)}..."`);
      }
      const [k, n] = parts[1].split('OF').map(Number);
      const x = parseInt(parts[2], 16);
      const data = Buffer.from(parts[3], 'hex');
      return { threshold: k, totalShares: n, x, data };
    });

    // Kiểm tra trùng lặp x
    const xSet = new Set(parsedShares.map(s => s.x));
    if (xSet.size < parsedShares.length) {
      throw new Error('Có mảnh khóa bị trùng lặp ID (x). Phải cung cấp các mảnh riêng biệt của từng người giữ.');
    }

    const threshold = parsedShares[0].threshold;
    if (parsedShares.length < threshold) {
      throw new Error(`Chưa đủ ngưỡng an toàn. Hệ thống yêu cầu tối thiểu ${threshold} mảnh, hiện tại chỉ có ${parsedShares.length} mảnh.`);
    }

    const byteLen = parsedShares[0].data.length;
    // Kiểm tra tính đồng nhất về độ dài dữ liệu
    for (const s of parsedShares) {
      if (s.data.length !== byteLen) {
        throw new Error('Các mảnh không cùng một phiên sinh khóa (khác biệt về độ dài byte).');
      }
    }

    // Chọn k mảnh đầu tiên để nội suy
    const kShares = parsedShares.slice(0, threshold);
    const recoveredBytes = Buffer.alloc(byteLen);

    // Thuật toán nội suy Lagrange tính f(0) trên từng vị trí byte:
    // f(0) = \sum_{j=0}^{k-1} y_j * \prod_{m \ne j} \frac{0 - x_m}{x_j - x_m}
    for (let byteIdx = 0; byteIdx < byteLen; byteIdx++) {
      let secretByte = 0;

      for (let j = 0; j < threshold; j++) {
        const xj = kShares[j].x;
        const yj = kShares[j].data[byteIdx];

        // Tính hệ số Lagrange basis polynomial L_j(0)
        let basis = 1;
        for (let m = 0; m < threshold; m++) {
          if (m === j) continue;
          const xm = kShares[m].x;
          // (0 - xm) / (xj - xm) trong GF(2^8)
          // Lưu ý trong GF(2^8), phép trừ chính là phép cộng (XOR), -xm = xm
          const num = xm;
          const den = gfAdd(xj, xm);
          const factor = gfDiv(num, den);
          basis = gfMul(basis, factor);
        }

        const term = gfMul(yj, basis);
        secretByte = gfAdd(secretByte, term);
      }

      recoveredBytes[byteIdx] = secretByte;
    }

    return recoveredBytes.toString('utf-8');
  }
}
