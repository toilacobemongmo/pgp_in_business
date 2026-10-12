import React, { useState, useEffect } from 'react';
import { 
  GitCommit, ShieldCheck, ShieldAlert, CheckCircle2, 
  Search, ArrowRight, Database, RefreshCw, FileText, Sparkles, Hash
} from 'lucide-react';
import { CA_API } from '../api';

export default function MerkleAuditView() {
  const [merkleStatus, setMerkleStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedLogId, setSelectedLogId] = useState('');
  const [proofData, setProofData] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [proofLoading, setProofLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, logsRes] = await Promise.all([
        CA_API.getMerkleStatus(),
        CA_API.getAuditLogs()
      ]);
      if (statusRes.success) setMerkleStatus(statusRes);
      if (logsRes.success) {
        setLogs(logsRes.logs);
        if (logsRes.logs.length > 0 && !selectedLogId) {
          setSelectedLogId(logsRes.logs[0].id);
        }
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi tải trạng thái Cây Merkle.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateProof = async (logIdToUse) => {
    const target = logIdToUse || selectedLogId;
    if (!target) return;
    setProofLoading(true);
    setProofData(null);
    setVerificationResult(null);
    try {
      const res = await CA_API.getMerkleProof(target);
      if (res.success) {
        setProofData(res.proof);
        // Tự động kiểm toán verification
        const verifyRes = await CA_API.verifyMerkleProof({
          leafHash: res.proof.leafHash,
          proofPath: res.proof.proofPath,
          merkleRoot: res.proof.merkleRoot
        });
        if (verifyRes.success) {
          setVerificationResult(verifyRes.verification);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Không thể tạo Merkle Proof.');
    } finally {
      setProofLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <GitCommit className="w-48 h-48 text-blue-400" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cryptographic Merkle Tree & RFC 6962 Proof Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Sổ Cái Kiểm Toán Bất Biến & Bằng Chứng Merkle (Verifiable Audit Trail)
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Nâng cấp toàn bộ nhật ký an ninh thành Cây Merkle nhị phân với gốc Merkle Root bất biến. 
            Cho phép thẩm tra viên và đối tác ngoại kiểm chứng độc lập (Independent Verification) 
            rằng một hành vi phát hành khóa hay ký văn bản không hề bị quản trị viên sửa đổi gian lận trong cơ sở dữ liệu.
          </p>
        </div>
      </div>

      {/* Merkle Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Merkle Root Bất Biến</span>
          <p className="text-xs font-mono font-bold text-cyan-300 mt-1 truncate" title={merkleStatus?.merkleRoot}>
            {merkleStatus?.merkleRoot || 'Đang tính toán...'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Tổng số Bản ghi Lá (Leaves)</span>
          <p className="text-xl font-bold text-emerald-400 mt-1">{merkleStatus?.totalLeaves || 0} Giao dịch đã băm</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Độ sâu Cây (Tree Height)</span>
          <p className="text-xl font-bold text-white mt-1">{merkleStatus?.layersCount || 0} Tầng băm nhị phân</p>
        </div>
      </div>

      {/* Proof Generator & Verification Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Select Log (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[520px]">
          <div className="p-3.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-400" />
              Chọn Bản Ghi Kiểm Toán
            </span>
            <button onClick={loadData} className="text-slate-400 hover:text-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-800 overflow-y-auto flex-1">
            {logs.map((log) => {
              const isSelected = selectedLogId === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => {
                    setSelectedLogId(log.id);
                    handleGenerateProof(log.id);
                  }}
                  className={`p-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-950/60 border-l-4 border-blue-500' : 'hover:bg-slate-800/40'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{log.action}</span>
                    <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate mt-1">{log.details}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{log.id}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Merkle Proof & Cryptographic Verification (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[520px]">
          <div className="p-3.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-emerald-400" />
              Bằng Chứng Merkle (Merkle Path Proof) & Thẩm Định Độc Lập
            </span>
          </div>

          <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
            {proofLoading ? (
              <div className="flex items-center justify-center h-48 text-slate-400">
                Đang tạo đường dẫn kiểm toán Merkle...
              </div>
            ) : proofData ? (
              <>
                {/* Verification Badge */}
                {verificationResult && (
                  <div className={`p-3.5 rounded-lg border flex items-start gap-3 ${
                    verificationResult.isValid
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                      : 'bg-red-950/40 border-red-800/60 text-red-200'
                  }`}>
                    {verificationResult.isValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm">
                        {verificationResult.isValid ? 'Toàn Vẹn 100% - Merkle Proof Verified' : 'Cảnh Báo Giả Mạo!'}
                      </h4>
                      <p className="text-xs opacity-90 mt-0.5">{verificationResult.message}</p>
                    </div>
                  </div>
                )}

                {/* Leaf Hash */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Băm Nút Lá (Leaf Hash SHA-256):</span>
                  <code className="text-xs font-mono text-cyan-300 break-all">{proofData.leafHash}</code>
                </div>

                {/* Proof Steps Flow */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block">Đường dẫn Băm Kiểm Toán (Audit Path):</span>
                  <div className="space-y-2">
                    {proofData.proofPath.map((step, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-800 text-slate-300 uppercase">
                            Nút {step.position}
                          </span>
                          <span className="text-slate-400 text-[11px]">Bước {idx + 1}</span>
                        </div>
                        <code className="text-[11px] font-mono text-slate-300 truncate max-w-[260px]" title={step.hash}>
                          {step.hash}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expected Merkle Root */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Khớp Với Merkle Root Toàn Cục:</span>
                  <code className="text-xs font-mono text-emerald-400 break-all">{proofData.merkleRoot}</code>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-500 italic">
                Chọn một bản ghi ở bảng bên trái để xem bằng chứng Merkle Tree.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
