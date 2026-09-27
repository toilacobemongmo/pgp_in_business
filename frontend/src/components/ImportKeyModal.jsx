import React, { useState } from 'react';
import { X, Globe, Plus, AlertTriangle, Building2, User, Mail, FileKey } from 'lucide-react';
import { CA_API } from '../api';

export default function ImportKeyModal({ isOpen, onClose, onSuccess }) {
  const [organizationName, setOrganizationName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [department, setDepartment] = useState('Bộ phận Đối ngoại B2B');
  const [publicKeyArmored, setPublicKeyArmored] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await CA_API.importExternalKey({
        organizationName,
        contactName,
        contactEmail,
        department,
        publicKeyArmored,
        notes
      });

      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(res.error || 'Lỗi khi nhập khóa.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Thêm Khóa Đối tác Doanh nghiệp (B2B)</h2>
            <p className="text-xs text-slate-400">Lưu trữ Public Key của đối tác liên kết vào Danh bạ tập trung</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-300 block mb-1">Tên Tổ chức / Doanh nghiệp Đối tác (*):</label>
            <div className="relative">
              <Building2 className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="VD: Tập đoàn Logistics Toàn cầu LOGIX"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Đại diện liên hệ:</label>
              <div className="relative">
                <User className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Trưởng phòng Hợp tác"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Email Đối tác:</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="b2b@logix-global.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Khóa Công khai OpenPGP (Public Key Block) (*):
            </label>
            <textarea
              rows={5}
              required
              value={publicKeyArmored}
              onChange={(e) => setPublicKeyArmored(e.target.value)}
              placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;...&#10;-----END PGP PUBLIC KEY BLOCK-----"
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-purple-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-300 block mb-1">Ghi chú quan hệ đối tác:</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Đối tác cung ứng dịch vụ kho vận hợp đồng 2026..."
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {loading ? 'Đang xác thực & Thêm...' : 'Lưu Khóa Đối tác'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
