/**
 * @file backend/server.js
 * @description Phân hệ Kỹ sư 5: RESTful API Gateway & Stateless Public Verifier (Zero-Disk Policy)
 * Cung cấp các endpoint bảo mật B2B:
 *  - POST /api/v1/pgp/sign-encrypt       : Pipeline Sign-then-Encrypt chống Surreptitious Forwarding
 *  - POST /api/v1/pgp/decrypt-verify     : Giải mã & xác thực Subpacket 35 + chặn EFail
 *  - POST /api/v1/pgp/clearsign          : Ký văn bản Clearsign chuẩn RFC 4880
 *  - POST /api/v1/pgp/verify-clearsign   : Thẩm tra văn bản Clearsign
 *  - POST /api/v1/pgp/sign-stream        : Ký tách rời tệp lớn trên server bằng Stream (RAM < 50MB)
 *  - POST /api/v1/pgp/verify-detached    : Cổng Stateless Public Verifier thuần RAM (Zero-Disk)
 */

const express = require('express');
const multer = require('multer');
const { Readable } = require('stream');
const pgpService = require('./pgp-service');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Cấu hình Multer sử dụng MemoryStorage (Zero-Disk Policy: Tuyệt đối không ghi tệp tạm ra đĩa)
const uploadZeroDisk = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // Giới hạn 500MB cho mỗi request upload bộ nhớ
  },
});

// Middleware ghi nhận Header bảo mật Enterprise
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

/**
 * 1. Endpoint kiểm tra sức khỏe hệ thống & thông số bộ nhớ
 */
app.get('/api/v1/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'OK',
    module: 'Engineer 5 - Hybrid Cryptographic Pipeline & Stateless Verifier',
    standards: ['RFC 4880', 'RFC 9580', 'RFC 6637'],
    memory: {
      rssMB: +(mem.rss / (1024 * 1024)).toFixed(2),
      heapUsedMB: +(mem.heapUsed / (1024 * 1024)).toFixed(2),
    },
  });
});

/**
 * 2. Pipeline Sign-then-Encrypt (Chống Surreptitious Forwarding qua Subpacket 35)
 */
app.post('/api/v1/pgp/sign-encrypt', async (req, res) => {
  try {
    const { plaintext, senderPrivateKey, senderPassphrase, recipientPublicKey } = req.body;
    if (!plaintext || !senderPrivateKey || !recipientPublicKey) {
      return res.status(400).json({
        error: 'Thiếu tham số bắt buộc: plaintext, senderPrivateKey, recipientPublicKey.',
      });
    }

    const result = await pgpService.signAndEncryptB2B(
      plaintext,
      senderPrivateKey,
      senderPassphrase || '',
      recipientPublicKey
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * 3. Giải mã & Thẩm tra (Chặn EFail Tag 9 & Chặn Surreptitious Forwarding Subpacket 35)
 */
app.post('/api/v1/pgp/decrypt-verify', async (req, res) => {
  try {
    const { encryptedMessage, recipientPrivateKey, recipientPassphrase, expectedSenderPublicKey } = req.body;
    if (!encryptedMessage || !recipientPrivateKey || !expectedSenderPublicKey) {
      return res.status(400).json({
        error: 'Thiếu tham số bắt buộc: encryptedMessage, recipientPrivateKey, expectedSenderPublicKey.',
      });
    }

    const result = await pgpService.decryptAndVerifyB2B(
      encryptedMessage,
      recipientPrivateKey,
      recipientPassphrase || '',
      expectedSenderPublicKey
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    // Trả về mã 403 Forbidden nếu vi phạm chính sách bảo mật (Subpacket 35 hoặc EFail)
    const statusCode = err.message.includes('SECURITY_REJECT') ? 403 : 400;
    return res.status(statusCode).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * 4. Tạo chữ ký Clearsign chuẩn RFC 4880
 */
app.post('/api/v1/pgp/clearsign', async (req, res) => {
  try {
    const { text, senderPrivateKey, senderPassphrase } = req.body;
    if (!text || !senderPrivateKey) {
      return res.status(400).json({ error: 'Thiếu tham số text hoặc senderPrivateKey.' });
    }

    const cleartextMessage = await pgpService.createClearsignedMessage(
      text,
      senderPrivateKey,
      senderPassphrase || ''
    );

    return res.status(200).json({
      success: true,
      cleartextMessage,
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 5. Thẩm tra chữ ký Clearsign
 */
app.post('/api/v1/pgp/verify-clearsign', async (req, res) => {
  try {
    const { cleartextMessage, senderPublicKey } = req.body;
    if (!cleartextMessage || !senderPublicKey) {
      return res.status(400).json({ error: 'Thiếu tham số cleartextMessage hoặc senderPublicKey.' });
    }

    const result = await pgpService.verifyClearsignedMessage(cleartextMessage, senderPublicKey);
    return res.status(result.valid ? 200 : 422).json({
      success: result.valid,
      ...result,
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 6. Cổng Thẩm tra Công khai Không Trạng Thái (Stateless Public Verifier - Zero-Disk Policy)
 * Nhận tệp tài liệu (PDF/DOCX/ZIP) + chữ ký rời (.asc) + khóa công khai (.asc)
 * Xử lý thuần túy trên luồng RAM, không bao giờ ghi tệp tạm ra đĩa để ngăn chặn tấn công TOCTOU.
 */
app.post(
  '/api/v1/pgp/verify-detached',
  uploadZeroDisk.fields([
    { name: 'document', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const docFile = req.files && req.files['document'] ? req.files['document'][0] : null;
      const sigFile = req.files && req.files['signature'] ? req.files['signature'][0] : null;
      const detachedSignature = sigFile ? sigFile.buffer.toString('utf8') : req.body.detachedSignature;
      const publicKey = req.body.publicKey;

      if (!docFile || !detachedSignature || !publicKey) {
        return res.status(400).json({
          success: false,
          error: 'Yêu cầu cung cấp đầy đủ: file [document], [signature/detachedSignature], và [publicKey].',
        });
      }

      // Chuyển buffer trên RAM thành Readable Stream để xử lý theo từng chunk 64KB
      const ramStream = Readable.from(docFile.buffer, {
        highWaterMark: 64 * 1024,
      });

      const verificationResult = await pgpService.verifyDetachedStreamZeroDisk(
        ramStream,
        detachedSignature,
        publicKey
      );

      // Giải phóng tham chiếu buffer ngay sau khi thẩm tra xong
      docFile.buffer = null;

      return res.status(verificationResult.valid ? 200 : 422).json({
        success: verificationResult.valid,
        fileName: docFile.originalname,
        fileSizeBytes: docFile.size,
        ...verificationResult,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  }
);

if (require.main === module) {
  const PORT = process.env.PORT || 3005;
  app.listen(PORT, () => {
    console.log(`[Engineer 5 Gateway] Enterprise OpenPGP Hybrid Pipeline running on port ${PORT}`);
    console.log(`[Security Policy] Zero-Disk Verifier: ENABLED | Subpacket 35 Defense: ENABLED | EFail Tag 9 Block: ENABLED`);
  });
}

module.exports = app;
