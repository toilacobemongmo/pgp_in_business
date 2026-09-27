import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
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
import IssueCertModal from './components/IssueCertModal';
import ImportKeyModal from './components/ImportKeyModal';
import RevokeCertModal from './components/RevokeCertModal';
import KeyDetailModal from './components/KeyDetailModal';
import { CA_API } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Multi-user Role State: 'admin' | 'employee' | 'partner' | 'public'
  const [userRole, setUserRole] = useState('admin');
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

  // Fetch all system data
  const loadAllData = async () => {
    try {
      const [statusRes, certsRes, dirRes, msgRes, logsRes] = await Promise.all([
        CA_API.getStatus(),
        CA_API.getCertificates(),
        CA_API.getDirectory(),
        CA_API.getMessages(),
        CA_API.getAuditLogs()
      ]);

      if (statusRes.success) {
        setCaInfo(statusRes.ca);
        setMetrics(statusRes.metrics);
      }
      if (certsRes.success) {
        setCertificates(certsRes.certificates);
        if (!selectedEmployeeId && certsRes.certificates.length > 0) {
          setSelectedEmployeeId(certsRes.certificates[0].id);
        }
      }
      if (dirRes.success) setDirectory(dirRes.directory);
      if (msgRes.success) setMessages(msgRes.messages);
      if (logsRes.success) setAuditLogs(logsRes.logs);
    } catch (err) {
      console.error('Lỗi tải dữ liệu hệ thống CA:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        caInfo={caInfo}
        userRole={userRole}
        setUserRole={setUserRole}
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
