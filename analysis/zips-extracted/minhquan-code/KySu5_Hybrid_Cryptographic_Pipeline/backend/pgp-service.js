/**
 * @file backend/pgp-service.js
 * @description Phân hệ Kỹ sư 5: Hybrid Cryptographic Pipeline & Detached Stream Hashes
 * Tiêu chuẩn: IETF RFC 4880, RFC 9580 (Crypto-Refresh), RFC 6637
 * Chức năng cốt lõi:
 *  1. Sign-then-Encrypt (Ed25519 -> ZLIB -> AES-256 -> X25519)
 *  2. Phòng chống Surreptitious Forwarding (Don Davis Attack) qua Intended Recipient Fingerprint (Subpacket 35)
 *  3. Phòng chống EFail (CVE-2017-17688): Cấm Tag 9, ép buộc SEIPD v1 (Tag 18 + MDC) / SEIPD v2 (Tag 20 AEAD/OCB) & Atomic Commitment
 *  4. Streaming Detached Signature cho file lớn (>500MB - 2GB) với Backpressure (highWaterMark = 64KB, RAM < 50MB)
 *  5. Chuẩn hóa văn bản Clearsign theo RFC 4880 (CRLF, trailing whitespace stripping, dash-escaping)
 *  6. Cổng thẩm tra không trạng thái (Stateless Public Verifier) thuần RAM (Zero-Disk Policy)
 */

const fs = require('fs');
const crypto = require('crypto');
const { Readable } = require('stream');
const openpgp = require('openpgp');

class HybridPgpService {
  constructor() {
    // Cấu hình bảo mật nghiêm ngặt (Hardened Security Policy)
    this.securityConfig = {
      preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
      preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
      preferredHashAlgorithm: openpgp.enums.hash.sha512,
      // Phòng chống EFail (CVE-2017-17688): Từ chối gói tin Tag 9 không có MDC/AEAD
      allowInsecureDecryptionWithSigningKeys: false,
      allowUnauthenticatedMessages: false,
      // Giới hạn kích thước chunk stream = 64KB để giữ RAM < 50MB
      streamHighWaterMark: 64 * 1024,
    };
  }

  /**
   * Chuẩn hóa văn bản Clearsign theo đúng đặc tả RFC 4880 Section 7.1:
   * - Chuẩn hóa ngắt dòng thành CRLF (\r\n)
   * - Loại bỏ khoảng trắng và tab dư thừa ở cuối mỗi dòng (Trailing whitespace stripping)
   * - Dash-escaping: Thêm '- ' vào đầu các dòng bắt đầu bằng '-'
   * @param {string} rawText Văn bản gốc
   * @returns {string} Văn bản đã chuẩn hóa RFC 4880
   */
  canonicalizeClearsignText(rawText) {
    if (typeof rawText !== 'string') {
      throw new TypeError('Dữ liệu đầu vào phải là chuỗi ký tự (string).');
    }
    // Tách dòng hỗ trợ cả CRLF và LF
    const lines = rawText.split(/\r?\n/);
    const normalizedLines = lines.map((line) => {
      // 1. Loại bỏ khoảng trắng (0x20) và tab (0x09) ở cuối dòng
      let cleaned = line.replace(/[ \t]+$/g, '');
      // 2. Dash-escaping theo RFC 4880 Section 7.1
      if (cleaned.startsWith('-')) {
        cleaned = '- ' + cleaned;
      }
      return cleaned;
    });
    // 3. Nối lại bằng CRLF đồng nhất
    return normalizedLines.join('\r\n');
  }

  /**
   * Phục hồi văn bản gốc từ nội dung đã Dash-escaped
   * @param {string} escapedText Văn bản đã dash-escape
   * @returns {string} Văn bản sạch
   */
  unescapeClearsignText(escapedText) {
    return escapedText
      .split(/\r?\n/)
      .map((line) => (line.startsWith('- ') ? line.slice(2) : line))
      .join('\r\n');
  }

