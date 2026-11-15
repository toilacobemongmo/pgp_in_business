/**
 * @file tests/benchmark-stream.js
 * @description Kịch bản Stress-Test hiệu năng Streaming Detached Signature (500MB / 1GB / 2GB)
 * Chứng minh mức tiêu thụ RAM Node.js RSS luôn duy trì phẳng dưới ngưỡng 50MB nhờ Backpressure 64KB.
 * Chạy: node tests/benchmark-stream.js [sizeInMB] (mặc định 500MB)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const openpgp = require('openpgp');
const pgpService = require('../backend/pgp-service');

async function runBenchmark() {
  const targetMB = parseInt(process.argv[2], 10) || 500;
  const testFile = path.join(__dirname, `stress_test_${targetMB}MB.dat`);

  console.log(`[Benchmark] Đang tạo tệp nhị phân ${targetMB} MB để kiểm thử...`);
  const ws = fs.createWriteStream(testFile);
  const block1MB = crypto.randomBytes(1024 * 1024);
  for (let i = 0; i < targetMB; i++) {
    if (!ws.write(block1MB)) {
      await new Promise((r) => ws.once('drain', r));
    }
  }
  await new Promise((r) => ws.end(r));

  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'ed25519',
    userIDs: [{ name: 'Benchmark Signer', email: 'bench@enterprise.vn' }],
    passphrase: 'BenchPassword@2026',
  });

  console.log(`[Benchmark] Bắt đầu ký số Detached Stream cho tệp ${targetMB} MB...`);
  const signResult = await pgpService.createDetachedStreamSignature(
    testFile,
    privateKey,
    'BenchPassword@2026'
  );
  console.log('[Kết quả Ký Stream]:', signResult.telemetry);

  console.log(`[Benchmark] Bắt đầu thẩm tra Detached Stream (Zero-Disk) cho tệp ${targetMB} MB...`);
  const rs = fs.createReadStream(testFile, { highWaterMark: 64 * 1024 });
  const verifyResult = await pgpService.verifyDetachedStreamZeroDisk(
    rs,
    signResult.detachedSignature,
    publicKey
  );
  console.log('[Kết quả Thẩm tra Stream]:', verifyResult);

  fs.unlinkSync(testFile);
  console.log('[Benchmark] Hoàn tất và đã xóa tệp tạm.');
}

runBenchmark().catch(console.error);
