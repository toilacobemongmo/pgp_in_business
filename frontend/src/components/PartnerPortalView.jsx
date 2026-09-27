import React, { useState } from 'react';
import { 
  Building2, Globe, Shield, Download, Lock, Send, CheckCircle2, 
  AlertTriangle, Users, Mail, Copy, Check, FileText
} from 'lucide-react';
import { CA_API } from '../api';

export default function PartnerPortalView({ 
  caInfo, 
  directory, 
  messages, 
  onRefresh 
}) {
  const [partnerOrg, setPartnerOrg] = useState('Tập đoàn Tài chính & Ngân hàng FINCORP');
  const [partnerEmail, setPartnerEmail] = useState('b2b-gateway@fincorp.partner');
  const [targetInternalKeyId, setTargetInternalKeyId] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sendingLoading, setSendingLoading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState('');
  const [copiedRoot, setCopiedRoot] = useState(false);

  // Lọc các đại diện nội bộ công ty có thể nhận tin
  const internalSigners = (directory || []).filter(d => d.keyType !== 'external_partner');
  const partnerEntry = (directory || []).find(d => d.keyType === 'external_partner') || {};

  React.useEffect(() => {
    if (!targetInternalKeyId && internalSigners.length > 0) {
      setTargetInternalKeyId(internalSigners[0].id);
    }
  }, [internalSigners, targetInternalKeyId]);

  const handleDownloadCaKey = () => {
    if (!caInfo?.publicKeyArmored) return;
    const blob = new Blob([caInfo.publicKeyArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enterprise-corporate-root-ca.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setSendingLoading(true);
    setSendError('');
    setSendSuccess(false);

    try {
      const targetEmp = internalSigners.find(s => s.id === targetInternalKeyId);
      if (!targetEmp) throw new Error('Vui lòng chọn đại diện doanh nghiệp để gửi tới.');

      // Sử dụng demo private key của đối tác đã được seed trong DB
      const partnerPrivKey = partnerEntry.privateKeyArmoredDemo;
      if (!partnerPrivKey) {
        throw new Error('Chưa cấu hình Private Key của đối tác B2B.');
      }

      const res = await CA_API.sendB2BMessage({
        senderOrg: partnerOrg,
        senderEmail: partnerEmail,
        senderPrivateKeyArmored: partnerPrivKey,
        senderPassphrase: '',
        recipientOrg: 'Tập đoàn An ninh Doanh nghiệp (Nội bộ)',
        recipientEmail: targetEmp.contactEmail || caInfo.email,
        recipientPublicKeyArmored: targetEmp.publicKeyArmored,
        subject,
        content
      });

      if (res.success) {
        setSendSuccess(true);
        setSubject('');
        setContent('');
        if (onRefresh) onRefresh();
      } else {
        setSendError(res.error || 'Lỗi gửi tin nhắn.');
      }
    } catch (err) {
      setSendError(err.response?.data?.error || err.message);
    } finally {
      setSendingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-800/50 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-950 text-purple-400 border border-purple-700">
              Cổng Đối Tác Liên Kết (B2B Partner Gateway)
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Giao Dịch Bảo Mật & Kết Nối Tin Cậy B2B
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dành cho các doanh nghiệp đối tác ngoài tải chứng chỉ Root CA và gửi tài liệu mã hóa E2E
          </p>
        </div>

        {/* Partner Identity Indicator */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Tổ chức đối tác:</span>
            <span className="text-xs font-bold text-purple-300 block">{partnerOrg}</span>
            <span className="text-[10px] text-slate-500">{partnerEmail}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Establish Trust & Directory */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1: Trust Establishment */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Shield className="h-5 w-5" />
              <span>Bước 1: Thiết lập Tin cậy Root CA</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tải chứng chỉ gốc Corporate Root CA để nhập vào máy chủ hoặc phần mềm của Quý doanh nghiệp. Tất cả văn bản do công ty chúng tôi ký sẽ tự động được phần mềm của bạn thẩm định hợp lệ.
            </p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
              <div className="text-slate-400">Root Key ID: <span className="text-cyan-400 font-bold">{caInfo?.keyID}</span></div>
              <div className="text-slate-400 truncate">Fingerprint: <span className="text-slate-300 text-[10px]">{caInfo?.fingerprint}</span></div>
            </div>

            <button
              onClick={handleDownloadCaKey}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <Download className="h-4 w-4" />
              Tải Chứng Chỉ Gốc (corporate-root-ca.asc)
            </button>
          </div>

          {/* Authorized Signers Directory */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Users className="h-5 w-5 text-blue-400" />
              <span>Cán Bộ Có Thẩm Quyền Ký Kết Của Chúng Tôi</span>
            </div>
            <div className="divide-y divide-slate-800/80 text-xs">
              {internalSigners.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">{s.contactName || s.organizationName}</div>
                    <div className="text-[11px] text-slate-400">{s.department}</div>
                  </div>
                  <span className="font-mono text-[11px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                    {s.keyID}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Send Encrypted B2B Payload */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-white text-base">
              <Lock className="h-5 w-5 text-purple-400" />
              <span>Bước 2: Gửi Báo Giá / Thông Điệp Mật (Mã hóa E2E & Ký số)</span>
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Gửi tới Cán bộ / Bộ phận nhận:</label>
              <select
                value={targetInternalKeyId}
                onChange={(e) => setTargetInternalKeyId(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500 text-xs"
              >
                {internalSigners.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.contactName || emp.organizationName} ({emp.department}) [KeyID: {emp.keyID}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Tiêu đề thông điệp giao dịch:</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="[B2B MẬT] Báo giá chính thức dự án tài chính Q4/2026..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Nội dung văn bản / dữ liệu cần bảo mật:</label>
              <textarea
                rows={6}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập thông tin thanh toán, số tài khoản ngân hàng, hạn mức tín dụng hoặc hợp đồng mật..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            {sendError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {sendSuccess && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Đã mã hóa bằng Public Key của bên nhận & Ký số chuyển phát thành công!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={sendingLoading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" />
              {sendingLoading ? 'Đang mã hóa OpenPGP & Ký số...' : 'Mã hóa E2E & Gửi Tới Doanh Nghiệp'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
