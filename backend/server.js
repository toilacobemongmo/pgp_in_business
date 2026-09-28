import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { store } from './store.js';
import { PgpService } from './pgp-service.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage for file signature processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// ==========================================
// 1. ROOT CA STATUS & METRICS
// ==========================================
app.get('/api/ca/status', async (req, res) => {
  try {
    const db = store.read();
    let caConfig = db.ca_config;
    if (!caConfig) {
      caConfig = await PgpService.initCA();
    }

    const totalCerts = db.certificates.length;
    const activeCerts = db.certificates.filter(c => c.status === 'active').length;
    const revokedCerts = db.certificates.filter(c => c.status === 'revoked').length;
    const totalDirectoryKeys = db.key_directory.length;
    const externalPartners = db.key_directory.filter(k => k.keyType === 'external_partner').length;
    const signedDocsCount = db.signed_documents.length;
    const b2bMessagesCount = db.b2b_messages.length;

    res.json({
      success: true,
      ca: {
        name: caConfig.name,
        email: caConfig.email,
        keyID: caConfig.keyID,
        fingerprint: caConfig.fingerprint,
        algorithm: caConfig.algorithm,
        createdAt: caConfig.createdAt,
        expiresAt: caConfig.expiresAt,
        publicKeyArmored: caConfig.publicKeyArmored,
        revocationCertificateArmored: caConfig.revocationCertificateArmored
      },
      metrics: {
        totalCerts,
        activeCerts,
        revokedCerts,
        totalDirectoryKeys,
        externalPartners,
        signedDocsCount,
        b2bMessagesCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. CERTIFICATES ISSUANCE & REVOCATION
// ==========================================
app.get('/api/certificates', (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, certificates: db.certificates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/certificates/issue', async (req, res) => {
  try {
    const { name, email, department, role, validityDays, customPublicKeyArmored, notes } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Tên và Email là bắt buộc.' });
    }

    const cert = await PgpService.issueCertificate({
      name,
      email,
      department: department || 'Khối Nghiệp vụ',
      role: role || 'Chuyên viên',
      validityDays: parseInt(validityDays, 10) || 365,
      customPublicKeyArmored: customPublicKeyArmored?.trim() || null,
      notes
    });

    res.json({ success: true, certificate: cert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/certificates/:id/revoke', async (req, res) => {
  try {
    const { reason } = req.body;
    const cert = await PgpService.revokeCertificate(req.params.id, reason);
    res.json({ success: true, certificate: cert });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. ENTERPRISE KEY DIRECTORY (INTERNAL & B2B)
// ==========================================
app.get('/api/directory', (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, directory: db.key_directory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/directory/import', async (req, res) => {
  try {
    const { organizationName, contactName, contactEmail, department, publicKeyArmored, notes } = req.body;
    if (!organizationName || !publicKeyArmored) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin Doanh nghiệp hoặc Khóa công khai.' });
    }

    const openpgp = await import('openpgp');
    const pubKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
    const fingerprint = pubKey.getFingerprint();
    const keyID = pubKey.getKeyID().toHex().toUpperCase();

    const db = store.read();
    const existing = db.key_directory.find(k => k.fingerprint === fingerprint);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Public Key với Fingerprint này đã tồn tại trong Danh bạ!' });
    }

    const newEntry = {
      id: 'ext_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      organizationName,
      contactName: contactName || 'Đại diện B2B',
      contactEmail: contactEmail || '',
      department: department || 'Đối ngoại B2B',
      keyType: 'external_partner',
      fingerprint,
      keyID,
      publicKeyArmored: pubKey.armor(),
      trustLevel: 'verified_partner',
      isCA: false,
      notes: notes || 'Khóa công khai đối tác liên kết nhập thủ công',
      createdAt: new Date().toISOString()
    };

    db.key_directory.push(newEntry);
    store.write(db);
    store.logAudit(
      'IMPORT_EXTERNAL_KEY',
      'Security Operator',
      `Thêm khóa đối tác bên ngoài [${organizationName}] - KeyID: ${keyID}`
    );

    res.json({ success: true, entry: newEntry });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Khóa OpenPGP không hợp lệ: ' + err.message });
  }
});

app.delete('/api/directory/:id', (req, res) => {
  try {
    const db = store.read();
    const target = db.key_directory.find(k => k.id === req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy mục danh bạ.' });
    }
    if (target.isCA) {
      return res.status(403).json({ success: false, error: 'Không thể xóa Corporate Root CA khỏi danh bạ!' });
    }

    db.key_directory = db.key_directory.filter(k => k.id !== req.params.id);
    store.write(db);
    store.logAudit('DELETE_KEY', 'Admin', `Xóa khóa [${target.organizationName}] KeyID: ${target.keyID}`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. DOCUMENT SIGNING & VERIFICATION
// ==========================================
app.get('/api/documents', (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, documents: db.signed_documents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ký văn bản text hoặc file binary
app.post('/api/documents/sign', upload.single('file'), async (req, res) => {
  try {
    const { textContent, signerPrivateKeyArmored, signerPassphrase, isTextOnly, customDocName } = req.body;

    let buffer;
    let isText = false;
    let documentName = 'document.txt';

    if (req.file) {
      buffer = req.file.buffer;
      documentName = req.file.originalname;
      isText = false;
    } else if (textContent) {
      buffer = Buffer.from(textContent, 'utf-8');
      documentName = customDocName || 'van_ban_ky_so_' + new Date().toISOString().slice(0, 10) + '.txt';
      isText = true;
    } else {
      return res.status(400).json({ success: false, error: 'Vui lòng tải lên tệp tin hoặc nhập nội dung văn bản để ký.' });
    }

    if (!signerPrivateKeyArmored) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp Private Key của người ký.' });
    }

    const signedDoc = await PgpService.signDocument({
      documentName,
      contentBuffer: buffer,
      isText,
      signerPrivateKeyArmored,
      passphrase: signerPassphrase || ''
    });

    res.json({ success: true, signedDocument: signedDoc });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Lỗi ký số: ' + err.message });
  }
});

// Xác thực chữ ký số
app.post('/api/documents/verify', upload.single('file'), async (req, res) => {
  try {
    const { textContent, signatureArmored, signerPublicKeyArmored } = req.body;

    let buffer;
    let isText = false;

    if (req.file) {
      buffer = req.file.buffer;
      isText = false;
    } else if (textContent) {
      buffer = Buffer.from(textContent, 'utf-8');
      isText = true;
    } else if (signatureArmored?.includes('-----BEGIN PGP SIGNED MESSAGE-----')) {
      // Clearsigned text tự chứa cả nội dung lẫn chữ ký
      buffer = Buffer.from(signatureArmored, 'utf-8');
      isText = true;
    } else {
      return res.status(400).json({ success: false, error: 'Thiếu tệp tin hoặc văn bản gốc cần xác minh.' });
    }

    if (!signatureArmored && !isText) {
      return res.status(400).json({ success: false, error: 'Thiếu chữ ký số PGP (.asc) cần kiểm tra.' });
    }

    const result = await PgpService.verifyDocument({
      contentBuffer: buffer,
      isText,
      signatureArmored: signatureArmored || buffer.toString('utf-8'),
      signerPublicKeyArmored
    });

    res.json({ success: true, verification: result });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Lỗi xác minh: ' + err.message });
  }
});

// ==========================================
// 5. B2B SECURE MESSAGING (END-TO-END)
// ==========================================
app.get('/api/messages', (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, messages: db.b2b_messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/messages/send', async (req, res) => {
  try {
    const {
      senderOrg,
      senderEmail,
      senderPrivateKeyArmored,
      senderPassphrase,
      recipientOrg,
      recipientEmail,
      recipientPublicKeyArmored,
      subject,
      content
    } = req.body;

    if (!senderPrivateKeyArmored || !recipientPublicKeyArmored || !subject || !content) {
      return res.status(400).json({ success: false, error: 'Vui lòng điền đầy đủ thông tin khóa, người nhận, tiêu đề và nội dung.' });
    }

    const message = await PgpService.sendB2BMessage({
      senderOrg: senderOrg || 'Doanh nghiệp của chúng tôi',
      senderEmail: senderEmail || 'internal@enterprise.local',
      senderPrivateKeyArmored,
      senderPassphrase: senderPassphrase || '',
      recipientOrg: recipientOrg || 'Doanh nghiệp đối tác',
      recipientEmail: recipientEmail || 'partner@external.corp',
      recipientPublicKeyArmored,
      subject,
      content
    });

    res.json({ success: true, message });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Lỗi gửi tin nhắn mã hóa: ' + err.message });
  }
});

app.post('/api/messages/decrypt', async (req, res) => {
  try {
    const {
      encryptedPayloadArmored,
      recipientPrivateKeyArmored,
      recipientPassphrase,
      senderPublicKeyArmored
    } = req.body;

    if (!encryptedPayloadArmored || !recipientPrivateKeyArmored || !senderPublicKeyArmored) {
      return res.status(400).json({
        success: false,
        error: 'Cần có bản tin mã hóa, Private Key người nhận để giải mã và Public Key người gửi để xác thực chữ ký.'
      });
    }

    const result = await PgpService.decryptB2BMessage({
      encryptedPayloadArmored,
      recipientPrivateKeyArmored,
      recipientPassphrase: recipientPassphrase || '',
      senderPublicKeyArmored
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Lỗi giải mã bản tin: ' + err.message });
  }
});

// ==========================================
// 6. AUDIT LOGS & SYSTEM
// ==========================================
app.get('/api/audit-logs', (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, logs: db.audit_logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Khởi chạy server và tự động init CA
async function start() {
  await PgpService.initCA();
  app.listen(PORT, () => {
    console.log(`🚀 Enterprise CA & B2B Server is running on port ${PORT}`);
    console.log(`🌐 API available at http://localhost:${PORT}/api/ca/status`);
  });
}

start().catch(err => {
  console.error('Fatal error starting server:', err);
});