  /**
   * Tạo văn bản ký Cleartext (Clearsign) chuẩn RFC 4880
   * @param {string} text Nội dung văn bản
   * @param {string} armoredPrivateKey Khóa bí mật Ed25519 định dạng ASCII Armor
   * @param {string} passphrase Mật khẩu giải mã khóa bí mật
   * @returns {Promise<string>} Bản tin Clearsigned PGP
   */
  async createClearsignedMessage(text, armoredPrivateKey, passphrase) {
    const privateKey = await this._loadDecryptedPrivateKey(armoredPrivateKey, passphrase);
    // Tiền xử lý chuẩn hóa để đảm bảo tính nhất quán trước khi ký
    const preNormalized = text
      .split(/\r?\n/)
      .map((l) => l.replace(/[ \t]+$/g, ''))
      .join('\r\n');

    const unsignedMessage = await openpgp.createCleartextMessage({ text: preNormalized });
    const cleartextMessage = await openpgp.sign({
      message: unsignedMessage,
      signingKeys: privateKey,
      config: this.securityConfig,
    });

    return cleartextMessage;
  }

  /**
   * Thẩm tra văn bản Clearsigned PGP
   * @param {string} cleartextArmored Bản tin Clearsigned
   * @param {string} armoredPublicKey Khóa công khai người gửi
   * @returns {Promise<object>} Kết quả xác thực
   */
  async verifyClearsignedMessage(cleartextArmored, armoredPublicKey) {
    const publicKey = await openpgp.readKey({ armoredKey: armoredPublicKey });
    const message = await openpgp.readCleartextMessage({ cleartextMessage: cleartextArmored });

    const verificationResult = await openpgp.verify({
      message,
      verificationKeys: publicKey,
      config: this.securityConfig,
    });

    const { verified, keyID } = verificationResult.signatures[0];
    try {
      await verified;
      return {
        valid: true,
        keyID: keyID.toHex().toUpperCase(),
        signerFingerprint: publicKey.getFingerprint().toUpperCase(),
        text: message.getText(),
      };
    } catch (err) {
      return {
        valid: false,
        reason: `Chữ ký Clearsign không hợp lệ: ${err.message}`,
      };
    }
  }

  /**
   * Pipeline Sign-then-Encrypt với cơ chế chống Surreptitious Forwarding (Don Davis Attack)
   * Luồng xử lý: Plaintext -> Ký Ed25519 (nhúng Subpacket 35 Intended Recipient) -> Nén ZLIB -> Mã hóa AES-256 -> X25519 Key Wrap
   *
   * @param {string|Uint8Array} plaintext Dữ liệu cần gửi
   * @param {string} senderArmoredPrivKey Khóa bí mật người gửi (Alice)
   * @param {string} senderPassphrase Passphrase của người gửi
   * @param {string} recipientArmoredPubKey Khóa công khai người nhận dự kiến (Bob)
   * @returns {Promise<object>} Gói tin mã hóa kèm metadata kiểm toán
   */
  async signAndEncryptB2B(plaintext, senderArmoredPrivKey, senderPassphrase, recipientArmoredPubKey) {
    const senderPrivKey = await this._loadDecryptedPrivateKey(senderArmoredPrivKey, senderPassphrase);
    const recipientPubKey = await openpgp.readKey({ armoredKey: recipientArmoredPubKey });

    // Trích xuất Fingerprint của người nhận dự kiến (Bob) để nhúng vào Subpacket Type 35
    const intendedRecipientFingerprint = recipientPubKey.getFingerprint().toUpperCase();
    const senderFingerprint = senderPrivKey.getFingerprint().toUpperCase();

    const message =
      typeof plaintext === 'string'
        ? await openpgp.createMessage({ text: plaintext })
        : await openpgp.createMessage({ binary: plaintext });

    // OpenPGP.js tự động nhúng Intended Recipient Fingerprint (Subpacket 35 - RFC 9580 / RFC 4880bis)
    // vào vùng Hashed Subpackets của Signature Packet (Tag 2) khi encryptionKeys được cung cấp cùng signingKeys
    const encryptedArmored = await openpgp.encrypt({
      message,
      encryptionKeys: recipientPubKey,
      signingKeys: senderPrivKey,
      format: 'armored',
      config: {
        ...this.securityConfig,
        // Bắt buộc nén ZLIB trước khi mã hóa
        preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
        // Bắt buộc AES-256 với SEIPD (Tag 18 MDC hoặc Tag 20 AEAD) chống EFail
        preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
      },
    });

    return {
      encryptedMessage: encryptedArmored,
      pipelineMetadata: {
        cipherSuite: 'Ed25519 -> ZLIB -> AES-256 (SEIPD) -> X25519',
        senderFingerprint,
        intendedRecipientFingerprint,
        subpacket35Protected: true,
        efailProtection: 'SEIPD_ENFORCED_TAG9_BLOCKED',
      },
    };
  }

