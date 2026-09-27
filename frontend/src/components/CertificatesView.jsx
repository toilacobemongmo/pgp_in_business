import React, { useState } from 'react';
import { 
  Key, Plus, Search, Filter, ShieldCheck, AlertOctagon, 
  Download, Eye, CheckCircle2, XCircle, Copy, Check, FileDown, ShieldAlert
} from 'lucide-react';

export default function CertificatesView({ 
  certificates, 
  onRefresh, 
  openIssueModal, 
  openRevokeModal, 
  onSelectCert 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

  const filteredCerts = (certificates || []).filter(cert => {
    const matchesSearch = 
      cert.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.keyID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.fingerprint?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' ? true : cert.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadPublic = (cert) => {
    const content = cert.certifiedPublicKeyArmored || cert.originalPublicKeyArmored;
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cert.name.replace(/\s+/g, '_')}_${cert.keyID}_certified_pub.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPrivate = (cert) => {
    if (!cert.demoPrivateKeyArmored) return;
    const blob = new Blob([cert.demoPrivateKeyArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cert.name.replace(/\s+/g, '_')}_${cert.keyID}_PRIVATE_KEY.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Quản lý Chứng chỉ OpenPGP Doanh nghiệp
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cấp phát, chứng thực danh tính số bằng Corporate CA Signature và kiểm soát vòng đời khóa
          </p>
        </div>
        <button
          onClick={openIssueModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-600/30"
        >
          <Plus className="h-4 w-4" />
          Cấp Chứng chỉ Mới
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên cán bộ, email, phòng ban, Key ID, Fingerprint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 px-3 py-2.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hiệu lực (Active)</option>
            <option value="revoked">Đã thu hồi (Revoked)</option>
          </select>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Chủ thể (Cán bộ / Phòng ban)</th>
                <th className="py-3.5 px-4">Định danh Khóa (Key ID / Vân tay)</th>
                <th className="py-3.5 px-4">Thuật toán</th>
                <th className="py-3.5 px-4">Thời hạn Hiệu lực</th>
                <th className="py-3.5 px-4">Trạng thái CA</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCerts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    Không tìm thấy chứng chỉ nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredCerts.map((cert) => {
                  const isActive = cert.status === 'active';
                  return (
                    <tr key={cert.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Name & Department */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span className="text-cyan-400">{cert.name}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{cert.email}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {cert.role} &bull; {cert.department}
                        </div>
                      </td>

                      {/* KeyID & Fingerprint */}
                      <td className="py-4 px-4 font-mono text-xs">
                        <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                          <span>{cert.keyID}</span>
                          <button
                            onClick={() => handleCopy(cert.keyID, `key_${cert.id}`)}
                            title="Sao chép Key ID"
                            className="text-slate-500 hover:text-slate-300"
                          >
                            {copiedId === `key_${cert.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <div 
                          className="text-[11px] text-slate-500 truncate max-w-[160px] cursor-pointer hover:text-slate-300 mt-0.5"
                          title={`Fingerprint: ${cert.fingerprint}\nClick để sao chép`}
                          onClick={() => handleCopy(cert.fingerprint, `fp_${cert.id}`)}
                        >
                          FP: {cert.fingerprint.slice(-16)}
                        </div>
                      </td>

                      {/* Algorithm */}
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          {cert.algorithm || 'Ed25519'}
                        </span>
                      </td>

                      {/* Expiration */}
                      <td className="py-4 px-4 text-xs">
                        <div className="text-slate-300">
                          Đến: {new Date(cert.expiresAt).toLocaleDateString('vi-VN')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Cấp: {new Date(cert.issuedAt).toLocaleDateString('vi-VN')}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Đang hiệu lực
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950 text-rose-300 border border-rose-800" title={cert.revocationReason}>
                            <XCircle className="h-3.5 w-3.5" />
                            Đã thu hồi
                          </span>
                        )}
                        {cert.caIssuer && (
                          <div className="text-[10px] text-cyan-400/80 mt-1 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Corporate CA Signed
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onSelectCert(cert)}
                            title="Xem chi tiết chứng chỉ"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDownloadPublic(cert)}
                            title="Tải Public Key đã chứng thực (.asc)"
                            className="p-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 transition-colors"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>

                          {cert.demoPrivateKeyArmored && (
                            <button
                              onClick={() => handleDownloadPrivate(cert)}
                              title="Tải Private Key (Do CA sinh hộ - Giữ an toàn)"
                              className="p-1.5 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 transition-colors"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}

                          {isActive && (
                            <button
                              onClick={() => openRevokeModal(cert)}
                              title="Thu hồi chứng chỉ này"
                              className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 transition-colors"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
