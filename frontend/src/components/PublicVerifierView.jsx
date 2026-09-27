import React, { useState } from 'react';
import { 
  ShieldCheck, Upload, FileText, CheckCircle2, XCircle, 
  AlertTriangle, ShieldAlert, Key, Search, FileCode
} from 'lucide-react';
import { CA_API } from '../api';

export default function PublicVerifierView({ directory }) {
  const [inputType, setInputType] = useState('text'); // 'text' | 'file'
  const [textContent, setTextContent] = useState('');
  const [targetFile, setTargetFile] = useState(null);
  const [detachedSignature, setDetachedSignature] = useState('');
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Default select first key in directory if none
  React.useEffect(() => {
    if (!selectedKeyId && (directory || []).length > 0) {
      setSelectedKeyId(directory[0].id);
    }
  }, [directory, selectedKeyId]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      let pubKeyArmored = customKey;
      if (selectedKeyId !== 'custom') {
        const found = (directory || []).find(d => d.id === selectedKeyId);
        if (found) pubKeyArmored = found.publicKeyArmored;
      }

      if (!pubKeyArmored) {
        throw new Error('Vui lòng chọn hoặc nhập Public Key của người ký để đối chiếu.');
      }

      const formData = new FormData();
      if (inputType === 'file') {
        if (!targetFile) throw new Error('Vui lòng chọn tệp tin cần kiểm tra.');
        formData.append('file', targetFile);
        formData.append('signatureArmored', detachedSignature);
      } else {
        if (!textContent.trim()) throw new Error('Vui lòng dán văn bản kèm khối PGP Signed Message.');
        formData.append('textContent', textContent);
      }

      formData.append('signerPublicKeyArmored', pubKeyArmored);

      const res = await CA_API.verifyDocument(formData);
      if (res.success) {
        setResult(res.verification);
      } else {
        setError(res.error || 'Lỗi thẩm định tài liệu.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Welcome */}
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-semibold">
          <ShieldCheck className="h-4 w-4" />
          <span>Cổng Giám Định Chữ Ký Số Công Khai (Public Trust Verifier)</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Xác Thực Tính Toàn Vẹn & Mộc Chứng Nhận Doanh Nghiệp
        </h1>
        <p className="text-xs text-slate-400 max-w-xl mx-auto">
          Dành cho khách hàng, kiểm toán viên và cơ quan chức năng kiểm tra tính pháp lý của văn bản và chứng thực OpenPGP do Enterprise Root CA phát hành.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <form onSubmit={handleVerify} className="space-y-4 text-xs">
          {/* Format Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setInputType('text')}
              className={`py-2.5 px-3 rounded-xl border font-semibold flex items-center justify-center gap-2 transition-all ${
                inputType === 'text'
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              <FileText className="h-4 w-4" />
              Dán Văn Bản Có Chữ Ký (Clearsign)
            </button>
            <button
              type="button"
              onClick={() => setInputType('file')}
              className={`py-2.5 px-3 rounded-xl border font-semibold flex items-center justify-center gap-2 transition-all ${
                inputType === 'file'
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              <Upload className="h-4 w-4" />
              Tải Tệp Tin PDF / File Rời + Chữ ký
            </button>
          </div>

          {/* Inputs */}
          {inputType === 'text' ? (
            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Dán toàn bộ văn bản có chứa PGP Signed Block:
              </label>
              <textarea
                rows={6}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="-----BEGIN PGP SIGNED MESSAGE-----&#10;Hash: SHA256&#10;...&#10;-----BEGIN PGP SIGNATURE-----&#10;..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Tệp tin gốc cần giám định:</label>
                <input
                  type="file"
                  onChange={(e) => setTargetFile(e.target.files[0])}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-300 cursor-pointer"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Chữ ký số rời đính kèm (.asc / .sig):</label>
                <textarea
                  rows={3}
                  value={detachedSignature}
                  onChange={(e) => setDetachedSignature(e.target.value)}
                  placeholder="-----BEGIN PGP SIGNATURE-----&#10;..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300"
                />
              </div>
            </div>
          )}

          {/* Key Selection */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Khóa công khai của người ký (để đối chiếu):
            </label>
            <select
              value={selectedKeyId}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
            >
              <option value="">-- Chọn Khóa từ Danh bạ Doanh nghiệp --</option>
              {(directory || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.contactName || d.organizationName} ({d.organizationName}) [KeyID: {d.keyID}]
                </option>
              ))}
              <option value="custom">-- Tự dán Public Key của người ký --</option>
            </select>
          </div>

          {selectedKeyId === 'custom' && (
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Dán Armored Public Key:</label>
              <textarea
                rows={4}
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300"
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            {loading ? 'Đang thẩm định mật mã...' : 'Thẩm Định Tính Hợp Lệ & Chuỗi CA Ngay'}
          </button>
        </form>

        {/* Verification Result Display */}
        {result && (
          <div className="pt-4 border-t border-slate-800 space-y-4">
            {result.isValid ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/60 border border-emerald-500 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                    <span>TÀI LIỆU CHÍNH XÁC & CHỮ KÝ SỐ HỢP LỆ (VERIFIED)</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    Dữ liệu được bảo toàn tuyệt đối, không có bất kỳ sửa đổi nào kể từ thời điểm ký.
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${
                  result.isCertifiedByCA 
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200' 
                    : 'bg-amber-950/40 border-amber-600 text-amber-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-xs mb-1">
                    {result.isCertifiedByCA ? (
                      <>
                        <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0" />
                        <span>CHỨNG NHẬN BỞI CORPORATE ROOT CA</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                        <span>KHÓA TỰ KÝ (SELF-SIGNED) - KHÔNG CÓ BẢO CHỨNG CA</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] opacity-90">{result.caCheckDetail}</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Người ký:</span>
                    <span className="font-bold text-white">{result.signerIdentity}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Key ID:</span>
                    <span className="font-mono text-cyan-400 font-bold">{result.signerKeyID}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Thời gian ký:</span>
                    <span className="text-slate-300">{new Date(result.signatureDate).toLocaleString('vi-VN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Dấu vân tay (Fingerprint):</span>
                    <span className="font-mono text-[10px] text-slate-400 break-all">{result.signerFingerprint}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-950/60 border border-rose-600 rounded-xl">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                  <XCircle className="h-6 w-6 text-rose-400 shrink-0" />
                  <span>XÁC THỰC THẤT BẠI - DỮ LIỆU ĐÃ BỊ THAY ĐỔI</span>
                </div>
                <p className="text-xs text-rose-300 mt-2">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
