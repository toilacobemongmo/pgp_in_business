import React, { useState } from 'react';
import { X, Key, ShieldCheck, Download, AlertTriangle, CheckCircle2, User, Mail, Building, Briefcase } from 'lucide-react';
import { CA_API } from '../api';

export default function IssueCertModal({ isOpen, onClose, onSuccess }) {
  const [mode, setMode] = useState('ca_generate'); // 'ca_generate' | 'custom_pubkey'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Phòng Công nghệ Thông tin');
  const [role, setRole] = useState('Kỹ sư Bảo mật');
  const [validityDays, setValidityDays] = useState(365);
  const [customPublicKey, setCustomPublicKey] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        name,
        email,
        department,
        role,
        validityDays,
        customPublicKeyArmored: mode === 'custom_pubkey' ? customPublicKey : null,
        notes
      };

      const res = await CA_API.issueCertificate(payload);
      if (res.success) {
        setResult(res.certificate);
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || 'Lỗi khi cấp chứng chỉ.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPublic = () => {
    if (!result?.certifiedPublicKeyArmored) return;
    const blob = new Blob([result.certifiedPublicKeyArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.name.replace(/\s+/g, '_')}_${result.keyID}_certified_pub.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPrivate = () => {
    if (!result?.demoPrivateKeyArmored) return;
    const blob = new Blob([result.demoPrivateKeyArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.name.replace(/\s+/g, '_')}_${result.keyID}_PRIVATE_KEY.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        {!result ? (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Key className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Cấp Chứng chỉ OpenPGP Doanh nghiệp</h2>
                <p className="text-xs text-slate-400">Chứng thực khóa định danh số có chữ ký bảo trợ của Corporate Root CA</p>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setMode('ca_generate')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'ca_generate'
                    ? 'bg-cyan-950/60 border-cyan-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-cyan-300">CA Tự động sinh Khóa</div>
                <div className="text-[11px] text-slate-400 mt-1">CA tự tạo cặp khóa ECC và xuất private key cho cán bộ</div>
              </button>
              <button
                type="button"
                onClick={() => setMode('custom_pubkey')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'custom_pubkey'
                    ? 'bg-cyan-950/60 border-cyan-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-cyan-300">Nộp Public Key (CSR)</div>
                <div className="text-[11px] text-slate-400 mt-1">Người dùng tự tạo khóa, chỉ gửi Public Key để CA ký</div>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Họ và tên Cán bộ (*):</label>
                  <div className="relative">
                    <User className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Lê Thị Ngọc Bích"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Email Doanh nghiệp (*):</label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="bich.le@enterprise.internal"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Phòng ban / Đơn vị:</label>
                  <div className="relative">
                    <Building className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Phòng Kế hoạch & Đầu tư"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Chức danh / Vai trò:</label>
                  <div className="relative">
                    <Briefcase className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Phó phòng Kế hoạch"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Thời hạn Hiệu lực:</label>
                <select
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                >
                  <option value={90}>90 ngày (Cấp tạm thời / Thử việc)</option>
                  <option value={365}>1 năm (Chuẩn doanh nghiệp)</option>
                  <option value={730}>2 năm (Cấp lãnh đạo / Quản lý)</option>
                  <option value={1825}>5 năm (Khóa định danh dài hạn)</option>
                </select>
              </div>

              {mode === 'custom_pubkey' && (
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Dán OpenPGP Public Key của cán bộ (*):
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={customPublicKey}
                    onChange={(e) => setCustomPublicKey(e.target.value)}
                    placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Ghi chú mục đích sử dụng:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ký số hợp đồng và văn bản hành chính..."
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2"
              >
                {loading ? 'Đang cấp & Ký chứng thực CA...' : 'Cấp Chứng chỉ & Ký Chứng thực Ngay'}
              </button>
            </form>
          </div>
        ) : (
          /* Success Screen */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Cấp Chứng chỉ Thành công!</h2>
                <p className="text-xs text-slate-400">Chứng chỉ đã được Corporate Root CA ký chứng thực hợp lệ</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Chủ thể:</span>
                <span className="text-white font-semibold">{result.name} ({result.email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Key ID:</span>
                <span className="font-mono text-cyan-400 font-bold">{result.keyID}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hiệu lực đến:</span>
                <span className="text-slate-300">{new Date(result.expiresAt).toLocaleDateString('vi-VN')}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Dấu vân tay (Fingerprint):</span>
                <span className="font-mono text-[10px] text-slate-400 break-all">{result.fingerprint}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleDownloadPublic}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <Download className="h-4 w-4" />
                Tải Khóa Công Khai Đã Chứng Thực (.asc)
              </button>

              {result.demoPrivateKeyArmored && (
                <button
                  onClick={handleDownloadPrivate}
                  className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Tải Khóa Bí Mật Private Key (Lưu ý bảo mật tuyệt đối!)
                </button>
              )}
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => {
                  setResult(null);
                  onClose();
                }}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