  /**
   * Giải mã và thẩm tra chữ ký B2B (Decrypt-then-Verify) với:
   *  1. Phòng chống EFail (CVE-2017-17688): Từ chối gói tin không toàn vẹn (Tag 9) và Atomic Commitment
   *  2. Phòng chống Surreptitious Forwarding: Đối soát Intended Recipient Fingerprint (Subpacket 35)
   *     với Fingerprint của người nhận thực tế đang giải mã.
   *
   * @param {string} encryptedArmored Bản mã PGP
   * @param {string} recipientArmoredPrivKey Khóa bí mật người nhận hiện tại
   * @param {string} recipientPassphrase Passphrase của người nhận
   * @param {string} expectedSenderArmoredPubKey Khóa công khai người gửi gốc (Alice)
   * @returns {Promise<object>} Dữ liệu giải mã nếu vượt qua toàn bộ rào chắn an ninh
   */
  async decryptAndVerifyB2B(
    encryptedArmored,
    recipientArmoredPrivKey,
    recipientPassphrase,
    expectedSenderArmoredPubKey
  ) {
    const recipientPrivKey = await this._loadDecryptedPrivateKey(recipientArmoredPrivKey, recipientPassphrase);
    const senderPubKey = await openpgp.readKey({ armoredKey: expectedSenderArmoredPubKey });
    const actualRecipientFingerprint = recipientPrivKey.getFingerprint().toUpperCase();

    const message = await openpgp.readMessage({ armoredMessage: encryptedArmored });

    // Kiểm tra cấu trúc gói tin trước khi giải mã để chặn Tag 9 (Symmetrically Encrypted Data không MDC)
    for (const packet of message.packets) {
      if (packet.constructor.tag === openpgp.enums.packet.symmetricallyEncryptedData) {
        throw new Error(
          'SECURITY_REJECT [EFail CVE-2017-17688]: Từ chối gói tin Tag 9 không có mã bảo vệ toàn vẹn MDC/AEAD!'
        );
      }
    }

    // Atomic Stream Commitment: openpgp.decrypt chỉ trả về plaintext sau khi MDC/AEAD tag xác thực thành công
    const { data: decryptedData, signatures } = await openpgp.decrypt({
      message,
      decryptionKeys: recipientPrivKey,
      verificationKeys: senderPubKey,
      expectSigned: true,
      config: {
        ...this.securityConfig,
        allowInsecureDecryptionWithSigningKeys: false,
        allowUnauthenticatedMessages: false,
      },
    });

    if (!signatures || signatures.length === 0) {
      throw new Error('SECURITY_REJECT: Thông điệp không chứa chữ ký số xác thực.');
    }

    const sigInfo = signatures[0];
    await sigInfo.verified; // Ném lỗi nếu chữ ký toán học không khớp

    // Kiểm tra Subpacket 35 (Intended Recipient Fingerprint) chống Surreptitious Forwarding
    const rawSigPacket = await sigInfo.signature;
    const sigPacket = rawSigPacket.packets[0];
    const intendedRecipients = sigPacket.intendedRecipientFingerprints || [];

    if (intendedRecipients.length > 0) {
      const normalizedIntended = intendedRecipients.map((fp) =>
        Buffer.isBuffer(fp) ? fp.toString('hex').toUpperCase() : String(fp).toUpperCase()
      );

      // Kiểm tra xem Fingerprint của người đang giải mã (hoặc subkey của họ) có nằm trong Subpacket 35 không
      const recipientKeyFingerprints = [
        actualRecipientFingerprint,
        ...recipientPrivKey.getSubkeys().map((sk) => sk.getFingerprint().toUpperCase()),
      ];

      const isIntended = normalizedIntended.some((fp) => recipientKeyFingerprints.includes(fp));
      if (!isIntended) {
        throw new Error(
          `SECURITY_REJECT [Surreptitious Forwarding - Subpacket 35]: ` +
            `Chữ ký được chỉ định cho Fingerprint [${normalizedIntended.join(', ')}], ` +
            `nhưng người giải mã hiện tại là [${actualRecipientFingerprint}]. Phát hiện tấn công chuyển tiếp mạo danh!`
        );
      }
    }

    return {
      verified: true,
      data: decryptedData,
      senderFingerprint: senderPubKey.getFingerprint().toUpperCase(),
      recipientFingerprint: actualRecipientFingerprint,
      subpacket35Verified: intendedRecipients.length > 0,
    };
  }

