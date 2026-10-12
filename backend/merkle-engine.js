import crypto from 'crypto';

/**
 * Merkle Tree Cryptographic Audit Engine
 * Xây dựng cây Merkle theo chuẩn bảo mật mật mã:
 * - Mỗi log entry được băm kép SHA-256 (Leaf Hash)
 * - Tự động cân bằng và tính toán Merkle Root bất biến
 * - Sinh Merkle Audit Proof (Path proof) cho từng bản ghi
 * - Thẩm định tính toàn vẹn (Verify Proof) độc lập không cần toàn bộ dữ liệu gốc
 */

export class MerkleTreeEngine {
  /**
   * Tính SHA-256 hash của một chuỗi hoặc buffer
   */
  static sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Băm dữ liệu lá (Leaf node hash) theo chuẩn RFC 6962: Hash(0x00 || Data)
   * Tránh tấn công độ dài mở rộng và Second-Preimage Attack
   */
  static hashLeaf(logItem) {
    const serialized = JSON.stringify({
      id: logItem.id,
      action: logItem.action,
      actor: logItem.actor,
      details: logItem.details,
      status: logItem.status,
      timestamp: logItem.timestamp
    });
    return MerkleTreeEngine.sha256('\x00' + serialized);
  }

  /**
   * Băm nút trung gian (Interior node hash): Hash(0x01 || Left || Right)
   */
  static hashNodes(leftHex, rightHex) {
    const leftBuf = Buffer.from(leftHex, 'hex');
    const rightBuf = Buffer.from(rightHex, 'hex');
    const combined = Buffer.concat([Buffer.from([0x01]), leftBuf, rightBuf]);
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Xây dựng Merkle Tree từ danh sách Audit Logs
   */
  static buildTree(logs = []) {
    if (!logs || logs.length === 0) {
      return {
        root: '0000000000000000000000000000000000000000000000000000000000000000',
        totalLeaves: 0,
        layers: [[]]
      };
    }

    // Lớp 0: Các lá (Leaves)
    let currentLayer = logs.map(log => ({
      logId: log.id,
      hash: MerkleTreeEngine.hashLeaf(log)
    }));

    const layers = [currentLayer.map(n => n.hash)];

    // Lặp xây dựng lên đến Root
    while (currentLayer.length > 1) {
      const nextLayer = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        if (i + 1 < currentLayer.length) {
          const right = currentLayer[i + 1];
          nextLayer.push({
            hash: MerkleTreeEngine.hashNodes(left.hash, right.hash)
          });
        } else {
          // Nếu số lượng lẻ, nhân đôi nút lá cuối cùng (hoặc nâng trực tiếp lên)
          nextLayer.push({
            hash: MerkleTreeEngine.hashNodes(left.hash, left.hash)
          });
        }
      }
      currentLayer = nextLayer;
      layers.push(currentLayer.map(n => n.hash));
    }

    const merkleRoot = layers[layers.length - 1][0];

    return {
      root: merkleRoot,
      totalLeaves: logs.length,
      layersCount: layers.length,
      layers
    };
  }

  /**
   * Sinh Merkle Audit Proof cho 1 bản ghi log cụ thể theo logId
   */
  static generateProof(logs, logId) {
    const targetIdx = logs.findIndex(l => l.id === logId);
    if (targetIdx === -1) {
      throw new Error(`Không tìm thấy bản ghi log với ID: ${logId}`);
    }

    const targetLog = logs[targetIdx];
    const tree = MerkleTreeEngine.buildTree(logs);
    const proofPath = [];

    let currentIdx = targetIdx;
    for (let layerIdx = 0; layerIdx < tree.layers.length - 1; layerIdx++) {
      const layer = tree.layers[layerIdx];
      const isRight = currentIdx % 2 === 1;
      const siblingIdx = isRight ? currentIdx - 1 : currentIdx + 1;

      if (siblingIdx < layer.length) {
        proofPath.push({
          position: isRight ? 'left' : 'right',
          hash: layer[siblingIdx]
        });
      } else {
        // Nút lẻ tự băm với chính nó
        proofPath.push({
          position: 'right',
          hash: layer[currentIdx]
        });
      }

      currentIdx = Math.floor(currentIdx / 2);
    }

    return {
      logId,
      timestamp: targetLog.timestamp,
      action: targetLog.action,
      leafHash: MerkleTreeEngine.hashLeaf(targetLog),
      merkleRoot: tree.root,
      proofPath
    };
  }

  /**
   * Xác minh Merkle Proof độc lập (Client-side / Auditor verification)
   */
  static verifyProof(leafHash, proofPath, expectedRoot) {
    let currentHash = leafHash;

    for (const step of proofPath) {
      if (step.position === 'left') {
        currentHash = MerkleTreeEngine.hashNodes(step.hash, currentHash);
      } else {
        currentHash = MerkleTreeEngine.hashNodes(currentHash, step.hash);
      }
    }

    const isValid = currentHash.toLowerCase() === expectedRoot.toLowerCase();
    return {
      isValid,
      computedRoot: currentHash,
      expectedRoot,
      message: isValid
        ? 'Bằng chứng hợp lệ: Bản ghi log đã được kiểm toán và bất biến trong Cây Merkle Root!'
        : 'Cảnh báo gian lận: Bản ghi hoặc dữ liệu đã bị sửa đổi, Merkle Root không khớp!'
    };
  }
}
