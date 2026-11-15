import crypto from 'crypto';

/**
 * Shamir's Secret Sharing (SSS) Cryptographic Engine
 * Triển khai thuật toán Nội suy Lagrange trên trường Galois GF(256) (GF(2^8))
 * Chuẩn mật mã đa thức bất khả quy: P(x) = x^8 + x^4 + x^3 + x + 1 (0x11D / 285)
 * Dùng để phân mảnh bí mật của Root CA thành n mảnh, cần tối thiểu k mảnh để phục hồi.
 *
 * VERSION 2 (Kỹ sư 2):
 * - Mỗi mảnh mang theo mã phiên (sessionTag) và độ dài đệm cố định, nên không
 *   còn rò rỉ độ dài byte chính xác của bí mật qua chuỗi share.
 * - Kèm checksum toàn vẹn (integrity tag) để phát hiện mảnh bị chỉnh sửa
 *   hoặc ghép lẫn giữa hai phiên khác nhau.
 * - Vẫn đọc được mảnh định dạng cũ (legacy) để không phá dữ liệu đã phát hành.
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

// ---------------------------------------------------------------------------
// Lớp bọc chống lộ độ dài (length-hiding envelope) + mã phiên
// ---------------------------------------------------------------------------
// payload = [0x02 version][sessionTag 8B][lenField 4B BE][secret][0x00 pad][tag 16B]
// Tổng độ dài làm tròn lên bội số BLOCK_SIZE (16 byte) nên hai bí mật nằm trong
// cùng một khối có share dài bằng nhau -> không lộ độ dài chính xác.
// sessionTag sinh ngẫu nhiên mỗi lần split(), nhờ vậy trộn mảnh giữa hai phiên
// khác nhau bị phát hiện cả ở mức metadata lẫn ở integrity tag.
//
// QUAN TRỌNG (Kỹ sư 2): KHÔNG có fallback "legacy" im lặng. Nếu byte phiên bản
// không phải 0x02 hoặc tag không khớp thì coi là mảnh hỏng/ghép lẫn và ném lỗi.
// Trước đây nhánh fallback khiến dữ liệu rác được trả về như bí mật hợp lệ.
export const ENVELOPE_VERSION = 0x02;
export const ENVELOPE_BLOCK_SIZE = 16;
export const ENVELOPE_TAG_LEN = 16;
export const ENVELOPE_SESSION_TAG_LEN = 8;
const ENVELOPE_HEADER_LEN = 1 + ENVELOPE_SESSION_TAG_LEN + 4;

function computeIntegrityTag(payloadWithoutTag) {
  // Checksum không khóa: chỉ dùng để phát hiện ghép sai / hỏng dữ liệu.
  // Không phải MAC có khóa bí mật, không tạo oracle tấn công.
  return crypto.createHash('sha256').update(payloadWithoutTag).digest().subarray(0, ENVELOPE_TAG_LEN);
}

/**
 * Sinh envelope cho một bí mật.
 * @param {Buffer} secretBuffer
 * @param {Buffer} [sessionTag] - 8 byte; nếu không truyền sẽ sinh ngẫu nhiên.
 */
function envelopeSecret(secretBuffer, sessionTag = crypto.randomBytes(ENVELOPE_SESSION_TAG_LEN)) {
  if (!Buffer.isBuffer(sessionTag) || sessionTag.length !== ENVELOPE_SESSION_TAG_LEN) {
    throw new Error(`sessionTag phải là Buffer ${ENVELOPE_SESSION_TAG_LEN} byte.`);
  }
  const usingLength = ENVELOPE_HEADER_LEN + secretBuffer.length + ENVELOPE_TAG_LEN;
  const totalLen = Math.ceil(usingLength / ENVELOPE_BLOCK_SIZE) * ENVELOPE_BLOCK_SIZE;
  const payload = Buffer.alloc(totalLen, 0);

  payload[0] = ENVELOPE_VERSION;
  sessionTag.copy(payload, 1);
  payload.writeUInt32BE(secretBuffer.length, 1 + ENVELOPE_SESSION_TAG_LEN);
  secretBuffer.copy(payload, ENVELOPE_HEADER_LEN);

  const tagStart = totalLen - ENVELOPE_TAG_LEN;
  const tag = computeIntegrityTag(payload.subarray(0, tagStart));
  tag.copy(payload, tagStart);

  return payload;
}

