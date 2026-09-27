import React, { useState } from 'react';
import { 
  Mail, Send, Lock, Unlock, ShieldCheck, CheckCircle2, 
  AlertTriangle, Key, Building2, Eye, RefreshCw, Copy, Check
} from 'lucide-react';
import { CA_API } from '../api';

export default function B2BMessagingView({ 
  messages, 
  directory, 
  caInfo, 
  onRefresh 
}) {
  const [activeView, setActiveView] = useState('inbox'); // 'inbox' | 'compose' | 'detail'
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Compose state
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [composeSuccess, setComposeSuccess] = useState(false);

  // Decrypt state
  const [decryptPassphrase, setDecryptPassphrase] = useState('');
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [decryptedResult, setDecryptedResult] = useState(null);
  const [decryptError, setDecryptError] = useState('');
  const [copied, setCopied] = useState(false);

  // Filter partners & internal entities
  const partners = (directory || []).filter(d => d.keyType === 'external_partner');
  const internalEntities = (directory || []).filter(d => d.keyType !== 'external_partner' && (d.demoPrivateKeyArmored || d.isCA));

  // Initialize compose selectors
  React.useEffect(() => {
    if (!selectedRecipientId && partners.length > 0) {
      setSelectedRecipientId(partners[0].id);
    }
    if (!selectedSenderId && internalEntities.length > 0) {
      setSelectedSenderId(internalEntities[0].id);
    }
  }, [partners, internalEntities]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setComposeLoading(true);
    setComposeError('');
    setComposeSuccess(false);

    try {
      const recipient = (directory || []).find(d => d.id === selectedRecipientId);
      const sender = (directory || []).find(d => d.id === selectedSenderId);

      if (!recipient || !sender) {
        throw new Error('Vui lòng chọn cả đơn vị gửi và đối tác nhận.');
      }

      // Lấy Private Key của người gửi (nếu là CA root thì lấy từ CA Config hoặc nếu là nhân viên thì lấy demoPrivateKey)
      let senderPrivKey = sender.demoPrivateKeyArmored;
      if (sender.isCA && caInfo?.privateKeyArmored) {
        senderPrivKey = caInfo.privateKeyArmored;
      }

      if (!senderPrivKey) {
        throw new Error('Không tìm thấy Private Key của bên gửi để thực hiện ký số.');
      }

      const res = await CA_API.sendB2BMessage({
        senderOrg: sender.organizationName,
        senderEmail: sender.contactEmail || caInfo.email,
        senderPrivateKeyArmored: senderPrivKey,
        senderPassphrase: sender.isCA ? 'EnterpriseRootCAPassphrase@2026' : '',
        recipientOrg: recipient.organizationName,
        recipientEmail: recipient.contactEmail,
        recipientPublicKeyArmored: recipient.publicKeyArmored,
        subject: composeSubject,
        content: composeContent
      });

      if (res.success) {
        setComposeSuccess(true);
        setComposeSubject('');
        setComposeContent('');
        if (onRefresh) onRefresh();
        setTimeout(() => {
          setActiveView('inbox');
          setComposeSuccess(false);
        }, 1200);
      } else {
        setComposeError(res.error || 'Lỗi khi gửi bản tin B2B.');
      }
    } catch (err) {
      setComposeError(err.response?.data?.error || err.message);
    } finally {
      setComposeLoading(false);
    }
  };

  const handleOpenMessage = (msg) => {
    setSelectedMessage(msg);
    setDecryptedResult(null);
    setDecryptError('');
    setActiveView('detail');
  };

  const handleDecryptMessage = async () => {
    if (!selectedMessage) return;
    setDecryptLoading(true);
    setDecryptError('');

    try {
      // Tìm khóa của người nhận trong danh bạ để giải mã
      const recipient = (directory || []).find(d => d.keyID === selectedMessage.recipientKeyID);
      const sender = (directory || []).find(d => d.keyID === selectedMessage.senderKeyID);

      let recipientPrivKey = recipient?.demoPrivateKeyArmored || recipient?.privateKeyArmoredDemo;
      let passphrase = '';

      if (selectedMessage.recipientKeyID === caInfo?.keyID) {
        recipientPrivKey = caInfo.privateKeyArmored;
        passphrase = 'EnterpriseRootCAPassphrase@2026';
      }

      if (!recipientPrivKey) {
        throw new Error('Chưa có Private Key của bên nhận để giải mã bản tin này.');
      }

      const senderPubKey = sender?.publicKeyArmored;
      if (!senderPubKey) {
        throw new Error('Không tìm thấy Public Key của bên gửi trong Danh bạ để đối chiếu chữ ký.');
      }

      const res = await CA_API.decryptB2BMessage({
        encryptedPayloadArmored: selectedMessage.encryptedPayloadArmored,
        recipientPrivateKeyArmored: recipientPrivKey,
        recipientPassphrase: passphrase,
        senderPublicKeyArmored: senderPubKey
      });

      if (res.success) {
        setDecryptedResult(res.result);
      } else {
        setDecryptError(res.error || 'Lỗi giải mã bản tin.');
      }
    } catch (err) {
      setDecryptError(err.response?.data?.error || err.message);
    } finally {
      setDecryptLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            B2B Secure Messaging & Data Exchange
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Trao đổi tin nhắn, báo giá & hợp đồng mật giữa các doanh nghiệp (Mã hóa E2E & Ký số OpenPGP)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('inbox')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'inbox'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hộp Thư Bản Tin ({messages?.length || 0})
          </button>
          <button
            onClick={() => {
              setActiveView('compose');
              setComposeError('');
              setComposeSuccess(false);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-600/30"
          >
            <Send className="h-4 w-4" />
            Soạn Tin Mật B2B
          </button>
        </div>
      </div>

      {/* VIEW 1: INBOX LIST */}
      {activeView === 'inbox' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Danh sách Thông điệp Mật Đã Trao Đổi
            </span>
            <button
              onClick={onRefresh}
              className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </button>
          </div>

          <div className="divide-y divide-slate-800/70">
            {(!messages || messages.length === 0) ? (
              <div className="py-16 text-center text-slate-500">
                <Mail className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm">Chưa có tin nhắn B2B nào.</p>
                <p className="text-xs text-slate-600 mt-1">Nhấn 'Soạn Tin Mật B2B' để bắt đầu gửi thông điệp.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleOpenMessage(msg)}
                  className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-800/80 text-purple-400 mt-0.5">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm hover:text-cyan-400 transition-colors">
                          {msg.subject}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-400 border border-slate-700">
                          PGP ENCRYPTED
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-slate-300 font-medium">{msg.senderOrg}</span>
                        <span className="text-slate-600">&rarr;</span>
                        <span className="text-slate-300 font-medium">{msg.recipientOrg}</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-[11px] font-mono text-slate-500">Người gửi: {msg.senderKeyID}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 self-end md:self-center">
                    <span>{new Date(msg.sentAt).toLocaleString('vi-VN')}</span>
                    <button className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: COMPOSE NEW MESSAGE */}
      {activeView === 'compose' && (
        <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="h-5 w-5 text-cyan-400" />
              Soạn Thông Điệp Mật B2B (Mã hóa E2E & Ký số)
            </h2>
            <button
              onClick={() => setActiveView('inbox')}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Hủy bỏ & Quay lại
            </button>
          </div>

          <form onSubmit={handleSendMessage} className="space-y-4">
            {/* Sender selection */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Bên Gửi (Đơn vị nội bộ ký số bằng Private Key):
              </label>
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {internalEntities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.organizationName} - {ent.contactName} [KeyID: {ent.keyID}]
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient selection */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Bên Nhận (Doanh nghiệp đối tác được mã hóa bằng Public Key):
              </label>
              <select
                value={selectedRecipientId}
                onChange={(e) => setSelectedRecipientId(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    🏢 {p.organizationName} ({p.contactEmail}) [KeyID: {p.keyID}]
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Tiêu đề thông điệp:</label>
              <input
                type="text"
                required
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="[MẬT] Đề xuất hợp tác & Thỏa thuận bảo mật thông tin NDA..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Content */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Nội dung văn bản / dữ liệu trao đổi:</label>
              <textarea
                rows={6}
                required
                value={composeContent}
                onChange={(e) => setComposeContent(e.target.value)}
                placeholder="Nhập nội dung thỏa thuận, điều khoản thanh toán hoặc dữ liệu mật cần chuyển giao an toàn..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {composeError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{composeError}</span>
              </div>
            )}

            {composeSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Đã mã hóa và chuyển phát bản tin B2B thành công!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={composeLoading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2"
            >
              {composeLoading ? 'Đang Mã hóa PGP & Ký số...' : 'Mã hóa E2E & Ký số OpenPGP'}
            </button>
          </form>
        </div>
      )}

      {/* VIEW 3: DETAIL & DECRYPTION */}
      {activeView === 'detail' && selectedMessage && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Encrypted Envelope */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-400" />
                Bao Thư Điện tử Mã hóa (PGP Envelope)
              </h2>
              <button
                onClick={() => setActiveView('inbox')}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                &larr; Trở về
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Tiêu đề:</span>
                <span className="text-white font-semibold">{selectedMessage.subject}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Doanh nghiệp gửi:</span>
                <span className="text-cyan-400 font-medium">{selectedMessage.senderOrg}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Key ID bên gửi:</span>
                <span className="font-mono text-purple-300">{selectedMessage.senderKeyID}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Thời gian gửi:</span>
                <span className="text-slate-300">{new Date(selectedMessage.sentAt).toLocaleString('vi-VN')}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Dữ liệu PGP Armored Mã hóa:</span>
                <button
                  onClick={() => handleCopy(selectedMessage.encryptedPayloadArmored)}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>Sao chép</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-mono text-purple-300 overflow-x-auto max-h-56 select-all">
                {selectedMessage.encryptedPayloadArmored}
              </pre>
            </div>

            <button
              onClick={handleDecryptMessage}
              disabled={decryptLoading}
              className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
            >
              <Unlock className="h-4 w-4" />
              {decryptLoading ? 'Đang giải mã bằng Private Key...' : 'Mở Khóa & Xác Thực Chữ Ký Người Gửi'}
            </button>
          </div>

          {/* Decrypted Payload & Signature Verification Result */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Unlock className="h-4 w-4 text-emerald-400" />
              Nội Dung Đã Giải Mã & Tem Xác Thực
            </h2>

            {decryptError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{decryptError}</span>
              </div>
            )}

            {!decryptedResult ? (
              <div className="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <Lock className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs">Thông điệp đang được khóa bảo vệ.</p>
                <p className="text-[11px] text-slate-600 mt-1">Nhấn nút "Mở Khóa" bên trái để xem nội dung.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Signature status banner */}
                <div className="p-3 bg-emerald-950/50 border border-emerald-600 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span>CHỮ KÝ ĐỐI TÁC HỢP LỆ & XÁC THỰC DANH TÍNH 100%</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Bản tin do chính xác <span className="font-semibold text-cyan-300">{selectedMessage.senderOrg}</span> ký số bằng KeyID <span className="font-mono text-purple-300">{decryptedResult.signerKeyID}</span>. Không bị giả mạo hay đánh cắp.
                  </p>
                </div>

                {/* Plaintext body */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2 uppercase tracking-wider">
                    Văn bản giải mã nguyên bản:
                  </span>
                  <div className="text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                    {typeof decryptedResult.decryptedContent === 'object'
                      ? JSON.stringify(decryptedResult.decryptedContent, null, 2)
                      : decryptedResult.decryptedContent}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
