import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import AuthLoginView from './components/AuthLoginView';
import DashboardView from './components/DashboardView';
import CertificatesView from './components/CertificatesView';
import KeyDirectoryView from './components/KeyDirectoryView';
import DocumentSigningView from './components/DocumentSigningView';
import B2BMessagingView from './components/B2BMessagingView';
import AuditLogsView from './components/AuditLogsView';
import EmployeePortalView from './components/EmployeePortalView';
import PartnerPortalView from './components/PartnerPortalView';
import PublicVerifierView from './components/PublicVerifierView';
import IntegrationGuideView from './components/IntegrationGuideView';
import PacketInspectorView from './components/PacketInspectorView';
import WebOfTrustView from './components/WebOfTrustView';
import ShamirKeyShardingView from './components/ShamirKeyShardingView';
import MerkleAuditView from './components/MerkleAuditView';
import IssueCertModal from './components/IssueCertModal';
import ImportKeyModal from './components/ImportKeyModal';
import RevokeCertModal from './components/RevokeCertModal';
import KeyDetailModal from './components/KeyDetailModal';
import { CA_API, clearToken } from './api';

// Các góc nhìn UI được ánh xạ từ quyền do MÁY CHỦ cấp.
// 'public' không cần token; 3 role còn lại chỉ dùng được khi token khớp.
const ROLE_TO_VIEWS = {
  admin: ['admin', 'employee', 'partner', 'public'],
  employee: ['employee', 'public'],
  partner: ['partner', 'public'],
  public: ['public'],
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Quyền thực tế lấy từ server (/api/auth/whoami), KHÔNG phải state client.
  // auth: null = chưa kiểm tra xong, { role, authenticated } sau khi kiểm tra.
  const [auth, setAuth] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Góc nhìn UI đang chọn (chỉ được nằm trong ROLE_TO_VIEWS[auth.role]).
  const [userRole, setUserRole] = useState('public');
  // Người dùng chủ động chọn "tiếp tục với tư cách khách" (không có token).
  const [publicMode, setPublicMode] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // System states
  const [caInfo, setCaInfo] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Modals state
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [revokeCertTarget, setRevokeCertTarget] = useState(null);
  const [detailKeyTarget, setDetailKeyTarget] = useState(null);

  // Fetch all system data.
  // Lưu ý: với khách (public) các endpoint cần quyền sẽ trả 401/403.
  // Dùng allSettled để một lời gọi bị từ chối không làm hỏng cả trang.
  const loadAllData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        CA_API.getStatus(),
        CA_API.getCertificates(),
        CA_API.getDirectory(),
        CA_API.getMessages(),
        CA_API.getAuditLogs()
      ]);
      const value = (i) => (results[i].status === 'fulfilled' ? results[i].value : null);

      const statusRes = value(0);
      const certsRes = value(1);
      const dirRes = value(2);
      const msgRes = value(3);
      const logsRes = value(4);

      if (statusRes?.success) {
        setCaInfo(statusRes.ca);
        setMetrics(statusRes.metrics);
      }
      if (certsRes?.success) {
        setCertificates(certsRes.certificates);
        if (!selectedEmployeeId && certsRes.certificates.length > 0) {
          setSelectedEmployeeId(certsRes.certificates[0].id);
        }
      }
      // Danh bạ công khai → luôn tải được.
      if (dirRes?.success) setDirectory(dirRes.directory);
      if (msgRes?.success) setMessages(msgRes.messages);
      if (logsRes?.success) setAuditLogs(logsRes.logs);
    } catch (err) {
      console.error('Lỗi tải dữ liệu hệ thống CA:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId]);

  // Hỏi server xem token hiện tại (nếu có) tương ứng role nào.
  const checkAuth = useCallback(async () => {
    try {
      const who = await CA_API.whoami();
      const role = who?.authenticated ? who.role : 'public';
      setAuth({ role, authenticated: !!who?.authenticated });
      setUserRole(role);
      return role;
    } catch {
      setAuth({ role: 'public', authenticated: false });
      setUserRole('public');
      return 'public';
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await checkAuth();
      await loadAllData();
    })();
  }, [checkAuth, loadAllData]);

  const allowedViews = ROLE_TO_VIEWS[auth?.role] || ['public'];

  // Chuyển góc nhìn: chỉ chấp nhận nếu server đã cấp quyền tương ứng.
  const changeView = (nextView) => {
    if (!allowedViews.includes(nextView)) return;
    setUserRole(nextView);
    if (nextView === 'admin') setActiveTab('dashboard');
  };

  const handleAuthenticated = async () => {
    setLoading(true);
    await checkAuth();
    await loadAllData();
  };

  // Chưa kiểm tra xong quyền → không render nội dung nào để tránh nháy UI.
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono text-sm">
        Đang kiểm tra quyền truy cập với máy chủ...
      </div>
    );
  }

  // Khách chưa đăng nhập (và chưa chọn "tiếp tục với tư cách khách") → hiện form.
  if (!auth?.authenticated && !publicMode) {
    return (
      <AuthLoginView
        onAuthenticated={handleAuthenticated}
        onContinueAsPublic={() => setPublicMode(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        caInfo={caInfo}
        userRole={userRole}
        setUserRole={changeView}
        allowedViews={allowedViews}
        serverRole={auth?.role}
        onLogout={() => {
          clearToken();
          setPublicMode(false);
          setAuth({ role: 'public', authenticated: false });
          setUserRole('public');
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            <p className="text-sm text-slate-400 font-mono">Đang kết nối trung tâm bảo mật CA & OpenPGP Core...</p>
          </div>
        ) : (
          <>
            {/* 1. EMPLOYEE PORTAL VIEW (CỔNG NHÂN VIÊN) */}
            {userRole === 'employee' && (
              <EmployeePortalView
                certificates={certificates}
                directory={directory}
                selectedEmployeeId={selectedEmployeeId}
                setSelectedEmployeeId={setSelectedEmployeeId}
                onRefresh={loadAllData}
              />
            )}

            {/* 2. B2B PARTNER PORTAL VIEW (CỔNG ĐỐI TÁC NGOÀI) */}
            {userRole === 'partner' && (
              <PartnerPortalView
                caInfo={caInfo}
                directory={directory}
                messages={messages}
                onRefresh={loadAllData}
              />
            )}

            {/* 3. PUBLIC VERIFIER VIEW (CỔNG THẨM ĐỊNH CÔNG KHAI) */}
            {userRole === 'public' && (
              <PublicVerifierView
                directory={directory}
              />
            )}

            {/* 4. CA ADMINISTRATOR VIEWS */}
            {userRole === 'admin' && (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardView
                    caInfo={caInfo}
                    metrics={metrics}
                    auditLogs={auditLogs}
                    setActiveTab={setActiveTab}
                    onRefresh={loadAllData}
                    openIssueModal={() => setIsIssueModalOpen(true)}
                    openImportModal={() => setIsImportModalOpen(true)}
                  />
                )}

                {activeTab === 'wot' && (
                  <WebOfTrustView caInfo={caInfo} />
                )}

                {activeTab === 'inspector' && (
                  <PacketInspectorView caInfo={caInfo} />
                )}

                {activeTab === 'shamir' && (
                  <ShamirKeyShardingView caInfo={caInfo} />
                )}

                {activeTab === 'merkle' && (
                  <MerkleAuditView />
                )}

                {activeTab === 'certificates' && (
                  <CertificatesView
                    certificates={certificates}
                    onRefresh={loadAllData}
                    openIssueModal={() => setIsIssueModalOpen(true)}
                    openRevokeModal={(cert) => setRevokeCertTarget(cert)}
                    onSelectCert={(cert) => setDetailKeyTarget(cert)}
                  />
                )}

                {activeTab === 'directory' && (
                  <KeyDirectoryView
                    directory={directory}
                    onRefresh={loadAllData}
                    openImportModal={() => setIsImportModalOpen(true)}
                    onDeleteKey={async (id) => {
                      if (window.confirm('Bạn có chắc muốn xóa khóa này khỏi danh bạ không?')) {
                        await CA_API.deleteDirectoryKey(id);
                        loadAllData();
                      }
                    }}
                    onSelectKey={(item) => setDetailKeyTarget(item)}
                  />
                )}

                {activeTab === 'signing' && (
                  <DocumentSigningView
                    certificates={certificates}
                    directory={directory}
                    caInfo={caInfo}
                    onSignSuccess={loadAllData}
                  />
                )}

                {activeTab === 'b2b-messaging' && (
                  <B2BMessagingView
                    messages={messages}
                    directory={directory}
                    caInfo={caInfo}
                    onRefresh={loadAllData}
                  />
                )}

                {activeTab === 'audit-logs' && (
                  <AuditLogsView
                    auditLogs={auditLogs}
                    onRefresh={loadAllData}
                  />
                )}

                {activeTab === 'guide' && (
                  <IntegrationGuideView
                    caInfo={caInfo}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Enterprise PGP Trust Center &copy; 2026 - Hạ tầng Chữ ký số & An toàn Thông tin Doanh nghiệp</span>
          <span className="font-mono text-[11px] text-slate-600">RFC 4880 OpenPGP Compliant &bull; End-to-End Encryption</span>
        </div>
      </footer>

      {/* Modals */}
      <IssueCertModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        onSuccess={loadAllData}
      />

      <ImportKeyModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={loadAllData}
      />

      <RevokeCertModal
        isOpen={!!revokeCertTarget}
        cert={revokeCertTarget}
        onClose={() => setRevokeCertTarget(null)}
        onSuccess={loadAllData}
      />

      <KeyDetailModal
        isOpen={!!detailKeyTarget}
        item={detailKeyTarget}
        onClose={() => setDetailKeyTarget(null)}
      />
    </div>
  );
}
