import React, { useState } from 'react';
import { 
  Key, Split, Combine, ShieldCheck, ShieldAlert, Copy, Check, 
  Users, Lock, RefreshCw, AlertCircle, FileKey, Sparkles
} from 'lucide-react';
import { CA_API } from '../api';

export default function ShamirKeyShardingView({ caInfo }) {
  // Split States
  const [secretInput, setSecretInput] = useState('');
  const [totalShares, setTotalShares] = useState(5);
  const [threshold, setThreshold] = useState(3);
  const [splitResult, setSplitResult] = useState(null);
  const [splitting, setSplitting] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Recovery States
  const [sharesInput, setSharesInput] = useState('');
  const [recoveredSecret, setRecoveredSecret] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const [splitError, setSplitError] = useState('');
  const [recoverError, setRecoverError] = useState('');

  const handleSplit = async () => {
    setSplitting(true);
    setSplitError('');
    try {
      const res = await CA_API.splitSecretShamir({
        secret: secretInput.trim() || undefined,
        totalShares: Number(totalShares),
        threshold: Number(threshold)
      });
      if (res.success) {
        setSplitResult(res);
      } else {
        setSplitError(res.error || 'Phân rã thất bại.');
      }
    } catch (err) {
      setSplitError(err.response?.data?.error || err.message || 'Lỗi khi gọi API Shamir Split.');
    } finally {
      setSplitting(false);
    }
  };

  const handleRecover = async () => {
    if (!sharesInput.trim()) {
      setRecoverError('Vui lòng dán ít nhất k mảnh khóa (mỗi mảnh trên một dòng).');
      return;
    }
    setRecovering(true);
    setRecoverError('');
    setRecoveredSecret(null);
    try {
      const lines = sharesInput.split('\n').map(l => l.trim()).filter(l => l.startsWith('SHR-'));
      if (lines.length === 0) {
        throw new Error('Không tìm thấy định dạng mảnh SHR-kOFn-... hợp lệ.');
      }
      const res = await CA_API.recoverSecretShamir(lines);
      if (res.success) {
        setRecoveredSecret(res);
      } else {
        setRecoverError(res.error || 'Khôi phục thất bại.');
      }
    } catch (err) {
      setRecoverError(err.response?.data?.error || err.message || 'Lỗi khi gọi API phục hồi khóa.');
    } finally {
      setRecovering(false);
    }
  };

  const copyShare = (shareKey, idx) => {
    navigator.clipboard.writeText(shareKey);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const populateQuickTestShares = (count = 3) => {
    if (!splitResult?.shares) return;
    const sample = splitResult.shares.slice(0, count).map(s => s.shareKey).join('\n');
    setSharesInput(sample);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border border-purple-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Split className="w-48 h-48 text-purple-400" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold mb-3 border border-purple-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Galois Field GF(2^8) Cryptographic Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Quản Trị Khóa Đa Bên: Shamir's Secret Sharing (k-of-n Threshold)
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Giải quyết triệt để rủi ro "Single Point of Failure" của Root CA. Phân rã Private Key/Passphrase 
            thành n mảnh độc lập theo đa thức bậc (k-1) trên trường hữu hạn Galois GF(256). 
            Để kích hoạt thao tác nhạy cảm, bắt buộc phải có đủ k quản trị viên hợp tác nội suy Lagrange.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Split Secret */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Split className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              1. Phân Rã Bí Mật CA (Key Sharding)
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Bí Mật Cần Phân Rã (Để trống sẽ tự động lấy Passphrase Master của CA):
              </label>
              <input
                type="text"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                placeholder="EnterpriseRootCAPassphrase@2026 (hoặc chuỗi Private Key bất kỳ)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-purple-200 font-mono focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Tổng số mảnh phát hành (n):
                </label>
                <select
                  value={totalShares}
                  onChange={(e) => setTotalShares(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value={3}>3 Người giữ</option>
                  <option value={5}>5 Người giữ (Khuyên dùng)</option>
                  <option value={7}>7 Người giữ</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Ngưỡng tối thiểu để mở (k):
                </label>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value={2}>2 Mảnh</option>
                  <option value={3}>3 Mảnh (Khuyên dùng)</option>
                  <option value={4}>4 Mảnh</option>
                  <option value={5}>5 Mảnh</option>
                </select>
              </div>
            </div>

            {splitError && (
              <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{splitError}</span>
              </div>
            )}

            <button
              onClick={handleSplit}
              disabled={splitting}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium text-xs shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
            >
              {splitting ? 'Đang giải mã đa thức GF(256)...' : `Phân rã thành ${totalShares} Mảnh Khóa (${threshold}-of-${totalShares})`}
            </button>
          </div>

          {/* Shares Output */}
          {splitResult && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Đã phân rã thành công ({splitResult.threshold}-of-{splitResult.totalShares})
                </span>
                <button
                  onClick={() => populateQuickTestShares(splitResult.threshold)}
                  className="text-[11px] text-purple-300 hover:underline flex items-center gap-1"
                >
                  Nạp nhanh {splitResult.threshold} mảnh sang ô phục hồi
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {splitResult.shares.map((s, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2">
                    <div className="truncate flex-1">
                      <span className="text-[10px] text-purple-400 font-semibold block">{s.holderRole}</span>
                      <code className="text-[11px] text-slate-300 font-mono truncate block">{s.shareKey}</code>
                    </div>
                    <button
                      onClick={() => copyShare(s.shareKey, idx)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                      title="Copy Share Key"
                    >
                      {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel 2: Recover Secret via Lagrange Interpolation */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Combine className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              2. Khôi Phục Bí Mật Bằng Nội Suy Lagrange
            </h2>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 block">
              Dán các mảnh khóa (Tối thiểu k mảnh, mỗi dòng 1 mảnh):
            </label>
            <textarea
              rows={7}
              value={sharesInput}
              onChange={(e) => setSharesInput(e.target.value)}
              placeholder="SHR-3OF5-01-...\nSHR-3OF5-02-...\nSHR-3OF5-03-..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-emerald-200 font-mono focus:ring-1 focus:ring-emerald-500"
            />

            {recoverError && (
              <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg text-red-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{recoverError}</span>
              </div>
            )}

            <button
              onClick={handleRecover}
              disabled={recovering}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-medium text-xs shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {recovering ? 'Đang giải đa thức nội suy f(0)...' : 'Tái Tạo & Mở Khóa Phiên Quản Trị (Lagrange)'}
            </button>
          </div>

          {recoveredSecret && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Tái tạo thành công từ {recoveredSecret.sharesCount} mảnh khóa hợp lệ!
              </span>
              <div className="p-3 bg-slate-950 border border-emerald-800/60 rounded-lg">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Bí Mật Khôi Phục (f(0)):</span>
                <code className="text-sm font-bold text-emerald-300 font-mono break-all">
                  {recoveredSecret.recoveredSecret}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
