import React, { useState } from 'react';
import { X, AlertOctagon, ShieldAlert } from 'lucide-react';
import { CA_API } from '../api';

export default function RevokeCertModal({ isOpen, onClose, cert, onSuccess }) {
  const [reason, setReason] = useState('Nhân viên chuyển đổi vị trí công tác hoặc chấm dứt hợp đồng');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !cert) return null;

  const handleRevoke = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const finalReason = reason === 'custom' ? customReason : reason;
      const res = await CA_API.revokeCertificate(cert.id, finalReason);
      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(res.error || 'Lỗi khi thu hồi chứng chỉ.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Thu Hồi Chứng Chỉ OpenPGP</h2>
            <p className="text-xs text-slate-400">Vô hiệu hóa chữ ký số và cập nhật danh sách thu hồi CA</p>
          </div>
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs mb-4 space-y-1">
          <div className="text-slate-300 font-medium">Chủ thể: <span className="text-white font-bold">{cert.name}</span></div>
          <div className="text-slate-400">Email: {cert.email}</div>
          <div className="text-slate-400">Key ID: <span className="font-mono text-cyan-400">{cert.keyID}</span></div>
        </div>

        <form onSubmit={handleRevoke} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-300 block mb-1">Lý do thu hồi chứng chỉ (*):</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-rose-500 text-xs"
            >
              <option value="Nhân viên chuyển đổi vị trí công tác hoặc chấm dứt hợp đồng">
                Nhân viên thôi việc / Chuyển vị trí công tác
              </option>
              <option value="Nghi ngờ hoặc xác nhận lộ Khóa Bí Mật (Private Key Compromised)">
                Nghi ngờ / Xác nhận lộ Private Key (Nguy cơ cao)
              </option>
              <option value="Khóa quá hạn hoặc chuyển đổi tiêu chuẩn mật mã mới">
                Khóa thay thế bởi tiêu chuẩn mật mã mới
              </option>
              <option value="custom">-- Lý do tùy chỉnh khác --</option>
            </select>
          </div>

          {reason === 'custom' && (
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Nhập chi tiết lý do:</label>
              <input
                type="text"
                required
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Nhập lý do cụ thể..."
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs"
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-lg text-xs">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5"
            >
              <ShieldAlert className="h-4 w-4" />
              {loading ? 'Đang thu hồi...' : 'Xác Nhận Thu Hồi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
