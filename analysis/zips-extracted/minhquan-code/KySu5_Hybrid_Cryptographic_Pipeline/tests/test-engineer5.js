/**
 * @file tests/test-engineer5.js
 * @description Bộ kiểm thử tự động & Diễn tập Red Team cho Phân hệ Kỹ sư 5:
 *  Test 1: Tạo cặp khóa Ed25519 / X25519 (RFC 9580 / ECC) cho Alice, Bob và kẻ tấn công Charlie
 *  Test 2: Pipeline Sign-then-Encrypt hợp lệ (Alice -> Bob)
 *  Test 3: Diễn tập Red Team - Tấn công Surreptitious Forwarding (Bob giải mã, bọc lại gửi cho Charlie -> Charlie phát hiện Subpacket 35 không khớp!)
 *  Test 4: Chuẩn hóa Clearsign RFC 4880 (CRLF, Trailing spaces, Dash-escaping)
 *  Test 5: Ký số Streaming Detached Signature & Thẩm tra Zero-Disk trên tệp nhị phân 25MB (RAM < 50MB)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const openpgp = require('openpgp');
const pgpService = require('../backend/pgp-service');

async function generateUserKeys(name, email, passphrase) {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'ed25519',
    userIDs: [{ name, email }],
    passphrase,
    format: 'armored',
  });
  return { privateKey, publicKey };
}

async function runAllTests() {
  console.log('=================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ PHÂN HỆ KỸ SƯ 5: HYBRID CRYPTOGRAPHIC PIPELINE');
  console.log('=================================================================\n');

  // 1. Khởi tạo khóa cho Alice, Bob, Charlie
  console.log('[1/5] Khởi tạo cặp khóa Ed25519/Curve25519 cho Alice, Bob và Charlie...');
  const alice = await generateUserKeys('Alice Enterprise', 'alice@corp-a.vn', 'AlicePass@2026');
  const bob = await generateUserKeys('Bob Partner', 'bob@corp-b.vn', 'BobPass@2026');
  const charlie = await generateUserKeys('Charlie Attacker', 'charlie@evil.vn', 'CharliePass@2026');
  console.log('  -> Khởi tạo khóa thành công!\n');

  // 2. Test Sign-then-Encrypt hợp lệ từ Alice gửi Bob
  console.log('[2/5] Kiểm thử Pipeline Sign-then-Encrypt (Alice -> Bob)...');
  const secretContract = 'HỢP ĐỒNG B2B MẬT: Chuyển khoản 500,000 USD cho Bob Partner.';
  const encryptedPkg = await pgpService.signAndEncryptB2B(
    secretContract,
    alice.privateKey,
    'AlicePass@2026',
    bob.publicKey
  );
  console.log('  -> Metadata:', JSON.stringify(encryptedPkg.pipelineMetadata));

  const bobResult = await pgpService.decryptAndVerifyB2B(
    encryptedPkg.encryptedMessage,
    bob.privateKey,
    'BobPass@2026',
    alice.publicKey
  );
  assert.strictEqual(bobResult.verified, true);
  assert.strictEqual(bobResult.data, secretContract);
  assert.strictEqual(bobResult.subpacket35Verified, true);
  console.log('  -> Bob giải mã & xác thực Subpacket 35 thành công!\n');

  // 3. Red Team: Tấn công Surreptitious Forwarding (Don Davis Attack)
  console.log('[3/5] Diễn tập Red Team: Tấn công Surreptitious Forwarding (Bob chuyển tiếp mạo danh Alice cho Charlie)...');
  // Kịch bản: Bob trích xuất gói tin đã ký của Alice và mã hóa lại bằng Public Key của Charlie
  const aliceSignedOnly = await openpgp.sign({
    message: await openpgp.createMessage({ text: secretContract }),
    signingKeys: await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: alice.privateKey }),
      passphrase: 'AlicePass@2026',
    }),
    // Giả lập chữ ký cũ của Alice ban đầu chỉ định người nhận là Bob
    signatureNotations: [],
  });

  // Dùng gói tin gốc mà Alice đã ký riêng cho Bob (chứa Subpacket 35 = Bob)
  // Giả sử Bob bóc lớp mã hóa ngoài (Outer Encryption) để lấy Signed Packet của Alice và bọc lại cho Charlie:
  const origMsg = await openpgp.readMessage({ armoredMessage: encryptedPkg.encryptedMessage });
  const decryptedRaw = await openpgp.decrypt({
    message: origMsg,
    decryptionKeys: await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: bob.privateKey }),
      passphrase: 'BobPass@2026',
    }),
    format: 'binary',
  });
  // Bob mã hóa lại gói tin chứa chữ ký của Alice cho Charlie
  const forwardedToCharlie = await openpgp.encrypt({
    message: await openpgp.createMessage({ binary: decryptedRaw.data }),
    encryptionKeys: await openpgp.readKey({ armoredKey: charlie.publicKey }),
    format: 'armored',
  });

  let attackBlocked = false;
  try {
    await pgpService.decryptAndVerifyB2B(
      forwardedToCharlie,
      charlie.privateKey,
      'CharliePass@2026',
      alice.publicKey
    );
  } catch (err) {
    attackBlocked = err.message.includes('Surreptitious Forwarding');
    console.log('  -> [CHẶN THÀNH CÔNG]:', err.message);
  }
  assert.strictEqual(attackBlocked, true, 'Hệ thống phải chặn được tấn công Surreptitious Forwarding!');
  console.log('  -> Xác nhận: Subpacket 35 triệt tiêu hoàn toàn tấn công chuyển tiếp mạo danh!\n');

  // 4. Test Chuẩn hóa Clearsign RFC 4880
  console.log('[4/5] Kiểm thử chuẩn hóa Clearsign RFC 4880 (CRLF, Trailing Spaces, Dash-escaping)...');
  const trickyText = 'Điều 1: Cam kết bảo mật   \n- Khoản A: Không tiết lộ khóa\t\t\n- Khoản B: Tuân thủ RFC 4880';
  const canonical = pgpService.canonicalizeClearsignText(trickyText);
  assert.ok(canonical.includes('- - Khoản A: Không tiết lộ khóa\r\n'));
  const clearsigned = await pgpService.createClearsignedMessage(
    trickyText,
    alice.privateKey,
    'AlicePass@2026'
  );
  const clearVerify = await pgpService.verifyClearsignedMessage(clearsigned, alice.publicKey);
  assert.strictEqual(clearVerify.valid, true);
  console.log('  -> Clearsign RFC 4880 chuẩn hóa và xác thực thành công!\n');

  // 5. Test Streaming Detached Signature & Zero-Disk Verifier (Tệp 25MB)
  console.log('[5/5] Kiểm thử Streaming Detached Signature & Zero-Disk Verifier (Tệp giả lập 25MB)...');
  const tmpFile = path.join(__dirname, 'sample_large_contract.bin');
  // Ghi tệp 25MB ngẫu nhiên
  const writeStream = fs.createWriteStream(tmpFile);
  const chunk1MB = crypto.randomBytes(1024 * 1024);
  for (let i = 0; i < 25; i++) {
    writeStream.write(chunk1MB);
  }
  await new Promise((resolve) => writeStream.end(resolve));

  const streamSignRes = await pgpService.createDetachedStreamSignature(
    tmpFile,
    alice.privateKey,
    'AlicePass@2026'
  );
  console.log('  -> Telemetry Ký Stream:', JSON.stringify(streamSignRes.telemetry));
  assert.strictEqual(streamSignRes.telemetry.memoryBudgetCompliant, true);

  // Thẩm tra Zero-Disk bằng ReadStream
  const readStreamForVerify = fs.createReadStream(tmpFile, { highWaterMark: 64 * 1024 });
  const verifyStreamRes = await pgpService.verifyDetachedStreamZeroDisk(
    readStreamForVerify,
    streamSignRes.detachedSignature,
    alice.publicKey
  );
  console.log('  -> Telemetry Thẩm tra Zero-Disk:', JSON.stringify(verifyStreamRes));
  assert.strictEqual(verifyStreamRes.valid, true);

  // Dọn dẹp tệp test
  fs.unlinkSync(tmpFile);

  console.log('\n=================================================================');
  console.log('TẤT CẢ 5 BÀI KIỂM THỬ KỸ SƯ 5 ĐỀU VƯỢT QUA XUẤT SẮC (100% PASS)!');
  console.log('=================================================================');
}

runAllTests().catch((err) => {
  console.error('LỖI KIỂM THỬ:', err);
  process.exit(1);
});
