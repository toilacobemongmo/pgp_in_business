import React, { useState } from 'react';
import { 
  FileCheck, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, 
  Upload, Copy, Check, Download, FileText, FileCode, ArrowRight, ShieldAlert, Key
} from 'lucide-react';
import { CA_API } from '../api';

export default function DocumentSigningView({ certificates, directory, caInfo, onSignSuccess }) {
  const [subTab, setSubTab] = useState('sign'); // 'sign' | 'verify'

  // Signing state
  const [signInputType, setSignInputType] = useState('text'); // 'text' | 'file'
  const [textContent, setTextContent] = useState('HỢP ĐỒNG KINH TẾ SỐ: 8899/2026/HD-ENT\nBên A: Tập đoàn An ninh Doanh nghiệp\nBên B: Công ty Đối tác\nĐiều 1: Cung cấp giải pháp xác thực chữ ký số và bảo mật dữ liệu.\nGiá trị: 1,500,000,000 VND.');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSignerId, setSelectedSignerId] = useState('');
  const [customPrivateKey, setCustomPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [signingLoading, setSigningLoading] = useState(false);
  const [signResult, setSignResult] = useState(null);
  const [signError, setSignError] = useState('');

  // Verification state
  const [verifyType, setVerifyType] = useState('text'); // 'text' | 'file'
  const [verifyTextContent, setVerifyTextContent] = useState('');
  const [verifySignatureArmored, setVerifySignatureArmored] = useState('');
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifySignerKeyOption, setVerifySignerKeyOption] = useState('');
  const [verifyCustomPublicKey, setVerifyCustomPublicKey] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  const [copied, setCopied] = useState(false);

  // Available signers from certificates that have demoPrivateKeyArmored
  const availableSigners = (certificates || []).filter(c => c.status === 'active' && c.demoPrivateKeyArmored);

  // Auto select first signer if not selected
  React.useEffect(() => {
    if (!selectedSignerId && availableSigners.length > 0) {
      setSelectedSignerId(availableSigners[0].id);
    }
  }, [availableSigners, selectedSignerId]);

  // Handle Signing
  const handleSign = async (e) => {
    e.preventDefault();
    setSigningLoading(true);
    setSignError('');
    setSignResult(null);

    try {
      let privKeyToUse = customPrivateKey;
      let signerName = 'Tùy chỉnh';

      if (selectedSignerId !== 'custom') {
        const found = availableSigners.find(s => s.id === selectedSignerId);
        if (found) {
          privKeyToUse = found.demoPrivateKeyArmored;
          signerName = found.name;
        }
      }

      if (!privKeyToUse) {
        throw new Error('Vui lòng chọn hoặc nhập Private Key của người ký.');
      }

      const formData = new FormData();
      if (signInputType === 'file') {
        if (!selectedFile) throw new Error('Vui lòng chọn một tệp tin để ký.');
        formData.append('file', selectedFile);
      } else {
        if (!textContent.trim()) throw new Error('Vui lòng nhập nội dung văn bản để ký.');
        formData.append('textContent', textContent);
      }

      formData.append('signerPrivateKeyArmored', privKeyToUse);
      formData.append('signerPassphrase', passphrase);

      const res = await CA_API.signDocument(formData);
      if (res.success) {
        setSignResult(res.signedDocument);
        if (onSignSuccess) onSignSuccess();
      } else {
        setSignError(res.error || 'Lỗi khi ký tài liệu.');
      }
    } catch (err) {
      setSignError(err.response?.data?.error || err.message);
    } finally {
      setSigningLoading(false);
    }
  };

  // Handle Verification
  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifyError('');
    setVerifyResult(null);

    try {
      let pubKeyToUse = verifyCustomPublicKey;
      if (verifySignerKeyOption !== 'custom') {
        const found = (directory || []).find(d => d.id === verifySignerKeyOption);
        if (found) {
          pubKeyToUse = found.publicKeyArmored;
        }
      }

      if (!pubKeyToUse) {
        throw new Error('Vui lòng chọn hoặc nhập Public Key của người ký để đối chiếu.');
      }

      const formData = new FormData();
      if (verifyType === 'file') {
        if (!verifyFile) throw new Error('Vui lòng chọn tệp tin gốc cần kiểm tra.');
        formData.append('file', verifyFile);
        formData.append('signatureArmored', verifySignatureArmored);
      } else {
        if (!verifyTextContent.trim()) throw new Error('Vui lòng nhập văn bản đã ký hoặc tệp PGP Clearsigned.');
        formData.append('textContent', verifyTextContent);
        if (verifySignatureArmored) {
          formData.append('signatureArmored', verifySignatureArmored);
        }
      }

      formData.append('signerPublicKeyArmored', pubKeyToUse);

      const res = await CA_API.verifyDocument(formData);
      if (res.success) {
        setVerifyResult(res.verification);
      } else {
        setVerifyError(res.error || 'Lỗi xác minh tài liệu.');
      }
    } catch (err) {
      setVerifyError(err.response?.data?.error || err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSignature = () => {
    if (!signResult?.signatureArmored) return;
    const blob = new Blob([signResult.signatureArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${signResult.documentName}.sig.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Sub Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Ký số & Xác thực Tài liệu OpenPGP
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Bảo đảm tính toàn vẹn, chống chối bỏ và liên kết chuỗi tin cậy CA Doanh nghiệp
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setSubTab('sign')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subTab === 'sign'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ✍️ Ký số Tài liệu
          </button>
          <button
            onClick={() => setSubTab('verify')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subTab === 'verify'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🛡️ Xác thực Chữ ký số
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: KÝ SỐ TÀI LIỆU                                     */}
      {/* ========================================================= */}
      {subTab === 'sign' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-cyan-400" />
              Thiết lập Ký số Điện tử
            </h2>

            <form onSubmit={handleSign} className="space-y-4">
              {/* Type Switcher: Text vs File */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Định dạng tài liệu cần ký:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSignInputType('text')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      signInputType === 'text'
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    Văn bản (Inline Clearsign)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignInputType('file')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      signInputType === 'file'
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    Tệp tin rời (Detached File Sig)
                  </button>
                </div>
              </div>

              {/* Text Input */}
              {signInputType === 'text' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Nội dung văn bản / hợp đồng:</label>
                  <textarea
                    rows={6}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Nhập nội dung văn bản, nghị quyết, thông báo hoặc báo giá..."
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Chọn tệp tin (PDF, DOCX, ZIP, Ảnh...):</label>
                  <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center hover:border-cyan-500/50 transition-colors bg-slate-950/40">
                    <input
                      type="file"
                      id="sign-file-upload"
                      className="hidden"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                    />
                    <label htmlFor="sign-file-upload" className="cursor-pointer flex flex-col items-center">
                      <Upload className="h-8 w-8 text-cyan-400 mb-2" />
                      <span className="text-sm font-medium text-slate-200">
                        {selectedFile ? selectedFile.name : 'Click để chọn tệp tin hoặc kéo thả vào đây'}
                      </span>
                      {selectedFile ? (
                        <span className="text-xs text-slate-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                      ) : (
                        <span className="text-xs text-slate-500 mt-1">Hỗ trợ mọi định dạng nhị phân tối đa 25MB</span>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Signer Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Cán bộ thực hiện Ký số:</label>
                <select
                  value={selectedSignerId}
                  onChange={(e) => setSelectedSignerId(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {availableSigners.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role} - {s.department}) [KeyID: {s.keyID}]
                    </option>
                  ))}
                  <option value="custom">-- Tự nhập OpenPGP Private Key khác --</option>
                </select>
              </div>

              {selectedSignerId === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Khóa Bí mật (Armored Private Key):</label>
                    <textarea
                      rows={4}
                      value={customPrivateKey}
                      onChange={(e) => setCustomPrivateKey(e.target.value)}
                      placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Mật khẩu khóa (Passphrase - nếu có):</label>
                    <input
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Nhập passphrase..."
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                    />
                  </div>
                </div>
              )}

              {signError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{signError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={signingLoading}
                className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-all shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2"
              >
                {signingLoading ? 'Đang thực hiện Ký số OpenPGP...' : 'Thực hiện Ký số Ngay'}
              </button>
            </form>
          </div>

          {/* Signing Result Panel */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Kết quả Chữ ký số
              </h2>

              {!signResult ? (
                <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  <FileCode className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm">Chưa có tài liệu nào được ký.</p>
                  <p className="text-xs text-slate-600 mt-1">Vui lòng điền thông tin bên trái và nhấn Ký số.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/80 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      Ký số tài liệu thành công!
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Tệp: <span className="text-slate-200 font-medium">{signResult.documentName}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Người ký: <span className="text-cyan-400 font-medium">{signResult.signerUser}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Loại: <span className="text-purple-300 font-mono">{signResult.signType}</span>
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Chữ ký số PGP Armored:</span>
                      <button
                        onClick={() => handleCopy(signResult.signatureArmored)}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                    <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-52 scrollbar-none">
                      {signResult.signatureArmored}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {signResult && (
              <div className="pt-4 mt-4 border-t border-slate-800 flex gap-2">
                <button
                  onClick={handleDownloadSignature}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                >
                  <Download className="h-4 w-4 text-cyan-400" />
                  Tải Chữ ký (.asc)
                </button>
                <button
                  onClick={() => {
                    setSubTab('verify');
                    setVerifyTextContent(signResult.signatureArmored);
                    setVerifySignatureArmored(signResult.signatureArmored);
                  }}
                  className="py-2.5 px-4 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-medium border border-cyan-500/40 transition-colors"
                >
                  Thử Xác thực ngay &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: XÁC THỰC CHỮ KÝ SỐ                                */}
      {/* ========================================================= */}
      {subTab === 'verify' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Kiểm tra & Xác thực Chữ ký số
            </h2>

            <form onSubmit={handleVerify} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Loại tài liệu cần xác thực:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyType('text')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      verifyType === 'text'
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    Văn bản Clearsigned
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyType('file')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      verifyType === 'file'
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    Tệp tin gốc + File .asc rời
                  </button>
                </div>
              </div>

              {verifyType === 'text' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Dán văn bản có chứa PGP Signed Block:
                  </label>
                  <textarea
                    rows={6}
                    value={verifyTextContent}
                    onChange={(e) => setVerifyTextContent(e.target.value)}
                    placeholder="-----BEGIN PGP SIGNED MESSAGE-----&#10;Hash: SHA256&#10;...&#10;-----BEGIN PGP SIGNATURE-----&#10;..."
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Tệp tin gốc cần kiểm tra:</label>
                    <input
                      type="file"
                      onChange={(e) => setVerifyFile(e.target.files[0])}
                      className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-300 hover:file:bg-cyan-900 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Chữ ký số PGP (.asc) rời:</label>
                    <textarea
                      rows={3}
                      value={verifySignatureArmored}
                      onChange={(e) => setVerifySignatureArmored(e.target.value)}
                      placeholder="-----BEGIN PGP SIGNATURE-----&#10;..."
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300"
                    />
                  </div>
                </div>
              )}

              {/* Public Key Selection for Verification */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Public Key của Người ký (để đối chiếu xác thực):
                </label>
                <select
                  value={verifySignerKeyOption}
                  onChange={(e) => setVerifySignerKeyOption(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Chọn Khóa từ Danh bạ CA Doanh nghiệp --</option>
                  {(directory || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.contactName || d.organizationName} ({d.organizationName}) [KeyID: {d.keyID}]
                    </option>
                  ))}
                  <option value="custom">-- Dán OpenPGP Public Key tự do --</option>
                </select>
              </div>

              {verifySignerKeyOption === 'custom' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Dán Armored Public Key:</label>
                  <textarea
                    rows={4}
                    value={verifyCustomPublicKey}
                    onChange={(e) => setVerifyCustomPublicKey(e.target.value)}
                    placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300"
                  />
                </div>
              )}

              {verifyError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyLoading}
                className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                {verifyLoading ? 'Đang giải mã và kiểm tra chữ ký...' : 'Kiểm tra Tính Toàn vẹn & Chuỗi CA'}
              </button>
            </form>
          </div>

          {/* Verification Result Panel */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
              Báo cáo Kiểm tra Tính Hợp lệ
            </h2>

            {!verifyResult ? (
              <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <ShieldCheck className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm">Chưa có kết quả xác minh.</p>
                <p className="text-xs text-slate-600 mt-1">Dán tài liệu và chọn Public Key đối chiếu để thẩm định.</p>
              </div>
            ) : verifyResult.isValid ? (
              <div className="space-y-4">
                {/* Validity Badge */}
                <div className="p-4 bg-emerald-950/50 border border-emerald-600 rounded-xl">
                  <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                    <span>CHỮ KÝ SỐ HỢP LỆ (VERIFIED)</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    Dữ liệu nguyên vẹn 100%, không bị can thiệp hay sửa đổi kể từ thời điểm ký số.
                  </p>
                </div>

                {/* CA Certification Status */}
                <div className={`p-4 rounded-xl border ${
                  verifyResult.isCertifiedByCA 
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200' 
                    : 'bg-amber-950/40 border-amber-600 text-amber-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    {verifyResult.isCertifiedByCA ? (
                      <>
                        <ShieldCheck className="h-5 w-5 text-cyan-400" />
                        <span>CHỨNG NHẬN BỞI CORPORATE ROOT CA</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                        <span>KHÓA KHÔNG ĐƯỢC CA CHỨNG THỰC (SELF-SIGNED)</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs opacity-90">{verifyResult.caCheckDetail}</p>
                </div>

                {/* Revocation check */}
                {verifyResult.isRevoked && (
                  <div className="p-3 bg-rose-950/80 border border-rose-600 rounded-lg text-rose-200 text-xs flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
                    <div>
                      <span className="font-bold block">CẢNH BÁO: CHỨNG CHỈ NÀY ĐÃ BỊ THU HỒI!</span>
                      <span>Lý do: {verifyResult.revocationReason}</span>
                    </div>
                  </div>
                )}

                {/* Signer Details */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Danh tính người ký:</span>
                    <span className="font-semibold text-white">{verifyResult.signerIdentity}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Key ID:</span>
                    <span className="font-mono text-cyan-400 font-bold">{verifyResult.signerKeyID}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Thời điểm ký:</span>
                    <span className="text-slate-300">
                      {new Date(verifyResult.signatureDate).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Dấu vân tay (Fingerprint):</span>
                    <span className="font-mono text-[10px] text-slate-400 break-all select-all">
                      {verifyResult.signerFingerprint}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-950/50 border border-rose-600 rounded-xl">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                  <XCircle className="h-6 w-6 text-rose-400 shrink-0" />
                  <span>XÁC THỰC THẤT BẠI</span>
                </div>
                <p className="text-xs text-rose-300 mt-2">{verifyResult.error}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
