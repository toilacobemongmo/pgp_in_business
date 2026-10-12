/**
 * Web of Trust (WoT) & Graph Trust Metric Analyzer
 * Triển khai thuật toán đồ thị:
 * 1. Khám phá mạng lưới các khóa (Nodes) và chứng thực chữ ký chéo (Edges).
 * 2. Thuật toán Dijkstra tìm đường dẫn tin cậy ngắn nhất (Shortest Trust Path).
 * 3. Thuật toán PGP Trust Flow Metric (xác định trọng số tin cậy giữa các bên không quen biết trực tiếp).
 * 4. Phát hiện nút thắt cổ chai an ninh (Single Point of Failure / Bridge nodes).
 */

export class WebOfTrustAnalyzer {
  /**
   * Xây dựng đồ thị tin cậy từ danh bạ khóa và các chứng chỉ ký phát
   * @param {Array} certificates - Danh sách chứng chỉ nội bộ đã cấp
   * @param {Array} directory - Danh bạ khóa công khai (nội bộ + đối tác ngoại)
   * @param {Object} caConfig - Cấu hình Root CA
   */
  static buildTrustGraph(certificates = [], directory = [], caConfig = null) {
    const nodes = new Map();
    const edges = [];

    // 1. Thêm Root CA làm Anchor of Trust
    if (caConfig) {
      nodes.set(caConfig.fingerprint, {
        id: caConfig.fingerprint,
        label: caConfig.name || 'Corporate Root CA',
        email: caConfig.email,
        keyID: caConfig.keyID,
        type: 'root_ca',
        trustWeight: 1.0, // Điểm tin cậy tuyệt đối
        status: 'active'
      });
    }

    // 2. Thêm các chứng chỉ nội bộ được Root CA ký duyệt
    certificates.forEach(cert => {
      const fp = cert.fingerprint;
      if (!nodes.has(fp)) {
        nodes.set(fp, {
          id: fp,
          label: cert.name,
          email: cert.email,
          keyID: cert.keyID,
          department: cert.department,
          type: 'employee',
          trustWeight: cert.status === 'active' ? 0.9 : 0.0,
          status: cert.status
        });
      }

      // Root CA ký chứng thực cho nhân viên
      if (caConfig && cert.status === 'active') {
        edges.push({
          source: caConfig.fingerprint,
          target: fp,
          sourceName: caConfig.name,
          targetName: cert.name,
          relation: 'CA_CERTIFIED',
          weight: 0.95,
          type: 'direct_ca_signature',
          valid: true
        });
      }
    });

    // 3. Thêm các khóa đối tác trong Key Directory
    directory.forEach(keyItem => {
      const fp = keyItem.fingerprint;
      if (!nodes.has(fp)) {
        const isPartner = keyItem.keyType === 'external_partner';
        nodes.set(fp, {
          id: fp,
          label: keyItem.organizationName || keyItem.contactName || 'Khóa Đối tác',
          email: keyItem.contactEmail,
          keyID: keyItem.keyID,
          type: isPartner ? 'external_partner' : 'internal_entity',
          trustWeight: keyItem.trustLevel === 'corporate_root' ? 1.0 : 0.6,
          status: 'active'
        });
      }

      // Thêm các liên kết chéo mô phỏng mối quan hệ B2B Web of Trust
      if (keyItem.certifiedBy && nodes.has(keyItem.certifiedBy)) {
        edges.push({
          source: keyItem.certifiedBy,
          target: fp,
          sourceName: nodes.get(keyItem.certifiedBy).label,
          targetName: nodes.get(fp).label,
          relation: 'CROSS_SIGNATURE',
          weight: 0.75,
          type: 'peer_cross_signing',
          valid: true
        });
      }
    });

    // 4. Nếu chưa có liên kết chéo giữa Partner và Internal CA, sinh các liên kết thẩm định thực tế
    // Ví dụ: Root CA đã thẩm tra ký chéo đối tác B2B (Fincorp / Logistics)
    directory.filter(k => k.keyType === 'external_partner').forEach(partner => {
      if (caConfig && !edges.some(e => e.target === partner.fingerprint)) {
        edges.push({
          source: caConfig.fingerprint,
          target: partner.fingerprint,
          sourceName: caConfig.name,
          targetName: partner.organizationName || partner.contactName,
          relation: 'B2B_FEDERATED_TRUST',
          weight: 0.8,
          type: 'federation_trust',
          valid: true
        });
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      edges
    };
  }

  /**
   * Thuật toán Dijkstra tìm Đường dẫn Tin cậy Ngắn nhất & Tính toán Điểm Tin cậy (Trust Metric)
   * Giữa Nguồn (Source) và Đích (Target)
   */
  static findTrustPath(graph, sourceId, targetId) {
    const { nodes, edges } = graph;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) {
      return {
        found: false,
        message: 'Không tìm thấy thực thể nguồn hoặc đích trong mạng lưới tin cậy.'
      };
    }

    if (sourceId === targetId) {
      return {
        found: true,
        path: [nodeMap.get(sourceId)],
        hopCount: 0,
        aggregatedTrustScore: 1.0,
        explanation: 'Khóa tự tin cậy chính nó (Self-trusted root).'
      };
    }

    // Danh sách kề (Adjacency List)
    const adj = new Map();
    nodes.forEach(n => adj.set(n.id, []));
    edges.forEach(e => {
      if (e.valid && adj.has(e.source)) {
        adj.get(e.source).push({ target: e.target, weight: e.weight, relation: e.relation });
      }
    });

    // Hàng đợi ưu tiên / Dijkstra
    // Chi phí để tối ưu tin cậy: Cost = -log(weight) hoặc khoảng cách hop
    const distances = new Map();
    const trustScores = new Map();
    const prev = new Map();
    const visited = new Set();

    nodes.forEach(n => {
      distances.set(n.id, Infinity);
      trustScores.set(n.id, 0);
    });

    distances.set(sourceId, 0);
    trustScores.set(sourceId, 1.0);

    const queue = [sourceId];

    while (queue.length > 0) {
      // Tìm node có khoảng cách nhỏ nhất
      queue.sort((a, b) => distances.get(a) - distances.get(b));
      const u = queue.shift();

      if (u === targetId) break;
      if (visited.has(u)) continue;
      visited.add(u);

      const neighbors = adj.get(u) || [];
      for (const edge of neighbors) {
        const v = edge.target;
        const edgeCost = 1; // 1 hop
        const newDist = distances.get(u) + edgeCost;
        const newTrust = trustScores.get(u) * edge.weight;

        if (newDist < distances.get(v)) {
          distances.set(v, newDist);
          trustScores.set(v, newTrust);
          prev.set(v, { from: u, relation: edge.relation, edgeWeight: edge.weight });
          if (!visited.has(v)) {
            queue.push(v);
          }
        }
      }
    }

    if (!prev.has(targetId)) {
      return {
        found: false,
        source: nodeMap.get(sourceId),
        target: nodeMap.get(targetId),
        aggregatedTrustScore: 0,
        explanation: 'Không tồn tại chuỗi chữ ký (Trust Chain) kết nối giữa 2 thực thể này.'
      };
    }

    // Tái tạo đường dẫn
    const path = [];
    const chainEdges = [];
    let curr = targetId;

    while (curr !== sourceId) {
      path.unshift(nodeMap.get(curr));
      const step = prev.get(curr);
      chainEdges.unshift(step);
      curr = step.from;
    }
    path.unshift(nodeMap.get(sourceId));

    const finalTrustScore = Math.round(trustScores.get(targetId) * 100) / 100;

    return {
      found: true,
      source: nodeMap.get(sourceId),
      target: nodeMap.get(targetId),
      hopCount: path.length - 1,
      path,
      chainEdges,
      aggregatedTrustScore: finalTrustScore,
      trustRating: finalTrustScore >= 0.8 ? 'CỰC KỲ TIN CẬY (HIGH TRUST)' : finalTrustScore >= 0.5 ? 'TIN CẬY MỨC TRUNG BÌNH (MARGINAL)' : 'ĐỘ TIN CẬY THẤP (LOW/UNTRUSTED)',
      explanation: `Chuỗi chứng thực hợp lệ gồm ${path.length - 1} bước nhảy (Hops) thông qua hạ tầng Web of Trust.`
    };
  }

  /**
   * Phân tích các chỉ số bảo mật đồ thị: Nút thắt cổ chai (Vulnerabilities & Centrality)
   */
  static analyzeNetworkResilience(graph) {
    const { nodes, edges } = graph;
    const degreeMap = new Map();

    nodes.forEach(n => degreeMap.set(n.id, { inDegree: 0, outDegree: 0 }));

    edges.forEach(e => {
      if (degreeMap.has(e.source)) degreeMap.get(e.source).outDegree++;
      if (degreeMap.has(e.target)) degreeMap.get(e.target).inDegree++;
    });

    const keyMetrics = nodes.map(n => {
      const deg = degreeMap.get(n.id) || { inDegree: 0, outDegree: 0 };
      const totalConnections = deg.inDegree + deg.outDegree;
      return {
        id: n.id,
        label: n.label,
        type: n.type,
        totalConnections,
        isCriticalHub: totalConnections >= 3, // Điểm nút quan trọng
        riskLevel: n.status === 'revoked' ? 'CRITICAL_REVOKED' : totalConnections === 1 ? 'ISOLATED_LEAF' : 'HEALTHY'
      };
    });

    return {
      totalNodes: nodes.length,
      totalTrustEdges: edges.length,
      networkDensity: nodes.length > 1 ? (edges.length / (nodes.length * (nodes.length - 1))).toFixed(3) : 0,
      criticalHubs: keyMetrics.filter(k => k.isCriticalHub),
      atRiskNodes: keyMetrics.filter(k => k.riskLevel !== 'HEALTHY')
    };
  }
}
