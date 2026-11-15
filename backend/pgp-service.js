import * as openpgp from 'openpgp';
import crypto from 'crypto';
import { store } from './store.js';
import { ShamirSecretSharing } from './shamir-service.js';
import { writeShards, SHARD_DIR } from './quorum-shard-store.js';
import { isDemoPlaintextKeysEnabled } from './demo-mode.js';

/**
 * KỸ SƯ 2 — Quản trị Root CA & Quorum Protection
 *
 * Passphrase không còn hardcode trong mã nguồn. Server chỉ chạy được khi
 * biến môi trường CA_PASSPHRASE được nạp (ví dụ qua file .env không commit).
 * Nếu thiếu, thao tác khởi tạo/quản trị CA sẽ báo lỗi cấu hình thay vì dùng
 * một mật khẩu mặc định ai cũng biết.
 */
const CA_PASSPHRASE_ENV = 'CA_PASSPHRASE';

// Thời gian Unseal tối đa (mặc định 5 phút) trước khi CA tự động niêm phong lại
const UNSEAL_TTL_MS = Number(process.env.CA_UNSEAL_TTL_MS || 5 * 60 * 1000);

/**
 * Trạng thái phiên làm việc của Root CA. Chỉ tồn tại trong RAM của tiến trình,
 * không bao giờ ghi xuống đĩa.
 * @type {{ privateKey: object|null, unsealedAt: number|null, expiresAt: number|null, timer: any }}
 */
const caSession = {
  privateKey: null,
  unsealedAt: null,
  expiresAt: null,
  timer: null
};

function readCaPassphrase() {
  const value = process.env[CA_PASSPHRASE_ENV];
  if (!value || value.trim().length < 12) {
    throw new Error(
      `Biến môi trường ${CA_PASSPHRASE_ENV} chưa được cấu hình hoặc ngắn hơn 12 ký tự. ` +
      'Không dùng passphrase mặc định vì lý do an toàn.'
    );
  }
  return value;
}

export class PgpService {
  /**
   * Trạng thái niêm phong hiện tại của Root CA (dùng cho API /api/ca/status).
   */
  static getSealState() {
    const isUnsealed = Boolean(caSession.privateKey) && Date.now() < (caSession.expiresAt || 0);
    return {
      isSealed: !isUnsealed,
      unsealedAt: isUnsealed ? new Date(caSession.unsealedAt).toISOString() : null,
      expiresAt: isUnsealed ? new Date(caSession.expiresAt).toISOString() : null,
      ttlMs: UNSEAL_TTL_MS
    };
  }

  static sealCA(reason = 'manual') {
    if (caSession.timer) {
      clearTimeout(caSession.timer);
      caSession.timer = null;
    }
    caSession.privateKey = null;
    caSession.unsealedAt = null;
    caSession.expiresAt = null;
    try {
      store.logAudit('CA_SEAL', 'Security Officer', `Root CA đã được niêm phong lại (lý do: ${reason})`);
    } catch (_) {
      // store có thể chưa sẵn sàng trong ngữ cảnh test
    }
    return PgpService.getSealState();
  }

  static _armAutoSeal() {
    if (caSession.timer) clearTimeout(caSession.timer);
    caSession.timer = setTimeout(() => {
      PgpService.sealCA('auto-timeout');
    }, UNSEAL_TTL_MS);
    // Không giữ tiến trình sống chỉ vì timer này
    if (typeof caSession.timer.unref === 'function') caSession.timer.unref();
  }

  /**
   * Yêu cầu khóa riêng Root CA đã được Unseal. Ném lỗi 423 nếu chưa.
   */
  static requireUnsealed() {
    const state = PgpService.getSealState();
    if (state.isSealed) {
      const err = new Error('Root CA đang ở trạng thái SEALED. Cần tập hợp đủ mảnh Quorum và gọi /api/ca/unseal trước.');
      err.statusCode = 423;
      err.code = 'CA_SEALED';
      throw err;
    }
    return caSession.privateKey;
  }

