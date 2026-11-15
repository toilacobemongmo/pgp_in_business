import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { store } from './store.js';
import { PgpService } from './pgp-service.js';
import { OpenPgpPacketInspector } from './pgp-packet-inspector.js';
import { WebOfTrustAnalyzer } from './wot-analyzer.js';
import { ShamirSecretSharing } from './shamir-service.js';
import { MerkleTreeEngine } from './merkle-engine.js';
import {
  authenticate,
  authorize,
  requireAuth,
  describeAuth,
  isAuthDisabled,
  loadTokenTable
} from './auth.js';
import { logDemoKeyMode } from './demo-mode.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Xác thực chạy TRƯỚC mọi route: gắn req.auth = { role, authenticated }.
// Không chặn ở đây — từng route tự khai báo role được phép qua authorize().
app.use(authenticate);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage for file signature processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// ==========================================
// 0. QUORUM MIDDLEWARE (KỸ SƯ 2)
// ==========================================
// Chuyển lỗi nghiệp vụ có statusCode thành HTTP status tương ứng,
// đặc biệt là 423 Locked khi Root CA đang SEALED.
function handleServiceError(res, err, fallbackStatus = 400) {
  const status = err.statusCode || fallbackStatus;
  res.status(status).json({
    success: false,
    code: err.code || null,
    error: err.message
  });
}

// ==========================================
// 0b. AUTH — TRA CỨU DANH TÍNH TOKEN
// ==========================================
// Frontend gọi endpoint này để biết token đang là role gì, thay vì hardcode
// role/secret trong bundle.
app.get('/api/auth/whoami', (req, res) => {
  res.json({ success: true, ...describeAuth(req) });
});

// ==========================================
// 1. ROOT CA STATUS & METRICS
// ==========================================
app.get('/api/ca/status', async (req, res) => {
  try {
    const db = store.read();
    let caConfig = db.ca_config;
    if (!caConfig) {
      try {
        caConfig = await PgpService.initCA();
        // db được ghi lại bởi initCA, đọc lại để lấy metrics chính xác
        Object.assign(db, store.read());
      } catch (initErr) {
        // Kỹ sư 2: không bao giờ fallback về passphrase mặc định.
        return res.status(500).json({
          success: false,
          code: 'CA_INIT_FAILED',
          error: initErr.message,
          hint: 'Đặt biến môi trường CA_PASSPHRASE (>= 12 ký tự) trước khi khởi động backend lần đầu.'
        });
      }
    }

    const totalCerts = db.certificates.length;
    const activeCerts = db.certificates.filter(c => c.status === 'active').length;
    const revokedCerts = db.certificates.filter(c => c.status === 'revoked').length;
    const totalDirectoryKeys = db.key_directory.length;
    const externalPartners = db.key_directory.filter(k => k.keyType === 'external_partner').length;
    const signedDocsCount = db.signed_documents.length;
    const b2bMessagesCount = db.b2b_messages.length;

    const sealState = PgpService.getSealState();

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
        revocationCertificateArmored: caConfig.revocationCertificateArmored,
        isSealed: sealState.isSealed,
        unsealedAt: sealState.unsealedAt,
        sealExpiresAt: sealState.expiresAt,
        unsealTtlMs: sealState.ttlMs
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
app.get('/api/certificates', authorize('admin', 'employee'), (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, certificates: db.certificates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/certificates/issue', authorize('admin'), async (req, res) => {
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
    // 423 Locked nếu CA chưa Unseal, 500 cho lỗi khác
    handleServiceError(res, err, err.statusCode ? 400 : 500);
  }
});

app.post('/api/certificates/:id/revoke', authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const cert = await PgpService.revokeCertificate(req.params.id, reason);
    res.json({ success: true, certificate: cert });
  } catch (err) {
    handleServiceError(res, err, 400);
  }
});

// ------------------------------------------
// QUORUM UNSEAL / SEAL — KỸ SƯ 2
// ------------------------------------------
app.post('/api/ca/unseal', authorize('admin'), async (req, res) => {
  try {
    const { shares } = req.body;
    if (!Array.isArray(shares) || shares.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp danh sách mảnh khóa Quorum (shares).'
      });
    }
    const result = await PgpService.unsealCA(shares);
    res.json(result);
  } catch (err) {
    handleServiceError(res, err, 400);
  }
});

