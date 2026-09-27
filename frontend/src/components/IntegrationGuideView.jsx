import React, { useState } from 'react';
import { 
  BookOpen, Terminal, Mail, GitBranch, Code2, 
  Copy, Check, Download, ExternalLink, ShieldCheck
} from 'lucide-react';

export default function IntegrationGuideView({ caInfo }) {
  const [activeGuideTab, setActiveGuideTab] = useState('gpg');
  const [copiedSection, setCopiedSection] = useState(null);

  const handleCopy = (text, sectionId) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const gpgScript = `# 1. Tải Private Key (.asc) và Corporate Root CA (.asc) từ hệ thống về máy
# 2. Nhập khóa vào GnuPG / Kleopatra trên Windows:
gpg --import my_private_key.asc
gpg --import corporate-root-ca.asc

# 3. Ký số một văn bản (Clearsign - giữ nguyên nội dung dễ đọc):
gpg --clearsign hop_dong_kinh_te.txt
# Kết quả sinh ra file: hop_dong_kinh_te.txt.asc

# 4. Ký số một tệp nhị phân rời (Detached signature cho PDF, DOCX, ZIP):
gpg --armor --detach-sign bang_ke_thanh_toan.pdf
# Kết quả sinh ra file chữ ký số: bang_ke_thanh_toan.pdf.asc

# 5. Xác thực chữ ký tài liệu nhận được từ đối tác:
gpg --verify hop_dong_kinh_te.txt.asc`;

  const gitScript = `# 1. Liệt kê danh sách các khóa bí mật của bạn:
gpg --list-secret-keys --keyid-format=long

# 2. Sao chép 16 ký tự Key ID của bạn và cấu hình Git:
git config --global user.signingkey ${caInfo?.keyID || '<YOUR_KEY_ID>'}
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# 3. Thực hiện commit có ký số điện tử:
git commit -S -m "feat: nâng cấp chuẩn mật mã doanh nghiệp"

# 4. Kiểm tra chữ ký số commit:
git log --show-signature -1`;

  const emailScript = `HƯỚNG DẪN CẤU HÌNH KÝ SỐ EMAIL TRONG MOZILLA THUNDERBIRD:

1. Mở Mozilla Thunderbird trên máy tính.
2. Vào [Tools] -> [Account Settings] -> chọn tài khoản email công vụ của bạn.
3. Nhấp vào mục [End-to-End Encryption].
4. Tại phần OpenPGP, nhấp vào nút [Add Key...].
5. Chọn [Import an existing OpenPGP Key] -> chọn tệp Private Key (.asc) bạn vừa tải từ Enterprise CA Portal.
6. Đánh dấu chọn:
   [x] "Require encryption by default" (Tự động mã hóa khi gửi cho đối tác)
   [x] "Digitally sign unencrypted messages" (Tự động ký số mọi email gửi đi)
7. Hoàn tất! Từ nay mọi email gửi cho khách hàng sẽ kèm huy hiệu chữ ký số chính danh doanh nghiệp.`;

  const apiScript = `# Gọi API Ký số Tài liệu từ hệ thống ERP / CRM nội bộ:
curl -X POST http://localhost:5000/api/documents/sign \\
  -H "Content-Type: application/json" \\
  -d '{
    "textContent": "ỦY NHIỆM CHI SỐ #UNC-2026/88: Chuyển khoản 500,000,000 VND",
    "signerPrivateKeyArmored": "-----BEGIN PGP PRIVATE KEY BLOCK-----\\n...",
    "signerPassphrase": ""
  }'

# Gọi API Thẩm định Tính Toàn vẹn & Chuỗi CA:
curl -X POST http://localhost:5000/api/documents/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "textContent": "-----BEGIN PGP SIGNED MESSAGE-----\\n...",
    "signerPublicKeyArmored": "-----BEGIN PGP PUBLIC KEY BLOCK-----\\n..."
  }'`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Hướng Dẫn Tích Hợp Máy Trạm & Công Cụ Lập Trình (Integration Hub)
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Cách sử dụng các cặp khóa và chứng chỉ do Enterprise CA cấp trên phần mềm máy tính, Email và Git
        </p>
      </div>

      {/* Guide Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveGuideTab('gpg')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeGuideTab === 'gpg'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Terminal className="h-4 w-4" />
          GnuPG & Kleopatra (Windows/Linux)
        </button>
        <button
          onClick={() => setActiveGuideTab('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeGuideTab === 'email'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Mail className="h-4 w-4" />
          Ký Số Email (Thunderbird / Outlook)
        </button>
        <button
          onClick={() => setActiveGuideTab('git')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeGuideTab === 'git'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <GitBranch className="h-4 w-4" />
          Ký Code / Git Commit Signing
        </button>
        <button
          onClick={() => setActiveGuideTab('api')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeGuideTab === 'api'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Code2 className="h-4 w-4" />
          REST API cURL & Hệ thống Khác
        </button>
      </div>

      {/* Content Panes */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        {activeGuideTab === 'gpg' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-cyan-400" />
                  Sử Dụng Khóa CA Với GnuPG / Gpg4win Trên Máy Tính Cá Nhân
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Quản lý khóa trên thiết bị đầu cuối bằng dòng lệnh hoặc giao diện Kleopatra
                </p>
              </div>
              <button
                onClick={() => handleCopy(gpgScript, 'gpg')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium border border-slate-700 transition-colors"
              >
                {copiedSection === 'gpg' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedSection === 'gpg' ? 'Đã sao chép' : 'Sao chép lệnh'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre">
              {gpgScript}
            </pre>
          </div>
        )}

        {activeGuideTab === 'email' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-purple-400" />
                  Cấu Hình Ký Số Và Mã Hóa Email Bằng Mozilla Thunderbird
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bảo đảm thư gửi đi không bị mạo danh và đối tác nhận diện được dấu mộc doanh nghiệp
                </p>
              </div>
              <button
                onClick={() => handleCopy(emailScript, 'email')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-400 text-xs font-medium border border-slate-700 transition-colors"
              >
                {copiedSection === 'email' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedSection === 'email' ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre leading-relaxed">
              {emailScript}
            </pre>
          </div>
        )}

        {activeGuideTab === 'git' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-emerald-400" />
                  Ký Số Git Commit (Verified Commits) Bằng Khóa Doanh Nghiệp
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bảo vệ kho mã nguồn, xác thực mã lệnh do chính kỹ sư của công ty phát triển
                </p>
              </div>
              <button
                onClick={() => handleCopy(gitScript, 'git')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium border border-slate-700 transition-colors"
              >
                {copiedSection === 'git' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedSection === 'git' ? 'Đã sao chép' : 'Sao chép lệnh'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre">
              {gitScript}
            </pre>
          </div>
        )}

        {activeGuideTab === 'api' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-blue-400" />
                  Tích Hợp REST API Vào Phần Mềm Quản Trị ERP / CRM / Kế Toán
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tự động hóa luồng ký hóa đơn điện tử và xác thực tài liệu qua API
                </p>
              </div>
              <button
                onClick={() => handleCopy(apiScript, 'api')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-medium border border-slate-700 transition-colors"
              >
                {copiedSection === 'api' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedSection === 'api' ? 'Đã sao chép' : 'Sao chép API'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-blue-300 overflow-x-auto whitespace-pre">
              {apiScript}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