  /**
   * Tái tạo passphrase CA từ các mảnh Shamir, giải mã khóa riêng và giữ trong RAM.
   * @param {string[]} shareKeys
   */
  static async unsealCA(shareKeys) {
    const sealed = PgpService.getSealState();
    if (!sealed.isSealed) {
      return { success: true, alreadyUnsealed: true, state: PgpService.getSealState() };
    }

    const db = store.read();
    const caConfig = db.ca_config;
    if (!caConfig || !caConfig.privateKeyArmored) {
      const err = new Error('Root CA chưa được khởi tạo hoặc không có khóa riêng để mở niêm phong.');
      err.statusCode = 409;
      throw err;
    }

    // Bước 1: Khôi phục passphrase từ Quorum (ngưỡng k được ghi trong từng mảnh)
    const recovered = ShamirSecretSharing.tryCombine(shareKeys);
    if (!recovered.ok) {
      const err = new Error(`Unseal thất bại: ${recovered.reason}`);
      err.statusCode = 400;
      throw err;
    }

    // Bước 2: Thử giải mã khóa riêng bằng passphrase vừa khôi phục
    let decryptedKey;
    try {
      decryptedKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: caConfig.privateKeyArmored }),
        passphrase: recovered.secret
      });
    } catch (e) {
      const err = new Error('Unseal thất bại: các mảnh khóa không tái tạo đúng passphrase của Root CA.');
      err.statusCode = 400;
      throw err;
    }

    caSession.privateKey = decryptedKey;
    caSession.unsealedAt = Date.now();
    caSession.expiresAt = Date.now() + UNSEAL_TTL_MS;
    PgpService._armAutoSeal();

    store.logAudit(
      'CA_UNSEAL',
      'Multi-Admin Quorum',
      `Root CA được Unseal bằng ${shareKeys.length} mảnh khóa, phiên làm việc ${Math.round(UNSEAL_TTL_MS / 1000)}s`
    );

    return { success: true, alreadyUnsealed: false, state: PgpService.getSealState() };
  }

  /**
   * Trả khóa riêng CA đã giải mã, ưu tiên phiên Unseal trong RAM.
   * Nếu CA đang SEALED thì từ chối (không fallback về passphrase môi trường cho
   * các thao tác quản trị, tránh vô hiệu hóa cơ chế Quorum).
   */
  static _getOperatingCaKey() {
    const state = PgpService.getSealState();
    if (!state.isSealed) return caSession.privateKey;

    const err = new Error('Root CA đang ở trạng thái SEALED. Cần gọi /api/ca/unseal với đủ mảnh Quorum trước khi thực hiện thao tác này.');
    err.statusCode = 423;
    err.code = 'CA_SEALED';
    throw err;
  }
  /**
   * Khởi tạo hoặc tải thông tin Corporate Root CA
   */
  static async initCA() {
    const db = store.read();
    if (db.ca_config && db.ca_config.publicKeyArmored) {
      console.log('✅ Corporate Root CA already initialized. Fingerprint:', db.ca_config.fingerprint);
      console.log('🔒 Root CA ở trạng thái SEALED — cần Quorum unseal trước khi cấp/thu hồi chứng chỉ.');
      return db.ca_config;
    }

    const passphrase = readCaPassphrase();

    console.log('⚡ Generating Corporate Root CA Master Keypair...');
    const caKey = await openpgp.generateKey({
      type: 'ecc',
      userIDs: [{
        name: 'Enterprise Corporate Root CA',
        email: 'ca-root@enterprise-security.internal'
      }],
      passphrase
    });

    const pubKey = await openpgp.readKey({ armoredKey: caKey.publicKey });
    const fingerprint = pubKey.getFingerprint();
    const keyID = pubKey.getKeyID().toHex().toUpperCase();
    const algorithm = pubKey.getAlgorithmInfo();
    const createdAt = pubKey.getCreationTime().toISOString();

    const caConfig = {
      name: 'Enterprise Corporate Root CA',
      email: 'ca-root@enterprise-security.internal',
      keyID,
      fingerprint,
      algorithm: algorithm.algorithm || 'Ed25519',
      createdAt,
      expiresAt: 'Never (Corporate Master)',
      publicKeyArmored: caKey.publicKey,
      privateKeyArmored: caKey.privateKey,
      revocationCertificateArmored: caKey.revocationCertificate
    };

    // Lưu ý kiến trúc: khóa riêng vẫn nằm trong db.json (đã mã hóa bằng passphrase
    // trong envelope OpenPGP của openpgp.js, KHÔNG phải plaintext), và CA khởi động
    // luôn ở trạng thái SEALED. Muốn sử dụng phải Unseal bằng Quorum.
    caConfig.isSealed = true;

    db.ca_config = caConfig;

    // Tự động sinh bộ mảnh Quorum mặc định (3-of-5) ngay sau khi khởi tạo,
    // để nhóm có thể bàn giao mảnh cho các Quản trị viên An ninh.
    //
    // WORKSTREAM B: mảnh được ghi ra FILE RIÊNG (0600) trong
    // backend/data/quorum-shards/ — KHÔNG chỉ in console (mất khi đóng terminal)
    // và KHÔNG lưu vào db.json. Thư mục này nằm trong .gitignore.
    try {
      const quorumShares = ShamirSecretSharing.split(passphrase, 5, 3);
      const writtenFiles = writeShards(quorumShares);
      console.warn('');
      console.warn('='.repeat(78));
      console.warn('🚨 BỘ MẢNH QUORUM 3-OF-5 ĐÃ ĐƯỢC GHI XUỐNG ĐĨA — XỬ LÝ NGAY');
      console.warn('='.repeat(78));
      console.warn(`Thư mục: ${SHARD_DIR}`);
      writtenFiles.forEach((f) => console.warn(`   ${f.fileName}  ->  ${f.holderRole}`));
      console.warn('');
      console.warn('BẮT BUỘC:');
      console.warn('  1. Bàn giao MỖI mảnh cho MỘT NGƯỜI GIỮ KHÁC NHAU (5 người).');
      console.warn('  2. Không gửi mảnh qua email/chat/ticket.');
      console.warn('  3. Bàn giao xong thì XÓA thư mục trên khỏi server:');
      console.warn('       rmdir /s /q backend\\data\\quorum-shards   (Windows)');
      console.warn('       rm -rf backend/data/quorum-shards          (Linux/macOS)');
      console.warn('  4. Mất >= 3 mảnh = mất vĩnh viễn khả năng unseal Root CA.');
      console.warn('='.repeat(78));
      console.warn('');
    } catch (shareErr) {
      console.error('❌ Không sinh/ghi được bộ mảnh Quorum:', shareErr.message);
      console.error('   Root CA vẫn đã được tạo nhưng sẽ KHÔNG thể unseal nếu không có mảnh.');
    }

    // Seed initial Enterprise Key Directory with CA key itself
    db.key_directory = [
      {
        id: 'key_ca_root',
        organizationName: 'Tập đoàn An ninh Doanh nghiệp (Internal CA)',
        contactName: 'Corporate Security Officer',
        contactEmail: 'ca-root@enterprise-security.internal',
        department: 'Trung tâm Chứng thực CA Gốc',
        keyType: 'internal_ca',
        fingerprint,
        keyID,
        publicKeyArmored: caKey.publicKey,
        trustLevel: 'corporate_root',
        isCA: true,
        notes: 'Khóa gốc tin cậy tối cao (Root of Trust) của toàn bộ doanh nghiệp.',
        createdAt: new Date().toISOString()
      }
    ];

    store.write(db);
    store.logAudit('INIT_ROOT_CA', 'System Boot', `Khởi tạo Corporate Root CA thành công với KeyID: ${keyID}`);

    // Seed initial employees & external partners for immediate demonstration
    await PgpService.seedSampleData(caConfig);

    return caConfig;
  }

  /**
   * Tạo dữ liệu mẫu thực tế cho doanh nghiệp (Cán bộ nội bộ + Đối tác B2B)
   */
  static async seedSampleData(caConfig) {
    try {
      console.log('🌱 Seeding demo corporate certificates and B2B partners...');

      // 1. Tạo chứng chỉ cho Kế toán trưởng
      await PgpService.issueCertificate({
        name: 'Nguyễn Văn An',
        email: 'an.nguyen@enterprise.internal',
        department: 'Phòng Kế toán & Tài chính',
        role: 'Kế toán trưởng',
        validityDays: 365,
        notes: 'Cấp chữ ký số để duyệt chi ngân sách và hóa đơn điện tử',
        _bypassSeal: true
      });

      // 2. Tạo chứng chỉ cho Giám đốc Pháp chế
      await PgpService.issueCertificate({
        name: 'Trần Thị Mai',
        email: 'mai.tran@enterprise.internal',
        department: 'Ban Pháp chế & Tuân thủ',
        role: 'Trưởng ban Pháp chế',
        validityDays: 365,
        notes: 'Ký số hợp đồng thương mại và văn bản pháp lý',
        _bypassSeal: true
      });

      // 3. Tạo một đối tác doanh nghiệp ngoài (External B2B Partner: FINCORP)
      const partnerKey = await openpgp.generateKey({
        type: 'ecc',
        userIDs: [{
          name: 'Đối tác Tài chính FINCORP JSC',
          email: 'b2b-gateway@fincorp.partner'
        }]
      });
      const partnerPub = await openpgp.readKey({ armoredKey: partnerKey.publicKey });

      const db = store.read();
      db.key_directory.push({
        id: 'partner_fincorp',
        organizationName: 'Tập đoàn Tài chính & Ngân hàng FINCORP',
        contactName: 'Trưởng phòng Hợp tác B2B',
        contactEmail: 'b2b-gateway@fincorp.partner',
        department: 'Cổng giao dịch B2B Đối ngoại',
        keyType: 'external_partner',
        fingerprint: partnerPub.getFingerprint(),
        keyID: partnerPub.getKeyID().toHex().toUpperCase(),
        publicKeyArmored: partnerKey.publicKey,
        // WORKSTREAM C: khóa riêng demo (plaintext) chỉ lưu khi DEMO_PLAINTEXT_KEYS=1.
        // Mặc định KHÔNG ghi gì vào db.json.
        ...(isDemoPlaintextKeysEnabled() ? { privateKeyArmoredDemo: partnerKey.privateKey } : {}),
        trustLevel: 'verified_partner',
        isCA: false,
        notes: 'Đối tác cung ứng vốn và dịch vụ thanh toán quốc tế đã xác thực danh tính.',
        createdAt: new Date().toISOString()
      });

      // 4. Tạo một tin nhắn mẫu B2B an toàn giữa Enterprise và FINCORP
      //    Dùng khóa riêng CA vừa sinh trong phiên khởi tạo (không đọc lại từ đĩa),
      //    nên không cần Unseal cho bước seed.
      const caPrivKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: caConfig.privateKeyArmored }),
        passphrase: readCaPassphrase()
      });

      const sampleMsgText = JSON.stringify({
        title: 'Xác nhận hạn mức tín dụng dự án Q3/2026',
        content: 'Kính gửi Ban Điều Hành Enterprise, Chúng tôi xin xác nhận phê duyệt hạn mức tín dụng 20,000,000 USD cho giai đoạn nâng cấp hạ tầng số bảo mật PGP.',
        contractNumber: 'HD-B2B-2026/FIN-ENT-8899',
        amount: '20,000,000 USD',
        effectiveDate: '2026-10-01'
      }, null, 2);

      const encryptedArmored = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: sampleMsgText }),
        encryptionKeys: [await openpgp.readKey({ armoredKey: caConfig.publicKeyArmored })],
        signingKeys: [await openpgp.readPrivateKey({ armoredKey: partnerKey.privateKey })]
      });

      db.b2b_messages.push({
        id: 'msg_demo_01',
        senderOrg: 'Tập đoàn Tài chính & Ngân hàng FINCORP',
        senderEmail: 'b2b-gateway@fincorp.partner',
        senderKeyID: partnerPub.getKeyID().toHex().toUpperCase(),
        recipientOrg: 'Tập đoàn An ninh Doanh nghiệp',
        recipientEmail: 'ca-root@enterprise-security.internal',
        recipientKeyID: caConfig.keyID,
        subject: '[MẬT & KÝ SỐ] Xác nhận hạn mức tín dụng dự án Q3/2026',
        encryptedPayloadArmored: encryptedArmored,
        sentAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        isRead: false
      });

      store.write(db);
      console.log('✅ Demo data seeded successfully.');
    } catch (err) {
      console.error('Error seeding demo data:', err);
    }
  }

  /**
   * Cấp chứng chỉ khóa OpenPGP cho nhân viên/phòng ban
   * Hỗ trợ 2 luồng:
   *  - Luồng 1: Người dùng tự tạo cặp khóa rồi nộp Public Key (CSR)
   *  - Luồng 2: CA sinh cặp khóa hộ và ký chứng thực (Corporate Certified Key)
   */
  static async issueCertificate({
    name,
    email,
    department,
    role,
    validityDays = 365,
    customPublicKeyArmored = null,
    notes = '',
    _bypassSeal = false
  }) {
    const db = store.read();
    const caConfig = db.ca_config;
    if (!caConfig) throw new Error('CA chưa được khởi tạo.');

    // KỸ SƯ 2: Cổng Quorum. Chỉ được ký cấp chứng chỉ khi CA đã được Unseal.
    // Luồng seed nội bộ ngay sau khi khởi tạo truyền _bypassSeal=true vì
    // khóa riêng vừa được sinh trong cùng phiên.
    let caPrivKey;
    if (_bypassSeal) {
      caPrivKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: caConfig.privateKeyArmored }),
        passphrase: readCaPassphrase()
      });
    } else {
      caPrivKey = PgpService._getOperatingCaKey();
    }

    let generatedPrivateKeyArmored = null;
    let generatedRevocationCertificateArmored = null;
    let targetPublicKeyArmored = customPublicKeyArmored;

    if (!targetPublicKeyArmored) {
      // CA sinh cặp khóa mới
      const userKeypair = await openpgp.generateKey({
        type: 'ecc',
        userIDs: [{ name, email }]
      });
      targetPublicKeyArmored = userKeypair.publicKey;
      generatedPrivateKeyArmored = userKeypair.privateKey;
      // KỸ SƯ 2: openpgp v6 CHỈ sinh revocation certificate tại thời điểm generateKey
      // (Packet Tag 2). Nếu bỏ qua đây thì KHÔNG THỂ sinh lại sau này, vì
      // getRevocationCertificate() trên key đã parse lại sẽ ném
      // "Could not find valid key revocation signature in key <id>".
      // Vì vậy phải lưu ngay vào chứng chỉ để phục vụ thu hồi về sau.
      generatedRevocationCertificateArmored = userKeypair.revocationCertificate || null;
    }

    // Đọc public key của user
    const userPubKey = await openpgp.readKey({ armoredKey: targetPublicKeyArmored });
    const fingerprint = userPubKey.getFingerprint();
    const keyID = userPubKey.getKeyID().toHex().toUpperCase();
    const algorithm = userPubKey.getAlgorithmInfo().algorithm || 'Ed25519';

    // CA thực hiện Corporate Certification Signature (ký lên danh tính Primary User)
    const certifiedPubKey = await userPubKey.signPrimaryUser([caPrivKey]);
    const certifiedArmored = certifiedPubKey.armor();

    const certId = 'cert_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

    const certRecord = {
      id: certId,
      name,
      email,
      department,
      role,
      fingerprint,
      keyID,
      algorithm,
      issuedAt,
      expiresAt,
      status: 'active', // active | revoked
      caIssuer: caConfig.name,
      caKeyID: caConfig.keyID,
      certifiedPublicKeyArmored: certifiedArmored,
      originalPublicKeyArmored: targetPublicKeyArmored,
      // Revocation certificate sinh sẵn lúc tạo khóa (chỉ có khi CA tự sinh khóa).
      revocationCertificateArmored: generatedRevocationCertificateArmored || null,
      // WORKSTREAM C: trước đây luôn ghi khóa riêng PLAINTEXT vào db.json.
      // Nay chỉ ghi khi DEV-ONLY flag bật; mặc định field không tồn tại.
      ...(isDemoPlaintextKeysEnabled() ? { demoPrivateKeyArmored: generatedPrivateKeyArmored } : {}),
      notes: notes || 'Chứng chỉ chữ ký số nội bộ cấp bởi Corporate CA'
    };

    db.certificates.unshift(certRecord);

    // Đồng bộ vào Enterprise Key Directory
    const existingIndex = db.key_directory.findIndex(k => k.fingerprint === fingerprint);
    const directoryEntry = {
      id: 'dir_' + certId,
      organizationName: 'Nội bộ Doanh nghiệp',
      contactName: name,
      contactEmail: email,
      department,
      keyType: 'internal_employee',
      fingerprint,
      keyID,
      publicKeyArmored: certifiedArmored,
      ...(isDemoPlaintextKeysEnabled() ? { demoPrivateKeyArmored: generatedPrivateKeyArmored } : {}),
      trustLevel: 'corporate_certified',
      isCA: false,
      notes: `${role} - ${department}`,
      createdAt: issuedAt
    };

    if (existingIndex >= 0) {
      db.key_directory[existingIndex] = directoryEntry;
    } else {
      db.key_directory.push(directoryEntry);
    }

    store.write(db);
    store.logAudit(
      'ISSUE_CERTIFICATE',
      'Corporate CA Administrator',
      `Cấp chứng chỉ OpenPGP cho [${name}] <${email}> (${role}, ${department}) - KeyID: ${keyID}`
    );

    return certRecord;
  }

  /**
   * Thu hồi chứng chỉ (Revocation)
   */
  static async revokeCertificate(certId, reason = 'Khóa bị lộ hoặc nhân viên điều chuyển công tác') {
    const db = store.read();
    const cert = db.certificates.find(c => c.id === certId);
    if (!cert) throw new Error('Không tìm thấy chứng chỉ với ID này.');

    if (cert.status === 'revoked') {
      throw new Error('Chứng chỉ này đã bị thu hồi trước đó.');
    }

    // KỸ SƯ 2: Thu hồi là thao tác quản trị nhạy cảm — bắt buộc CA đã Unseal.
    // Gọi _getOperatingCaKey() ở đây mang tính "cổng quorum": nó ném CA_SEALED khi
    // Root CA đang niêm phong. Khóa trả về không dùng để ký vì openpgp v6 không hỗ trợ
    // ký revocation certificate bằng khóa bên thứ ba (xem giải thích bên dưới).
    PgpService._getOperatingCaKey();

    // Thu hồi khóa theo RFC 4880 — CHỈ dùng API thực sự tồn tại trong openpgp v6.3.2.
    //
    // Hạn chế đã kiểm chứng bằng thực nghiệm (xem analysis bên dưới):
    //   - openpgp v6 KHÔNG export createRevocationCertificate().
    //   - getRevocationCertificate() chỉ dùng được trên đối tượng khóa ngay trong
    //     phiên generateKey(); sau khi đóng gói armor rồi readKey lại thì ném
    //     "Could not find valid key revocation signature in key <id>".
    //   - vì vậy certificate (Packet Tag 2) phải được sinh SẴN lúc generateKey và
    //     lưu trong chứng chỉ (trường revocationCertificateArmored).
    //
    // Ở đây ta thực hiện 2 việc tách biệt:
    //   (1) Sinh trạng thái khóa ĐÃ THU HỒI bằng revokeKey() trên private key
    //       (openpgp giải mã được khóa demo nếu CA tự sinh) -> isRevoked() = true.
    //   (2) Đính kèm revocation certificate đã lưu sẵn để có thể phân phối công khai.
    // Nếu không có private key (khóa do người dùng tự sinh/nhập), chỉ bước (2) chạy.
    let revocationCertificateArmored = cert.revocationCertificateArmored || null;
    let revokedPublicKeyArmored = null;
    let revocationError = null;

    try {
      const employeeKey = await openpgp.readKey({
        armoredKey: cert.certifiedPublicKeyArmored || cert.originalPublicKeyArmored
      });

      // (2) Xác minh certificate lưu sẵn thực sự áp dụng được lên khóa này.
      if (revocationCertificateArmored) {
        const applied = await employeeKey.applyRevocationCertificate(
          revocationCertificateArmored,
          new Date(),
          openpgp.config
        );
        revokedPublicKeyArmored = applied.toPublic().armor();
      }

      // (1) Nếu có private key demo thì sinh luôn trạng thái khóa bị thu hồi.
      if (cert.demoPrivateKeyArmored) {
        const employeePrivKey = await openpgp.readPrivateKey({ armoredKey: cert.demoPrivateKeyArmored });
        const revoked = await openpgp.revokeKey({
          key: employeePrivKey,
          reasonForRevocation: {
            flag: openpgp.enums.reasonForRevocation.keyCompromised,
            string: reason
          },
          format: 'armored'
        });
        revokedPublicKeyArmored = typeof revoked === 'string' ? revoked : revoked.publicKey;
      }
    } catch (e) {
      revocationError = e.message;
    }

    cert.status = 'revoked';
    cert.revokedAt = new Date().toISOString();
    cert.revocationReason = reason;
    cert.revocationSignatureArmored = revocationCertificateArmored;
    cert.revokedPublicKeyArmored = revokedPublicKeyArmored;
    if (revocationError) cert.revocationSignatureError = revocationError;

    // Cập nhật trạng thái trong Directory
    const dirEntry = db.key_directory.find(k => k.fingerprint === cert.fingerprint);
    if (dirEntry) {
      dirEntry.trustLevel = 'revoked';
      dirEntry.notes = `[ĐÃ THU HỒI]: ${reason}`;
    }

    store.write(db);
    store.logAudit(
      'REVOKE_CERTIFICATE',
      'Corporate CA Administrator',
      `Thu hồi chứng chỉ [${cert.name}] (${cert.keyID}). Lý do: ${reason}`,
      'WARNING'
    );

    return cert;
  }

  /**
   * Ký số tài liệu / văn bản (Clearsign hoặc Detached Binary Signature)
   */
  static async signDocument({
    documentName,
    contentBuffer,
    isText = true,
    signerKeyID,
    signerPrivateKeyArmored,
    passphrase = ''
  }) {
    if (!signerPrivateKeyArmored) {
      throw new Error('Cần cung cấp Private Key của người ký để thực hiện ký số.');
    }

    let privKey = await openpgp.readPrivateKey({ armoredKey: signerPrivateKeyArmored });
    if (passphrase) {
      privKey = await openpgp.decryptKey({ privateKey: privKey, passphrase });
    }

    const fileHash = crypto.createHash('sha256').update(contentBuffer).digest('hex');
    let signatureArmored = '';
    let signType = '';

    if (isText) {
      // Inline Clearsigned Message
      const text = contentBuffer.toString('utf-8');
      const clearMessage = await openpgp.createCleartextMessage({ text });
      signatureArmored = await openpgp.sign({
        message: clearMessage,
        signingKeys: privKey
      });
      signType = 'clearsigned';
    } else {
      // Detached Binary Signature
      const binaryMessage = await openpgp.createMessage({ binary: new Uint8Array(contentBuffer) });
      signatureArmored = await openpgp.sign({
        message: binaryMessage,
        signingKeys: privKey,
        detached: true
      });
      signType = 'detached_signature';
    }

    const signerPubKey = privKey.toPublic();
    const keyID = signerPubKey.getKeyID().toHex().toUpperCase();
    const primaryUser = await signerPubKey.getPrimaryUser();
    const signerUser = primaryUser?.user?.userId?.userid || keyID;

    const docRecord = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      documentName,
      fileHash,
      fileSize: contentBuffer.length,
      signType,
      signerKeyID: keyID,
      signerUser,
      signedAt: new Date().toISOString(),
      signatureArmored
    };

    const db = store.read();
    db.signed_documents.unshift(docRecord);
    store.write(db);

    store.logAudit(
      'SIGN_DOCUMENT',
      signerUser,
      `Ký số tài liệu [${documentName}] (${signType}) bằng KeyID ${keyID}`
    );

    return docRecord;
  }

  /**
   * Xác minh chữ ký số của tài liệu / văn bản kèm theo kiểm tra Corporate CA Chain of Trust
   */
  static async verifyDocument({
    contentBuffer,
    isText = false,
    signatureArmored,
    signerPublicKeyArmored
  }) {
    const db = store.read();
    const caConfig = db.ca_config;
    const caPubKey = await openpgp.readKey({ armoredKey: caConfig.publicKeyArmored });

    let signerPubKey;
    if (signerPublicKeyArmored) {
      signerPubKey = await openpgp.readKey({ armoredKey: signerPublicKeyArmored });
    } else {
      throw new Error('Cần cung cấp Public Key của người ký để đối chiếu xác thực.');
    }

    let isContentValid = false;
    let signatureDate = null;
    let keyID = signerPubKey.getKeyID().toHex().toUpperCase();

    // 1. Kiểm tra chữ ký đối với nội dung
    try {
      if (signatureArmored.includes('-----BEGIN PGP SIGNED MESSAGE-----')) {
        // Clearsigned text
        const clearMsg = await openpgp.readCleartextMessage({ cleartextMessage: signatureArmored });
        const verifs = await openpgp.verify({
          message: clearMsg,
          verificationKeys: signerPubKey
        });
        const isValid = await verifs.signatures[0].verified;
        isContentValid = isValid;
        signatureDate = (await verifs.signatures[0].signature).packets[0]?.created || new Date();
      } else {
        // Detached signature
        const detachedSig = await openpgp.readSignature({ armoredSignature: signatureArmored });
        const binaryMsg = await openpgp.createMessage({ binary: new Uint8Array(contentBuffer) });
        const verifs = await openpgp.verify({
          message: binaryMsg,
          signature: detachedSig,
          verificationKeys: signerPubKey
        });
        const isValid = await verifs.signatures[0].verified;
        isContentValid = isValid;
        signatureDate = (await verifs.signatures[0].signature).packets[0]?.created || new Date();
      }
    } catch (verifyErr) {
      return {
        isValid: false,
        error: 'Chữ ký không khớp với nội dung tài liệu hoặc dữ liệu đã bị sửa đổi: ' + verifyErr.message
      };
    }

    if (!isContentValid) {
      return {
        isValid: false,
        error: 'Chữ ký số không hợp lệ. Tài liệu có dấu hiệu bị giả mạo hoặc chỉnh sửa!'
      };
    }

    // 2. Kiểm tra Corporate CA Chain of Trust: Xem khóa người ký có được CA chứng nhận hay không
    let isCertifiedByCA = false;
    let caCheckDetail = 'Khóa công khai tự ký (Self-signed), không có chứng thực từ Corporate Root CA.';

    try {
      const caVerifs = await signerPubKey.verifyPrimaryUser([caPubKey]);
      const validCaSig = caVerifs.find(v => v.valid === true);
      if (validCaSig) {
        isCertifiedByCA = true;
        caCheckDetail = `Được chứng thực hợp lệ bởi ${caConfig.name} (KeyID: ${caConfig.keyID})`;
      }
    } catch (e) {
      // CA signature verification failed or not present
    }

    // 3. Kiểm tra danh bạ & trạng thái thu hồi
    const certRecord = db.certificates.find(c => c.fingerprint === signerPubKey.getFingerprint());
    const isRevoked = certRecord?.status === 'revoked';

    const primaryUser = await signerPubKey.getPrimaryUser();
    const signerIdentity = primaryUser?.user?.userId?.userid || keyID;

    store.logAudit(
      'VERIFY_DOCUMENT',
      'Document Verifier',
      `Xác thực tài liệu thành công. Người ký: ${signerIdentity} (KeyID: ${keyID}) - CA Certified: ${isCertifiedByCA}`
    );

    return {
      isValid: true,
      signerIdentity,
      signerKeyID: keyID,
      signerFingerprint: signerPubKey.getFingerprint(),
      signatureDate,
      isCertifiedByCA,
      caCheckDetail,
      isRevoked,
      revocationReason: certRecord?.revocationReason || null
    };
  }

  /**
   * B2B: Gửi tin nhắn an toàn (Mã hóa bằng Public Key người nhận + Ký bằng Private Key người gửi)
   */
  static async sendB2BMessage({
    senderOrg,
    senderEmail,
    senderPrivateKeyArmored,
    senderPassphrase = '',
    senderIsCA = false,
    recipientOrg,
    recipientEmail,
    recipientPublicKeyArmored,
    subject,
    content
  }) {
    let senderPriv;
    if (senderIsCA) {
      // Kỹ sư 2: ký bằng khóa Root CA chỉ khi phiên đã UNSEALED, không dùng passphrase từ client.
      senderPriv = PgpService._getOperatingCaKey();
    } else {
      if (!senderPrivateKeyArmored) {
        throw new Error('Thiếu Private Key của bên gửi để ký số.');
      }
      senderPriv = await openpgp.readPrivateKey({ armoredKey: senderPrivateKeyArmored });
      if (senderPassphrase) {
        senderPriv = await openpgp.decryptKey({ privateKey: senderPriv, passphrase: senderPassphrase });
      }
    }
    const senderPub = senderPriv.toPublic();
    const recipientPub = await openpgp.readKey({ armoredKey: recipientPublicKeyArmored });

    const msgPayload = JSON.stringify({
      subject,
      body: content,
      sentTimestamp: new Date().toISOString()
    });

    const encryptedArmored = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: msgPayload }),
      encryptionKeys: recipientPub,
      signingKeys: senderPriv
    });

    const msgId = 'b2b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const messageRecord = {
      id: msgId,
      senderOrg,
      senderEmail,
      senderKeyID: senderPub.getKeyID().toHex().toUpperCase(),
      senderFingerprint: senderPub.getFingerprint(),
      recipientOrg,
      recipientEmail,
      recipientKeyID: recipientPub.getKeyID().toHex().toUpperCase(),
      subject,
      encryptedPayloadArmored: encryptedArmored,
      sentAt: new Date().toISOString(),
      isRead: false
    };

    const db = store.read();
    db.b2b_messages.unshift(messageRecord);
    store.write(db);

    store.logAudit(
      'SEND_B2B_MESSAGE',
      senderEmail,
      `Gửi tin nhắn mã hóa E2E & Ký số từ [${senderOrg}] tới [${recipientOrg}] - Tiêu đề: "${subject}"`
    );

    return messageRecord;
  }

  /**
   * B2B: Giải mã tin nhắn và kiểm tra tính xác thực chữ ký của đối tác gửi
   */
  static async decryptB2BMessage({
    encryptedPayloadArmored,
    recipientPrivateKeyArmored,
    recipientPassphrase = '',
    recipientIsCA = false,
    senderPublicKeyArmored
  }) {
    let recipientPriv;
    if (recipientIsCA) {
      // Kỹ sư 2: giải mã bằng khóa Root CA trong phiên RAM, không nhận khóa/passphrase từ client.
      recipientPriv = PgpService._getOperatingCaKey();
    } else {
      if (!recipientPrivateKeyArmored) {
        throw new Error('Thiếu Private Key của bên nhận để giải mã.');
      }
      recipientPriv = await openpgp.readPrivateKey({ armoredKey: recipientPrivateKeyArmored });
      if (recipientPassphrase) {
        recipientPriv = await openpgp.decryptKey({ privateKey: recipientPriv, passphrase: recipientPassphrase });
      }
    }

    const senderPub = await openpgp.readKey({ armoredKey: senderPublicKeyArmored });
    const message = await openpgp.readMessage({ armoredMessage: encryptedPayloadArmored });

    const { data: decryptedText, signatures } = await openpgp.decrypt({
      message,
      decryptionKeys: recipientPriv,
      verificationKeys: senderPub
    });

    let isSignatureValid = false;
    if (signatures && signatures.length > 0) {
      isSignatureValid = await signatures[0].verified;
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(decryptedText);
    } catch {
      parsedContent = { body: decryptedText };
    }

    return {
      success: true,
      decryptedContent: parsedContent,
      isSignatureValid,
      signerKeyID: senderPub.getKeyID().toHex().toUpperCase(),
      signerFingerprint: senderPub.getFingerprint()
    };
  }
}