app.post('/api/ca/seal', authorize('admin'), (req, res) => {
  try {
    const { reason } = req.body || {};
    const state = PgpService.sealCA(reason || 'manual');
    res.json({ success: true, state });
  } catch (err) {
    handleServiceError(res, err, 500);
  }
});

// ==========================================
// 3. ENTERPRISE KEY DIRECTORY (INTERNAL & B2B)
// ==========================================
// Danh bạ công khai (Public Verifier cần để tra khóa). Không chứa khóa riêng.
app.get('/api/directory', (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, directory: db.key_directory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/directory/import', authorize('admin', 'partner'), async (req, res) => {
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

app.delete('/api/directory/:id', authorize('admin'), (req, res) => {
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
app.get('/api/documents', authorize('admin', 'employee', 'partner'), (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, documents: db.signed_documents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ký văn bản text hoặc file binary
app.post('/api/documents/sign', authorize('admin', 'employee'), upload.single('file'), async (req, res) => {
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
// Xác thực chữ ký là thao tác CÔNG KHAI (Public Verifier không cần tài khoản).
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
app.get('/api/messages', authorize('admin', 'employee', 'partner'), (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, messages: db.b2b_messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/messages/send', authorize('admin', 'employee', 'partner'), async (req, res) => {
  try {
    const {
      senderOrg,
      senderEmail,
      senderPrivateKeyArmored,
      senderPassphrase,
      senderIsCA,
      recipientOrg,
      recipientEmail,
      recipientPublicKeyArmored,
      subject,
      content
    } = req.body;

    if (!recipientPublicKeyArmored || !subject || !content) {
      return res.status(400).json({ success: false, error: 'Vui lòng điền đầy đủ thông tin khóa, người nhận, tiêu đề và nội dung.' });
    }
    if (!senderIsCA && !senderPrivateKeyArmored) {
      return res.status(400).json({ success: false, error: 'Thiếu Private Key của bên gửi để ký số.' });
    }

    const message = await PgpService.sendB2BMessage({
      senderOrg: senderOrg || 'Doanh nghiệp của chúng tôi',
      senderEmail: senderEmail || 'internal@enterprise.local',
      senderPrivateKeyArmored,
      senderPassphrase: senderPassphrase || '',
      senderIsCA: Boolean(senderIsCA),
      recipientOrg: recipientOrg || 'Doanh nghiệp đối tác',
      recipientEmail: recipientEmail || 'partner@external.corp',
      recipientPublicKeyArmored,
      subject,
      content
    });

    res.json({ success: true, message });
  } catch (err) {
    handleServiceError(res, err, 400);
  }
});

// Giải mã bản tin: chỉ admin (người nhận là CA) hoặc đối tác/cán bộ sở hữu khóa.
app.post('/api/messages/decrypt', authorize('admin', 'employee', 'partner'), async (req, res) => {
  try {
    const {
      encryptedPayloadArmored,
      recipientPrivateKeyArmored,
      recipientPassphrase,
      recipientIsCA,
      senderPublicKeyArmored
    } = req.body;

    if (!encryptedPayloadArmored || !senderPublicKeyArmored) {
      return res.status(400).json({
        success: false,
        error: 'Cần có bản tin mã hóa và Public Key người gửi để xác thực chữ ký.'
      });
    }
    if (!recipientIsCA && !recipientPrivateKeyArmored) {
      return res.status(400).json({
        success: false,
        error: 'Cần Private Key người nhận để giải mã (hoặc bật recipientIsCA khi người nhận là Root CA đã Unseal).'
      });
    }

    const result = await PgpService.decryptB2BMessage({
      encryptedPayloadArmored,
      recipientPrivateKeyArmored,
      recipientPassphrase: recipientPassphrase || '',
      recipientIsCA: Boolean(recipientIsCA),
      senderPublicKeyArmored
    });

    res.json({ success: true, result });
  } catch (err) {
    handleServiceError(res, err, 400);
  }
});

// ==========================================
// 6. AUDIT LOGS & SYSTEM
// ==========================================
app.get('/api/audit-logs', authorize('admin', 'employee'), (req, res) => {
  try {
    const db = store.read();
    res.json({ success: true, logs: db.audit_logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. RFC 4880 PACKET INSPECTOR (LOW-LEVEL PARSER)
// ==========================================
app.post('/api/inspector/analyze', authorize('admin', 'employee', 'partner'), (req, res) => {
  try {
    const { armoredData } = req.body;
    if (!armoredData || !armoredData.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp dữ liệu OpenPGP Armored (Key, Signature, hoặc Encrypted Message).' });
    }

    const report = OpenPgpPacketInspector.analyze(armoredData.trim());
    res.json({ success: true, report });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Lỗi bóc tách gói tin nhị phân: ' + err.message });
  }
});

// ==========================================
// 8. WEB OF TRUST (WOT) GRAPH & TRUST PATH ANALYTICS
// ==========================================
app.get('/api/wot/graph', authorize('admin', 'employee'), (req, res) => {
  try {
    const db = store.read();
    const graph = WebOfTrustAnalyzer.buildTrustGraph(db.certificates, db.key_directory, db.ca_config);
    const resilience = WebOfTrustAnalyzer.analyzeNetworkResilience(graph);

    res.json({
      success: true,
      graph,
      resilience
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/wot/path', authorize('admin', 'employee'), (req, res) => {
  try {
    const { sourceFingerprint, targetFingerprint } = req.body;
    if (!sourceFingerprint || !targetFingerprint) {
      return res.status(400).json({ success: false, error: 'Yêu cầu Fingerprint của bên Nguồn và bên Đích.' });
    }

    const db = store.read();
    const graph = WebOfTrustAnalyzer.buildTrustGraph(db.certificates, db.key_directory, db.ca_config);
    const pathResult = WebOfTrustAnalyzer.findTrustPath(graph, sourceFingerprint, targetFingerprint);

    res.json({ success: true, pathResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 9. SHAMIR'S SECRET SHARING (CA KEY SHARDING)
// ==========================================
app.post('/api/shamir/split', authorize('admin'), (req, res) => {
  try {
    const { secret, totalShares, threshold } = req.body;
    const n = parseInt(totalShares, 10) || 5;
    const k = parseInt(threshold, 10) || 3;

    // KỸ SƯ 2: Đã bỏ fallback passphrase hardcode. Nếu client không nhập bí mật
    // riêng thì chỉ được phân rã passphrase hệ thống trong thư mục môi trường
    // VÀ khi Root CA đang ở trạng thái UNSEALED (có phiên làm việc hợp lệ).
    let textToSplit = typeof secret === 'string' ? secret.trim() : '';
    let source = 'provided_secret';

    if (!textToSplit) {
      try {
        PgpService.requireUnsealed();
      } catch (sealErr) {
        return res.status(423).json({
          success: false,
          code: sealErr.code || 'CA_SEALED',
          error: 'Không có bí mật để phân rã. Hãy nhập secret, hoặc Unseal Root CA trước khi phân rã passphrase hệ thống.'
        });
      }
      textToSplit = process.env.CA_PASSPHRASE || '';
      if (!textToSplit) {
        return res.status(400).json({
          success: false,
          error: 'Biến môi trường CA_PASSPHRASE chưa được cấu hình nên không thể phân rã passphrase Root CA.'
        });
      }
      source = 'ca_passphrase_env';
    }

    const shares = ShamirSecretSharing.split(textToSplit, n, k);
    store.logAudit(
      'SHAMIR_KEY_SHARDING',
      'Security Officer',
      `Phân rã bí mật (nguồn: ${source}) thành ${n} mảnh với ngưỡng an toàn ${k}-of-${n}`
    );

    res.json({
      success: true,
      totalShares: n,
      threshold: k,
      encoding: 'envelope-v2',
      source,
      shares
    });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Lỗi phân rã Shamir: ' + err.message });
  }
});

app.post('/api/shamir/recover', authorize('admin'), (req, res) => {
  try {
    const { shares } = req.body;
    if (!shares || !Array.isArray(shares) || shares.length === 0) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp danh sách các mảnh khóa.' });
    }

    const recoveredSecret = ShamirSecretSharing.combine(shares);
    store.logAudit('SHAMIR_KEY_RECONSTRUCTION', 'Multi-Admin Quorum', `Tái tạo thành công bí mật CA từ ${shares.length} mảnh khóa hợp lệ`);

    res.json({
      success: true,
      recoveredSecret,
      sharesCount: shares.length
    });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Khôi phục bí mật thất bại: ' + err.message });
  }
});

// ==========================================
// 10. MERKLE TREE AUDIT TRAIL & INDEPENDENT PROOF
// ==========================================
app.get('/api/merkle/status', authorize('admin'), (req, res) => {
  try {
    const db = store.read();
    const tree = MerkleTreeEngine.buildTree(db.audit_logs);
    res.json({
      success: true,
      merkleRoot: tree.root,
      totalLeaves: tree.totalLeaves,
      layersCount: tree.layersCount
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/merkle/proof/:logId', authorize('admin'), (req, res) => {
  try {
    const { logId } = req.params;
    const db = store.read();
    const proof = MerkleTreeEngine.generateProof(db.audit_logs, logId);
    res.json({ success: true, proof });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/merkle/verify', authorize('admin'), (req, res) => {
  try {
    const { leafHash, proofPath, merkleRoot } = req.body;
    if (!leafHash || !proofPath || !merkleRoot) {
      return res.status(400).json({ success: false, error: 'Thiếu leafHash, proofPath hoặc merkleRoot.' });
    }

    const verification = MerkleTreeEngine.verifyProof(leafHash, proofPath, merkleRoot);
    res.json({ success: true, verification });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Lỗi thẩm định Merkle Proof: ' + err.message });
  }
});

// ==========================================
// 12. GLOBAL ERROR HANDLER (WORKSTREAM A)
// ==========================================
// Middleware auth (authorize/requireAuth) báo lỗi bằng next(err) với
// err.statusCode = 401/403. Không có error handler nào trước đây nên Express
// tự trả body HTML không kèm "code". Handler 4 tham số này đặt CUỐI danh sách
// route để mọi lỗi đi qua đúng handleServiceError -> JSON thống nhất
// { success:false, code, error } như các endpoint còn lại.
app.use((err, req, res, _next) => {
  if (res.headersSent) return;
  // Lỗi auth là lỗi client (401/403), không nên rơi vào nhánh 500.
  const fallback = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
  handleServiceError(res, err, fallback);
});

// Khởi chạy server và tự động init CA
async function start() {
  // Cảnh báo cấu hình auth ngay khi boot để không ai tưởng hệ thống đã được bảo vệ.
  if (isAuthDisabled()) {
    console.warn('⚠️  AUTH_DISABLED=true — MỌI endpoint đang mở công khai. CHỈ dùng cho demo cục bộ.');
  } else {
    const { table, warnings } = loadTokenTable();
    warnings.forEach(w => console.warn(`⚠️  Auth: ${w}`));
    const configured = table.map(t => t.role);
    if (configured.length === 0) {
      console.warn('⚠️  Chưa cấu hình AUTH_TOKEN_ADMIN/AUTH_TOKEN_EMPLOYEE/AUTH_TOKEN_PARTNER.');
      console.warn('⚠️  Mọi endpoint yêu cầu quyền sẽ trả 401 — hệ thống fail-closed.');
    } else {
      console.log(`🔐 Auth bật cho role: ${configured.join(', ')} (public luôn mở cho verify)`.replace('public, ', ''));
    }
  }

  // WORKSTREAM C: cho biết có đang lưu private key plaintext vào db.json không.
  logDemoKeyMode();

  await PgpService.initCA();
  app.listen(PORT, () => {
    console.log(`🚀 Enterprise CA & B2B Server is running on port ${PORT}`);
    console.log(`🌐 API available at http://localhost:${PORT}/api/ca/status`);
  });
}

start().catch(err => {
  console.error('Fatal error starting server:', err);
});