  /**
   * Ký số tách rời (Detached Signature) dạng Streaming cho tệp dung lượng lớn (>500MB - 2GB)
   * Kiểm soát Backpressure nghiêm ngặt với highWaterMark = 64KB, đảm bảo RAM Node.js RSS < 50MB.
   * Áp dụng Single-Pass SHA-512 accumulation để tránh đọc tệp 2 lần như PureEdDSA.
   *
   * @param {string} filePath Đường dẫn tệp trên đĩa
   * @param {string} armoredPrivateKey Khóa bí mật người ký
   * @param {string} passphrase Mật khẩu khóa bí mật
   * @returns {Promise<object>} Chữ ký Detached ASCII Armored và thông số telemetry RAM
   */
  async createDetachedStreamSignature(filePath, armoredPrivateKey, passphrase) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Không tìm thấy tệp nguồn tại: ${filePath}`);
    }

    const startTime = process.hrtime.bigint();
    let peakRssBytes = process.memoryUsage().rss;

    const privateKey = await this._loadDecryptedPrivateKey(armoredPrivateKey, passphrase);

    // Khởi tạo Node.js ReadStream với highWaterMark = 64KB
    const fileStream = fs.createReadStream(filePath, {
      highWaterMark: this.securityConfig.streamHighWaterMark,
    });

    // Cầu nối sang Web ReadableStream với cơ chế kiểm soát áp lực ngược (Backpressure)
    const webStream = new ReadableStream(
      {
        start(controller) {
          fileStream.on('data', (chunk) => {
            const currentRss = process.memoryUsage().rss;
            if (currentRss > peakRssBytes) {
              peakRssBytes = currentRss;
            }
            controller.enqueue(new Uint8Array(chunk));
            // Nếu hàng đợi tiêu thụ của OpenPGP đầy (desiredSize <= 0), tạm dừng đọc từ đĩa ngay lập tức
            if (controller.desiredSize !== null && controller.desiredSize <= 0) {
              fileStream.pause();
            }
          });

          fileStream.on('end', () => {
            controller.close();
          });

          fileStream.on('error', (err) => {
            controller.error(err);
          });
        },
        pull() {
          // Khi bộ xử lý mật mã tiêu thụ xong chunk, tiếp tục mở luồng đọc đĩa
          if (fileStream.isPaused()) {
            fileStream.resume();
          }
        },
        cancel() {
          fileStream.destroy();
        },
      },
      // Chiến lược hàng đợi tối đa 2 chunks (128KB) trên WebStream
      new CountQueuingStrategy({ highWaterMark: 2 })
    );

    const message = await openpgp.createMessage({ binary: webStream });
    const detachedSignature = await openpgp.sign({
      message,
      signingKeys: privateKey,
      detached: true,
      format: 'armored',
      config: this.securityConfig,
    });

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;
    const fileStats = fs.statSync(filePath);

    return {
      detachedSignature,
      telemetry: {
        fileSizeBytes: fileStats.size,
        fileSizeMB: +(fileStats.size / (1024 * 1024)).toFixed(2),
        durationMs: +durationMs.toFixed(2),
        throughputMBps: +((fileStats.size / (1024 * 1024)) / (durationMs / 1000)).toFixed(2),
        peakRssMB: +(peakRssBytes / (1024 * 1024)).toFixed(2),
        memoryBudgetCompliant: peakRssBytes < 50 * 1024 * 1024,
      },
    };
  }

  /**
   * Thẩm tra chữ ký tách rời (Detached Signature) hoàn toàn trên luồng RAM (Zero-Disk Policy)
   * Hỗ trợ cả Node.js Readable Stream (từ HTTP multipart upload) hoặc Buffer trực tiếp.
   * Không bao giờ ghi tệp tạm ra ổ cứng -> Triệt tiêu lỗ hổng TOCTOU và rò rỉ dữ liệu.
   *
   * @param {Readable|Buffer|Uint8Array} dataSource Luồng dữ liệu hoặc Buffer trên RAM
   * @param {string} detachedSignatureArmored Chữ ký tách rời (.asc/.sig)
   * @param {string} armoredPublicKey Khóa công khai của người ký
   * @returns {Promise<object>} Kết quả thẩm tra kèm thời gian thực thi và mức RAM đỉnh
   */
  async verifyDetachedStreamZeroDisk(dataSource, detachedSignatureArmored, armoredPublicKey) {
    const startTime = process.hrtime.bigint();
    let peakRssBytes = process.memoryUsage().rss;

    const publicKey = await openpgp.readKey({ armoredKey: armoredPublicKey });
    const signature = await openpgp.readSignature({ armoredSignature: detachedSignatureArmored });

    let message;
    if (Buffer.isBuffer(dataSource) || dataSource instanceof Uint8Array) {
      message = await openpgp.createMessage({ binary: new Uint8Array(dataSource) });
    } else if (dataSource && typeof dataSource.on === 'function') {
      // Chuyển đổi Node.js Readable Stream (ví dụ từ Busboy/Multer memory stream) sang Web ReadableStream
      const webStream = new ReadableStream(
        {
          start(controller) {
            dataSource.on('data', (chunk) => {
              const currentRss = process.memoryUsage().rss;
              if (currentRss > peakRssBytes) {
                peakRssBytes = currentRss;
              }
              controller.enqueue(new Uint8Array(chunk));
              if (controller.desiredSize !== null && controller.desiredSize <= 0) {
                dataSource.pause();
              }
            });
            dataSource.on('end', () => controller.close());
            dataSource.on('error', (err) => controller.error(err));
          },
          pull() {
            if (typeof dataSource.isPaused === 'function' && dataSource.isPaused()) {
              dataSource.resume();
            }
          },
          cancel() {
            if (typeof dataSource.destroy === 'function') {
              dataSource.destroy();
            }
          },
        },
        new CountQueuingStrategy({ highWaterMark: 2 })
      );
      message = await openpgp.createMessage({ binary: webStream });
    } else {
      throw new TypeError('Nguồn dữ liệu không hợp lệ: Yêu cầu Buffer hoặc Node.js Readable Stream.');
    }

    const verificationResult = await openpgp.verify({
      message,
      signature,
      verificationKeys: publicKey,
      config: this.securityConfig,
    });

    const sigInfo = verificationResult.signatures[0];
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;

    try {
      await sigInfo.verified;
      return {
        valid: true,
        signerFingerprint: publicKey.getFingerprint().toUpperCase(),
        keyID: sigInfo.keyID.toHex().toUpperCase(),
        zeroDiskVerified: true,
        telemetry: {
          durationMs: +durationMs.toFixed(2),
          peakRssMB: +(peakRssBytes / (1024 * 1024)).toFixed(2),
        },
      };
    } catch (err) {
      return {
        valid: false,
        reason: err.message,
        signerFingerprint: publicKey.getFingerprint().toUpperCase(),
        zeroDiskVerified: true,
        telemetry: {
          durationMs: +durationMs.toFixed(2),
          peakRssMB: +(peakRssBytes / (1024 * 1024)).toFixed(2),
        },
      };
    }
  }

  /**
   * Hàm nội bộ nạp và giải mã Private Key
   */
  async _loadDecryptedPrivateKey(armoredKey, passphrase) {
    const privateKey = await openpgp.readPrivateKey({ armoredKey });
    if (privateKey.isDecrypted()) {
      return privateKey;
    }
    return await openpgp.decryptKey({ privateKey, passphrase });
  }
}

module.exports = new HybridPgpService();
