import React, { useState } from 'react';
import { 
  User, Key, ShieldCheck, Download, Copy, Check, FileCheck, 
  Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, Briefcase, Building
} from 'lucide-react';
import { CA_API } from '../api';

export default function EmployeePortalView({ 
  certificates, 
  directory, 
  selectedEmployeeId, 
  setSelectedEmployeeId,
  onRefresh 
}) {
  const [copied, setCopied] = useState(false);
  const [signInputType, setSignInputType] = useState('text');
  const [docContent, setDocContent] = useState('PHIẾU DUYỆT ĐỀ XUẤT MUA SẮM TRANG THIẾT BỊ CNTT\nKính gửi: Ban Giám Đốc\nNội dung: Phê duyệt mua 05 máy tính trạm chuyên dụng và thiết bị token bảo mật PGP.\nTổng dự toán: 180,000,000 VND.');
  const [signFile, setSignFile] = useState(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [signResult, setSignResult] = useState(null);
  const [signError, setSignError] = useState('');

  // Lọc danh sách nhân viên có chứng chỉ còn hiệu lực
  const activeEmployees = (certificates || []).filter(c => c.status === 'active');
  const currentEmp = activeEmployees.find(c => c.id === selectedEmployeeId) || activeEmployees[0];

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPublic = () => {
    if (!currentEmp?.certifiedPublicKeyArmored) return;
    const blob = new Blob([currentEmp.certifiedPublicKeyArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentEmp.name.replace(/\s+/g, '_')}_${currentEmp.keyID}_pub.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPrivate = () => {
    if (!currentEmp?.demoPrivateKeyArmored) return;
    const blob = new Blob([currentEmp.demoPrivateKeyArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentEmp.name.replace(/\s+/g, '_')}_PRIVATE_KEY.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSignDocument = async (e) => {
    e.preventDefault();
    if (!currentEmp) return;
    setSigningLoading(true);
    setSignError('');
    setSignResult(null);

    try {
      const formData = new FormData();
      if (signInputType === 'file') {
        if (!signFile) throw new Error('Vui lòng chọn tệp tin cần ký.');
        formData.append('file', signFile);
      } else {
        if (!docContent.trim()) throw new Error('Vui lòng nhập nội dung văn bản cần ký.');
        formData.append('textContent', docContent);
      }

      formData.append('signerPrivateKeyArmored', currentEmp.demoPrivateKeyArmored);
      formData.append('signerPassphrase', '');

      const res = await CA_API.signDocument(formData);
      if (res.success) {
        setSignResult(res.signedDocument);
        if (onRefresh) onRefresh();
      } else {
        setSignError(res.error || 'Lỗi ký văn bản.');
      }
    } catch (err) {
      setSignError(err.response?.data?.error || err.message);
    } finally {
      setSigningLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Employee Switcher */}
      <div className="bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-900 border border-cyan-800/50 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-cyan-950 text-cyan-400 border border-cyan-700">
              Cổng Nhân Viên Tự Phục Vụ (Employee Self-Service)
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Không Gian Làm Việc & Chữ Ký Số Của Tôi
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Quản lý định danh số cá nhân, ký duyệt văn bản nội bộ và chia sẻ khóa công khai
          </p>
        </div>

        {/* Cán bộ đang đăng nhập */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
            {currentEmp?.name ? currentEmp.name.charAt(0) : 'U'}
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Đang đăng nhập với vai trò:</span>
            <select
              value={currentEmp?.id || ''}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="bg-transparent text-white font-semibold text-xs border-none p-0 focus:outline-none cursor-pointer text-cyan-300"
            >
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">
                  {emp.name} ({emp.role} - {emp.department})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: My Digital Identity Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-400" />
                Thẻ Danh Tính Số Của Tôi
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Đã Xác Thực CA
              </span>
            </div>

            {currentEmp ? (
              <div className="space-y-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Họ và tên:</span>
                    <span className="font-bold text-white">{currentEmp.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email công vụ:</span>
                    <span className="text-cyan-400">{currentEmp.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chức vụ & Đơn vị:</span>
                    <span className="text-slate-300">{currentEmp.role} - {currentEmp.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Key ID OpenPGP:</span>
                    <span className="font-mono text-cyan-300 font-bold">{currentEmp.keyID}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hiệu lực đến:</span>
                    <span className="text-slate-300">{new Date(currentEmp.expiresAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                {/* Fingerprint */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Dấu vân tay số (Fingerprint):</span>
                    <button
                      onClick={() => handleCopy(currentEmp.fingerprint)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-slate-400 break-all select-all">
                    {currentEmp.fingerprint}
                  </p>
                </div>

                {/* Download Actions */}
                <div className="pt-2 space-y-2">
                  <button
                    onClick={handleDownloadPublic}
                    className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Tải Public Key Đã Chứng Thực (.asc)
                  </button>
                  {currentEmp.demoPrivateKeyArmored && (
                    <button
                      onClick={handleDownloadPrivate}
                      className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                    >
                      <Key className="h-4 w-4 text-amber-400" />
                      Tải Khóa Bí Mật Private Key (Cá Nhân)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">Chưa có chứng chỉ nhân viên nào.</p>
            )}
          </div>
        </div>

        {/* Right: Quick Document Signer */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-cyan-400" />
              Ký Số Văn Bản / Phiếu Trình Của Tôi
            </h2>
            <span className="text-xs text-slate-400">
              Ký bằng danh nghĩa: <span className="font-semibold text-cyan-300">{currentEmp?.name}</span>
            </span>
          </div>

          <form onSubmit={handleSignDocument} className="space-y-4 text-xs">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSignInputType('text')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  signInputType === 'text'
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <FileText className="h-4 w-4" />
                Văn bản Nội bộ (Clearsign)
              </button>
              <button
                type="button"
                onClick={() => setSignInputType('file')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  signInputType === 'file'
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <Upload className="h-4 w-4" />
                Tệp tin PDF / Đính kèm
              </button>
            </div>

            {signInputType === 'text' ? (
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Nội dung văn bản / tờ trình:</label>
                <textarea
                  rows={5}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            ) : (
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Chọn tệp tin cần ký:</label>
                <input
                  type="file"
                  onChange={(e) => setSignFile(e.target.files[0])}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-300 cursor-pointer"
                />
              </div>
            )}

            {signError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{signError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={signingLoading || !currentEmp}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2"
            >
              {signingLoading ? 'Đang thực hiện ký số...' : 'Ký Số & Xuất Chữ Ký Điện Tử Ngay'}
            </button>
          </form>

          {/* Sign Result */}
          {signResult && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Ký số thành công!
                </span>
                <span className="text-[11px] font-mono text-slate-400">Key: {signResult.signerKeyID}</span>
              </div>
              <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-cyan-300 max-h-36 overflow-x-auto select-all">
                {signResult.signatureArmored}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
