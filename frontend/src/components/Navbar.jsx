import React from 'react';
import { 
  ShieldCheck, Key, FileCheck, Users, Mail, Activity, 
  Download, BookOpen, UserCheck, Globe, Search
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  caInfo, 
  userRole, 
  setUserRole 
}) {
  const adminNavItems = [
    { id: 'dashboard', label: 'Bảng điều khiển', icon: Activity },
    { id: 'certificates', label: 'Chứng chỉ CA', icon: Key },
    { id: 'directory', label: 'Danh bạ Khóa & B2B', icon: Users },
    { id: 'signing', label: 'Ký & Xác thực số', icon: FileCheck },
    { id: 'b2b-messaging', label: 'Tin nhắn Mật B2B', icon: Mail },
    { id: 'audit-logs', label: 'Nhật ký Kiểm toán', icon: ShieldCheck },
    { id: 'guide', label: 'Hướng dẫn Tích hợp', icon: BookOpen },
  ];

  const handleDownloadCaKey = () => {
    if (!caInfo?.publicKeyArmored) return;
    const blob = new Blob([caInfo.publicKeyArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corporate-root-ca-${caInfo.keyID || 'master'}.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & System Brand */}
          <div 
            className="flex items-center gap-3 cursor-pointer shrink-0" 
            onClick={() => {
              setUserRole('admin');
              setActiveTab('dashboard');
            }}
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white">ENTERPRISE PGP</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Trust Center
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Hệ thống Chứng thực Chữ ký số & Trao đổi Doanh nghiệp</p>
            </div>
          </div>

          {/* Right Action: ROLE SWITCHER (Chuyển đổi góc nhìn vai trò người dùng) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 pl-2 hidden md:inline">
                Góc nhìn:
              </span>
              <select
                value={userRole}
                onChange={(e) => {
                  const role = e.target.value;
                  setUserRole(role);
                  if (role === 'admin') setActiveTab('dashboard');
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border focus:outline-none transition-all cursor-pointer ${
                  userRole === 'admin'
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                    : userRole === 'employee'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : userRole === 'partner'
                    ? 'bg-purple-950/80 text-purple-300 border-purple-700'
                    : 'bg-teal-950/80 text-teal-300 border-teal-700'
                }`}
              >
                <option value="admin">👑 1. CA Administrator (Quản trị)</option>
                <option value="employee">👩‍💻 2. Cán bộ Doanh nghiệp (Nội bộ)</option>
                <option value="partner">🏢 3. Đối tác B2B (Doanh nghiệp Ngoài)</option>
                <option value="public">🔍 4. Người Thẩm tra (Công khai)</option>
              </select>
            </div>

            {/* Root CA Status pill (chỉ hiện khi màn hình đủ rộng) */}
            {caInfo && userRole === 'admin' && (
              <div className="hidden xl:flex items-center gap-2 bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Root CA: {caInfo.keyID}</span>
                <button
                  onClick={handleDownloadCaKey}
                  title="Tải Public Key Root CA"
                  className="hover:text-cyan-300 text-slate-400 p-0.5"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs (Hiển thị khi ở chế độ Quản trị CA Admin) */}
        {userRole === 'admin' && (
          <div className="flex space-x-1 overflow-x-auto py-1 scrollbar-none border-t border-slate-800/60">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