/**
 * Gỡ envelope, KHÔNG chấp nhận dữ liệu ngoài định dạng.
 * @returns {{ secret: Buffer, sessionTag: Buffer }}
 * @throws nếu sai phiên bản, sai tag toàn vẹn, hoặc độ dài không hợp lệ.
 */
function unenvelopeSecret(recoveredBytes) {
  if (!Buffer.isBuffer(recoveredBytes) || recoveredBytes.length < ENVELOPE_HEADER_LEN + ENVELOPE_TAG_LEN) {
    throw new Error('Dữ liệu khôi phục quá ngắn để chứa envelope v2 (mảnh không hợp lệ hoặc quá cũ).');
  }
  if (recoveredBytes[0] !== ENVELOPE_VERSION) {
    throw new Error(
      'Dữ liệu khôi phục không phải envelope v2 (sai phiên bản). ' +
      'Nguyên nhân thường gặp: các mảnh không thuộc cùng một phiên sinh khóa.'
    );
  }

  const sessionTag = Buffer.from(recoveredBytes.subarray(1, 1 + ENVELOPE_SESSION_TAG_LEN));
  const secretLen = recoveredBytes.readUInt32BE(1 + ENVELOPE_SESSION_TAG_LEN);
  const tagStart = recoveredBytes.length - ENVELOPE_TAG_LEN;
  const maxLen = tagStart - ENVELOPE_HEADER_LEN;

  if (secretLen === 0 || secretLen > maxLen) {
    throw new Error('Độ dài bí mật trong envelope không hợp lệ (mảnh bị hỏng hoặc ghép lẫn phiên).');
  }

  const expectedTag = computeIntegrityTag(recoveredBytes.subarray(0, tagStart));
  const actualTag = recoveredBytes.subarray(tagStart);

  if (!crypto.timingSafeEqual(expectedTag, actualTag)) {
    throw new Error('Mảnh khóa không hợp lệ hoặc đã bị chỉnh sửa (sai mã toàn vẹn).');
  }

  const secret = Buffer.from(recoveredBytes.subarray(ENVELOPE_HEADER_LEN, ENVELOPE_HEADER_LEN + secretLen));
  return { secret, sessionTag };
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
    const n = Number(totalShares);
    const k = Number(threshold);

    if (!Number.isInteger(n) || !Number.isInteger(k)) {
      throw new Error('Ngưỡng k và tổng số mảnh n phải là số nguyên.');
    }
    if (typeof secretText !== 'string' || secretText.length === 0) {
      throw new Error('Bí mật cần phân rã không được rỗng.');
    }
    if (k < 2) throw new Error('Ngưỡng k tối thiểu phải từ 2 trở lên.');
    if (k > n) throw new Error('Ngưỡng k không thể lớn hơn tổng số mảnh n.');
    if (n > 255) throw new Error('Tổng số mảnh không vượt quá kích thước GF(256) (255 mảnh).');
    if (n < 2) throw new Error('Tổng số mảnh n tối thiểu phải là 2.');

    const secretBytes = Buffer.from(secretText, 'utf-8');
    // Một sessionTag cho toàn bộ lần chia -> mảnh cùng phiên mới nội suy được.
    const sessionTag = crypto.randomBytes(ENVELOPE_SESSION_TAG_LEN);
    const payload = envelopeSecret(secretBytes, sessionTag);
    const payloadLen = payload.length;

    // Chuẩn bị mảng chứa các shares. Mỗi share có id (x trong GF(256)) từ 1 đến n
    const shares = [];
    for (let i = 1; i <= n; i++) {
      shares.push({
        shareId: i,
        threshold: k,
        totalShares: n,
        data: new Uint8Array(payloadLen)
      });
    }

    // Với mỗi byte của payload, tạo 1 đa thức bậc (k - 1) ngẫu nhiên
    for (let byteIdx = 0; byteIdx < payloadLen; byteIdx++) {
      const a0 = payload[byteIdx]; // Hệ số tự do f(0) chính là byte dữ liệu
      const coefficients = new Uint8Array(k);
      coefficients[0] = a0;

      // Sinh ngẫu nhiên các hệ số còn lại (a1, a2, ..., a_{k-1})
      const randomBytes = crypto.randomBytes(k - 1);
      for (let c = 1; c < k; c++) {
        // Đảm bảo hệ số bậc cao nhất khác 0 để đa thức đúng bậc
        let randVal = randomBytes[c - 1];
        if (c === k - 1 && randVal === 0) randVal = 1;
        coefficients[c] = randVal;
      }

      // Tính điểm f(x) cho từng người giữ mảnh (x = 1 .. n)
      for (let s = 0; s < n; s++) {
        const x = s + 1;
        shares[s].data[byteIdx] = ShamirSecretSharing.evaluatePolynomial(coefficients, x);
      }
    }

    // Định dạng: SHR-<k>OF<n>-<xx x> -<sessionTag><hexData>
    // sessionTag nằm ngay trong shareKey (dạng hex 16 ký tự) để có thể kiểm
    // tra cùng phiên trước khi nội suy, nhưng vẫn được xác minh lại bằng
    // integrity tag bên trong envelope.
    const sessionTagHex = sessionTag.toString('hex');
    return shares.map((s) => ({
      shareIndex: s.shareId,
      threshold: s.threshold,
      totalShares: s.totalShares,
      sessionTag: sessionTagHex,
      shareKey: `SHR-${s.threshold}OF${s.totalShares}-${s.shareId.toString(16).padStart(2, '0')}-${sessionTagHex}-${Buffer.from(s.data).toString('hex')}`,
      holderRole: `Quản trị viên An ninh số #${s.shareId}`,
      encoding: 'envelope-v2',
      createdAt: new Date().toISOString()
    }));
  }

  /**
   * Phân tích 1 chuỗi share thành cấu trúc dữ liệu.
   */
  static parseShare(shareKeyString) {
    if (typeof shareKeyString !== 'string') {
      throw new Error('Mảnh khóa phải là chuỗi.');
    }
    const trimmed = shareKeyString.trim();
    const parts = trimmed.split('-');
    if (parts.length < 4 || parts[0] !== 'SHR') {
      throw new Error(`Định dạng mảnh khóa không hợp lệ: "${trimmed.substring(0, 16)}..."`);
    }
    const [rawK, rawN] = parts[1].split('OF');
    const threshold = Number(rawK);
    const totalShares = Number(rawN);
    const x = parseInt(parts[2], 16);

    if (!Number.isInteger(threshold) || !Number.isInteger(totalShares) || !Number.isInteger(x)) {
      throw new Error('Metadata trong mảnh khóa không hợp lệ (k/n/x).');
    }

    let sessionTag = null;
    let hexData;
    if (parts.length >= 5) {
      // Định dạng v2: SHR-<k>OF<n>-<x>-<sessionTagHex>-<dataHex>
      const rawSessionTag = parts[3];
      if (!/^[0-9a-fA-F]{16}$/.test(rawSessionTag)) {
        throw new Error('sessionTag của mảnh khóa không hợp lệ (cần 16 ký tự hex).');
      }
      sessionTag = rawSessionTag.toLowerCase();
      hexData = parts.slice(4).join('-');
    } else {
      // Định dạng v1 không có sessionTag (đọc được nhưng combine sẽ từ chối).
      hexData = parts.slice(3).join('-');
    }

    if (!/^[0-9a-fA-F]+$/.test(hexData) || hexData.length % 2 !== 0) {
      throw new Error('Phần dữ liệu hex của mảnh khóa không hợp lệ.');
    }

    return { threshold, totalShares, x, sessionTag, data: Buffer.from(hexData, 'hex') };
  }

  /**
   * Nội suy Lagrange trên tập mảnh đã cho, trả về Buffer thô.
   */
  static interpolateAtZero(shares) {
    const threshold = shares.length;
    const byteLen = shares[0].data.length;
    const recoveredBytes = Buffer.alloc(byteLen);

    for (let byteIdx = 0; byteIdx < byteLen; byteIdx++) {
      let secretByte = 0;

      for (let j = 0; j < threshold; j++) {
        const xj = shares[j].x;
        const yj = shares[j].data[byteIdx];

        // Tính hệ số Lagrange basis polynomial L_j(0)
        let basis = 1;
        for (let m = 0; m < threshold; m++) {
          if (m === j) continue;
          const xm = shares[m].x;
          // (0 - xm) / (xj - xm) trong GF(2^8); phép trừ chính là XOR
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

    return recoveredBytes;
  }

  /**
   * Khôi phục chuỗi bí mật ban đầu bằng Thuật toán Nội suy Lagrange tại x = 0
   * @param {Array<string>} shareKeyStrings - Danh sách tối thiểu k chuỗi Share Key
   */
  static combine(shareKeyStrings) {
    if (!Array.isArray(shareKeyStrings) || shareKeyStrings.length < 2) {
      throw new Error('Cần cung cấp ít nhất 2 mảnh để thực hiện khôi phục.');
    }

    const parsedShares = shareKeyStrings.map((str) => ShamirSecretSharing.parseShare(str));

    // Kiểm tra trùng lặp x
    const xSet = new Set(parsedShares.map((s) => s.x));
    if (xSet.size < parsedShares.length) {
      throw new Error('Có mảnh khóa bị trùng lặp ID (x). Phải cung cấp các mảnh riêng biệt của từng người giữ.');
    }

    const threshold = parsedShares[0].threshold;
    const totalShares = parsedShares[0].totalShares;
    const sessionTag = parsedShares[0].sessionTag;

    if (!sessionTag) {
      throw new Error('Mảnh khóa thuộc định dạng cũ (không có sessionTag) và bị từ chối vì không kiểm chứng được toàn vẹn.');
    }

    // Kiểm tra nhất quán phiên sinh khóa
    for (const s of parsedShares) {
      if (s.threshold !== threshold || s.totalShares !== totalShares) {
        throw new Error('Các mảnh không cùng một phiên sinh khóa (khác biệt về ngưỡng k hoặc tổng số mảnh n).');
      }
      if (s.sessionTag !== sessionTag) {
        throw new Error('Các mảnh không cùng một phiên sinh khóa (khác sessionTag). Không được trộn mảnh giữa các lần chia.');
      }
      if (s.x < 1 || s.x > totalShares) {
        throw new Error(`Mảnh khóa có ID ${s.x} nằm ngoài phạm vi 1..${totalShares}.`);
      }
    }

    // Kiểm tra tính đồng nhất về độ dài dữ liệu
    const byteLen = parsedShares[0].data.length;
    for (const s of parsedShares) {
      if (s.data.length !== byteLen) {
        throw new Error('Các mảnh không cùng một phiên sinh khóa (khác biệt về độ dài byte).');
      }
    }

    if (parsedShares.length < threshold) {
      throw new Error(`Chưa đủ ngưỡng an toàn. Hệ thống yêu cầu tối thiểu ${threshold} mảnh, hiện tại chỉ có ${parsedShares.length} mảnh.`);
    }

    // Chọn k mảnh đầu tiên (đã sắp theo x để kết quả tất định) để nội suy
    const kShares = [...parsedShares].sort((a, b) => a.x - b.x).slice(0, threshold);
    const recoveredBytes = ShamirSecretSharing.interpolateAtZero(kShares);

    const { secret, sessionTag: recoveredSessionTag } = unenvelopeSecret(recoveredBytes);

    // Lớp phòng thủ thứ hai: sessionTag tuyên bố trong shareKey phải khớp
    // with sessionTag thật nằm trong envelope vừa nội suy.
    if (recoveredSessionTag.toString('hex') !== sessionTag) {
      throw new Error('sessionTag trong envelope không khớp metadata mảnh khóa (dấu hiệu ghép lẫn phiên).');
    }

    return secret.toString('utf-8');
  }

  /**
   * Xác thực một tập mảnh có khôi phục được bí mật đúng hay không,
   * dùng cho luồng Unseal Quorum: trả về { ok, secret?, reason? }.
   */
  static tryCombine(shareKeyStrings) {
    try {
      return { ok: true, secret: ShamirSecretSharing.combine(shareKeyStrings) };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }
}
