import React, { useState } from 'react';
import { 
  Key, Shield, Users, FileCheck, Mail, ArrowUpRight, 
  Copy, Check, Download, AlertTriangle, ShieldCheck, RefreshCw, Lock
} from 'lucide-react';

export default function DashboardView({ 
  caInfo, 
  metrics, 
  auditLogs, 
  setActiveTab, 
  onRefresh, 
  openIssueModal, 
  openImportModal 
}) {
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyFingerprint = () => {
    if (!caInfo?.fingerprint) return;
    navigator.clipboard.writeText(caInfo.fingerprint);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

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

  const statCards = [
    {
      title: 'Chứng chỉ Đang Hiệu lực',
      value: metrics?.activeCerts ?? 0,
      sub: `Tổng ${metrics?.totalCerts ?? 0} chứng chỉ đã cấp`,
      icon: Key,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-800/60',
      onClick: () => setActiveTab('certificates')
    },
    {
      title: 'Danh bạ Khóa & B2B',
      value: metrics?.totalDirectoryKeys ?? 0,
      sub: `${metrics?.externalPartners ?? 0} Đối tác Doanh nghiệp liên kết`,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-950/40 border-blue-800/60',
      onClick: () => setActiveTab('directory')
    },
    {
      title: 'Tài liệu Đã Ký số',
      value: metrics?.signedDocsCount ?? 0,
      sub: 'Bảo toàn tính pháp lý & toàn vẹn',
      icon: FileCheck,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-800/60',
      onClick: () => setActiveTab('signing')
    },
    {
      title: 'B2B Secure Messaging',
      value: metrics?.b2bMessagesCount ?? 0,
      sub: 'Mã hóa E2E & Ký số OpenPGP',
      icon: Mail,
      color: 'text-purple-400',
      bg: 'bg-purple-950/40 border-purple-800/60',
      onClick: () => setActiveTab('b2b-messaging')
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Welcome / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Trung tâm Chứng thực CA & Chữ ký số Doanh nghiệp
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Mô hình Corporate Root CA, quản lý danh bạ Public Key nội bộ và trao đổi bảo mật B2B
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </button>
          <button
            onClick={openIssueModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors shadow-lg shadow-cyan-600/30"
          >
            <Key className="h-4 w-4" />
            Cấp Chứng chỉ Mới
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              onClick={stat.onClick}
              className={`p-5 rounded-xl border ${stat.bg} cursor-pointer hover:border-slate-600 transition-all hover:translate-y-[-2px] group`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{stat.title}</span>
                <div className={`p-2 rounded-lg bg-slate-900/60 ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{stat.value}</span>
                <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
              <p className="mt-1 text-xs text-slate-400">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Corporate Root CA Master Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Shield className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Khóa Gốc Doanh nghiệp (Corporate Root CA)</h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Tin cậy Cấp cao
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {caInfo?.name} &bull; {caInfo?.email}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Key ID / Định danh Khóa:</span>
                <span className="font-mono text-cyan-400 font-semibold text-sm">{caInfo?.keyID || 'N/A'}</span>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Thuật toán & Tiêu chuẩn:</span>
                <span className="font-mono text-emerald-400 font-semibold text-sm">
                  {caInfo?.algorithm || 'Ed25519'} (RFC 4880 / OpenPGP)
                </span>
              </div>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 text-xs">Dấu vân tay số (Fingerprint):</span>
                <button
                  onClick={handleCopyFingerprint}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey ? 'Đã sao chép' : 'Sao chép Fingerprint'}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-slate-300 break-all select-all bg-slate-900 px-2 py-1 rounded">
                {caInfo?.fingerprint || 'Đang tải...'}
              </p>
            </div>
          </div>

          {/* CA Action buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[220px]">
            <button
              onClick={handleDownloadCaKey}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors border border-slate-700 shadow-md"
            >
              <Download className="h-4 w-4 text-cyan-400" />
              Tải Public Key CA (.asc)
            </button>
            <button
              onClick={() => setActiveTab('certificates')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 font-medium text-sm transition-colors border border-cyan-500/40"
            >
              <Key className="h-4 w-4" />
              Quản lý Chứng chỉ Đã cấp
            </button>
            <button
              onClick={openImportModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-medium text-sm transition-colors border border-slate-700"
            >
              <Users className="h-4 w-4 text-blue-400" />
              Thêm Khóa Đối tác B2B
            </button>
          </div>
        </div>
      </div>

      {/* Quick Launch & Workflow Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Key className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white text-base">Cấp & Chứng thực Khóa</h3>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed mb-4">
            Cấp chữ ký số OpenPGP cho nhân viên các phòng ban hoặc phê duyệt khóa cá nhân nộp lên (CSR), ký bảo chứng bởi Root CA.
          </p>
          <button
            onClick={() => setActiveTab('certificates')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group"
          >
            Vào phân hệ Chứng chỉ <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white text-base">Ký & Xác thực Tài liệu</h3>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed mb-4">
            Ký số các hợp đồng, văn bản và hóa đơn (Clearsign hoặc Detached .asc). Xác thực chuỗi tin cậy CA và tính nguyên vẹn dữ liệu.
          </p>
          <button
            onClick={() => setActiveTab('signing')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 group"
          >
            Vào phân hệ Ký số <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white text-base">B2B Trao đổi Mật E2E</h3>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed mb-4">
            Lưu trữ Public Key của doanh nghiệp đối tác, gửi nhận văn bản, báo giá và tin nhắn được mã hóa kép và ký số chứng thực.
          </p>
          <button
            onClick={() => setActiveTab('b2b-messaging')}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 group"
          >
            Vào cổng B2B Gateway <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Recent Security & Audit Events */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-white text-base">Nhật ký Hoạt động Bảo mật Gần đây</h3>
          </div>
          <button
            onClick={() => setActiveTab('audit-logs')}
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
          >
            Xem toàn bộ nhật ký &rarr;
          </button>
        </div>

        <div className="divide-y divide-slate-800/80">
          {(!auditLogs || auditLogs.length === 0) ? (
            <p className="text-sm text-slate-500 py-3 text-center">Chưa có sự kiện nào ghi nhận.</p>
          ) : (
            auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-mono font-semibold ${
                      log.status === 'WARNING' 
                        ? 'bg-amber-950 text-amber-400 border border-amber-800' 
                        : 'bg-slate-800 text-cyan-400'
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-slate-300 font-medium">{log.actor}</span>
                  </div>
                  <p className="text-slate-400">{log.details}</p>
                </div>
                <span className="text-slate-500 whitespace-nowrap font-mono">
                  {new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
