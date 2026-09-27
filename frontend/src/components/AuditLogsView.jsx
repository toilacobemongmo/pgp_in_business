import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, RefreshCw, AlertTriangle, CheckCircle2, Download } from 'lucide-react';

export default function AuditLogsView({ auditLogs, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredLogs = (auditLogs || []).filter(log => {
    const matchesSearch = 
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' ? true : log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ca_audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Nhật ký Kiểm toán An ninh CA (Audit Trail)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Ghi vết bất biến toàn bộ các hành động cấp khóa, thu hồi chứng chỉ, ký số và trao đổi B2B
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700"
          >
            <RefreshCw className="h-4 w-4" /> Làm mới
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700"
          >
            <Download className="h-4 w-4 text-cyan-400" /> Xuất Log (.json)
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo hành động, người thực hiện, từ khóa chi tiết..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 px-3 py-2.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="SUCCESS">Thành công (SUCCESS)</option>
            <option value="WARNING">Cảnh báo (WARNING)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800 tracking-wider">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Hành vi (Action)</th>
                <th className="py-3 px-4">Đối tượng thực hiện (Actor)</th>
                <th className="py-3 px-4">Chi tiết hoạt động</th>
                <th className="py-3 px-4 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    Không có bản ghi nhật ký nào.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isWarn = log.status === 'WARNING';
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors text-xs">
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded font-mono font-semibold text-[11px] ${
                          isWarn
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-cyan-400 border border-slate-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {log.actor}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 max-w-md">
                        {log.details}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isWarn ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" /> WARNING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> SUCCESS
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
