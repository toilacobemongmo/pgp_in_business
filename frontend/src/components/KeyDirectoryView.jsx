import React, { useState } from 'react';
import { 
  Users, Building2, Search, Filter, Plus, ShieldCheck, 
  Download, Copy, Check, ExternalLink, Trash2, Key, Globe
} from 'lucide-react';

export default function KeyDirectoryView({ 
  directory, 
  onRefresh, 
  openImportModal, 
  onDeleteKey, 
  onSelectKey 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

  const filteredKeys = (directory || []).filter(item => {
    const matchesSearch = 
      item.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.keyID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.fingerprint?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = 
      typeFilter === 'all' ? true : 
      typeFilter === 'partner' ? item.keyType === 'external_partner' :
      typeFilter === 'internal' ? item.keyType !== 'external_partner' : true;

    return matchesSearch && matchesType;
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (item) => {
    const blob = new Blob([item.publicKeyArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.organizationName.replace(/\s+/g, '_')}_${item.keyID}.asc`;
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
            Danh bạ Public Key Doanh nghiệp & Đối tác B2B
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Kho lưu trữ Public Key tập trung của tổ chức và mạng lưới đối tác phục vụ mã hóa & xác thực
          </p>
        </div>
        <button
          onClick={openImportModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-600/30"
        >
          <Plus className="h-4 w-4" />
          Thêm Khóa Đối tác Mới
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tổ chức, đối tác, người liên hệ, email, KeyID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 px-3 py-2.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Tất cả đơn vị</option>
            <option value="internal">Nội bộ Doanh nghiệp</option>
            <option value="partner">Đối tác B2B Liên kết</option>
          </select>
        </div>
      </div>

      {/* Directory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredKeys.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            Không tìm thấy khóa công khai nào khớp với tìm kiếm.
          </div>
        ) : (
          filteredKeys.map((item) => {
            const isRoot = item.isCA;
            const isPartner = item.keyType === 'external_partner';
            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition-all hover:border-slate-600 ${
                  isRoot
                    ? 'border-cyan-500/40 bg-gradient-to-b from-slate-900 to-cyan-950/20'
                    : isPartner
                    ? 'border-purple-500/30'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${
                        isRoot
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                          : isPartner
                          ? 'bg-purple-950 text-purple-300 border-purple-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {isRoot ? 'Corporate Root CA' : isPartner ? 'Đối tác B2B' : 'Nội bộ Doanh nghiệp'}
                    </span>

                    <span className="text-xs font-mono font-bold text-slate-400">
                      ID: {item.keyID}
                    </span>
                  </div>

                  {/* Organization & Contact */}
                  <div className="mb-3">
                    <h3 className="font-bold text-white text-base leading-snug flex items-center gap-1.5">
                      {isPartner ? <Globe className="h-4 w-4 text-purple-400 shrink-0" /> : <Building2 className="h-4 w-4 text-cyan-400 shrink-0" />}
                      <span className="truncate">{item.organizationName}</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 font-medium">
                      {item.contactName} {item.department ? `&bull; ${item.department}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">{item.contactEmail}</p>
                  </div>

                  {/* Fingerprint block */}
                  <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 mb-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Fingerprint:</span>
                      <button
                        onClick={() => handleCopy(item.fingerprint, item.id)}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        {copiedId === item.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedId === item.id ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                    <p className="font-mono text-[11px] text-slate-300 break-all select-all">
                      {item.fingerprint}
                    </p>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-400 line-clamp-2 italic mb-4">
                      "{item.notes}"
                    </p>
                  )}
                </div>

                {/* Bottom Action buttons */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700"
                    >
                      <Download className="h-3.5 w-3.5 text-cyan-400" />
                      Tải .asc
                    </button>
                    <button
                      onClick={() => onSelectKey(item)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
                    >
                      Xem Khóa
                    </button>
                  </div>

                  {!isRoot && (
                    <button
                      onClick={() => onDeleteKey(item.id)}
                      title="Xóa khóa này khỏi danh bạ"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
