import React, { useState } from 'react';
import { Binary, Layers, Search, AlertCircle, CheckCircle2, ChevronRight, FileCode, Shield, Cpu } from 'lucide-react';
import { CA_API } from '../api';

export default function PacketInspectorView({ caInfo }) {
  const [armoredInput, setArmoredInput] = useState(caInfo?.publicKeyArmored || '');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!armoredInput.trim()) {
      setError('Vui lòng nhập hoặc dán nội dung PGP Armor ASCII.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await CA_API.inspectPackets(armoredInput.trim());
      if (res.success) {
        setAnalysisResult(res.report);
        if (res.report.packets?.length > 0) {
          setSelectedPacket(res.report.packets[0]);
        }
      } else {
        setError(res.error || 'Phân tích thất bại.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = (sampleType) => {
    if (sampleType === 'root_ca' && caInfo?.publicKeyArmored) {
      setArmoredInput(caInfo.publicKeyArmored);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Binary className="w-48 h-48 text-indigo-400" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-400/30">
            <Cpu className="w-3.5 h-3.5" />
            <span>Low-Level RFC 4880 & RFC 9580 Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Bộ Bóc Tách & Phân Tích Gói Tin Nhị Phân OpenPGP
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Module giải mã cấu trúc byte-by-byte độc lập tự phát triển. Không chạy qua thư viện vỏ bọc high-level, 
            trực tiếp phân rã OpenPGP Packet Header, Subpacket Types, Algorithm OIDs, Tag 2 Chữ ký số và Tag 6 Khóa công khai.
          </p>
        </div>
      </div>

      {/* Input Form & Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
          <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            Nội dung OpenPGP Armored Text (Khóa, Chữ ký hoặc Bản mã)
          </label>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => handleLoadSample('root_ca')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              Nạp Khóa Root CA hiện tại
            </button>
            <button
              onClick={() => setArmoredInput('')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-colors"
            >
              Xóa trống
            </button>
          </div>
        </div>

        <textarea
          rows={6}
          value={armoredInput}
          onChange={(e) => setArmoredInput(e.target.value)}
          placeholder="-----BEGIN PGP PUBLIC KEY BLOCK----- ..."
          className="w-full bg-slate-950 border border-slate-700/80 rounded-lg p-3 text-xs font-mono text-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />

        {error && (
          <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-center gap-2 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-lg font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>Đang phân tích byte-level...</>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Bóc Tách & Khám Phá Gói Tin (Parse RFC 4880)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Results View */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Armor Type</span>
              <p className="text-base font-bold text-indigo-300 mt-1 truncate">{analysisResult.armorType}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Dung lượng Binary</span>
              <p className="text-base font-bold text-white mt-1">{analysisResult.totalBytes} Bytes</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Số lượng Packets</span>
              <p className="text-base font-bold text-emerald-400 mt-1">{analysisResult.packetsCount} Gói RFC 4880</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Độ toàn vẹn</span>
              <p className="text-base font-bold text-blue-400 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Chuẩn định dạng
              </p>
            </div>
          </div>

          {/* Master-Detail Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Packet Tree / List (5 Cols) */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[520px]">
              <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Danh Sách Gói Tin Nhị Phân (Packet Stream)
                </span>
                <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">
                  {analysisResult.packets.length} Packets
                </span>
              </div>
              <div className="divide-y divide-slate-800 overflow-y-auto flex-1">
                {analysisResult.packets.map((pkt) => {
                  const isSelected = selectedPacket?.index === pkt.index;
                  return (
                    <div
                      key={pkt.index}
                      onClick={() => setSelectedPacket(pkt)}
                      className={`p-3.5 cursor-pointer transition-all flex items-start justify-between ${
                        isSelected
                          ? 'bg-indigo-950/60 border-l-4 border-indigo-500'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-indigo-400 border border-slate-700">
                            Tag {pkt.tag}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {pkt.tagName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-3">
                          <span>Kích thước: <strong className="text-slate-300">{pkt.length}B</strong></span>
                          <span>Định dạng: <span className="text-slate-400">{pkt.format}</span></span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 mt-1 transition-transform ${isSelected ? 'text-indigo-400 translate-x-1' : 'text-slate-600'}`} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Packet Detail & Raw Byte Inspection (7 Cols) */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[520px]">
              <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  Chi Tiết Cấu Trúc Nội Tại & Subpackets (Tag {selectedPacket?.tag})
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Offset: {selectedPacket?.startOffset} (0x{selectedPacket?.startOffset.toString(16).toUpperCase()})
                </span>
              </div>

              <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
                {selectedPacket ? (
                  <>
                    {/* Raw Hex Header */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">Dữ liệu Hex thô (Hex Dump Sample):</span>
                      <code className="text-indigo-300 font-mono text-[11px] break-all">
                        {selectedPacket.hexPreview}
                      </code>
                    </div>

                    {/* Detailed Tag Semantics */}
                    {selectedPacket.tag === 2 && (
                      <div className="space-y-3">
                        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                            <span className="text-slate-400">Loại Chữ Ký (Signature Type):</span>
                            <span className="font-semibold text-white">{selectedPacket.details?.signatureType?.description}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                            <span className="text-slate-400">Thuật toán Khóa công khai:</span>
                            <span className="font-semibold text-cyan-300">{selectedPacket.details?.publicKeyAlgorithm?.name}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                            <span className="text-slate-400">Thuật toán Hàm Băm (Hash):</span>
                            <span className="font-semibold text-emerald-300">{selectedPacket.details?.hashAlgorithm?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Hai byte kiểm tra nhanh (Hash 2-bytes prefix):</span>
                            <span className="font-mono text-yellow-300 font-bold">{selectedPacket.details?.hashPrefixTwoBytes}</span>
                          </div>
                        </div>

                        {/* Subpackets Table */}
                        {selectedPacket.details?.hashedSubpackets?.length > 0 && (
                          <div className="border border-slate-800 rounded-lg overflow-hidden">
                            <div className="bg-slate-800/50 px-3 py-1.5 font-semibold text-[11px] text-slate-300">
                              Hashed Subpackets (Được bảo vệ bởi chữ ký)
                            </div>
                            <div className="divide-y divide-slate-800/60">
                              {selectedPacket.details.hashedSubpackets.map((sub, idx) => (
                                <div key={idx} className="p-2.5 flex items-start justify-between bg-slate-950/40">
                                  <div>
                                    <span className="font-semibold text-indigo-300">{sub.typeName}</span>
                                    {sub.isCritical && (
                                      <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-800">Critical</span>
                                    )}
                                  </div>
                                  <span className="font-mono text-slate-200 text-[11px] max-w-[220px] truncate" title={String(sub.value)}>
                                    {String(sub.value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {(selectedPacket.tag === 6 || selectedPacket.tag === 14) && (
                      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                          <span className="text-slate-400">Phiên bản Khóa (Key Version):</span>
                          <span className="font-semibold text-white">Version {selectedPacket.details?.version} (RFC 4880)</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                          <span className="text-slate-400">Thời gian tạo Khóa:</span>
                          <span className="font-semibold text-slate-200">{selectedPacket.details?.createdAt}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                          <span className="text-slate-400">Thuật toán Khóa:</span>
                          <span className="font-semibold text-cyan-300">{selectedPacket.details?.algorithm?.name}</span>
                        </div>
                        {selectedPacket.details?.curveOid && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Đường cong Elliptic (Curve):</span>
                            <span className="font-semibold text-emerald-400">{selectedPacket.details?.curveOid}</span>
                          </div>
                        )}
                        {selectedPacket.details?.keySize && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Độ dài khóa RSA:</span>
                            <span className="font-semibold text-indigo-400">{selectedPacket.details?.keySize}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedPacket.tag === 13 && (
                      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                        <span className="text-slate-400 block mb-1">User ID Đăng ký (Identity):</span>
                        <p className="font-semibold text-base text-emerald-300 font-mono">
                          {selectedPacket.details?.userId}
                        </p>
                      </div>
                    )}

                    {/* Generic JSON dump for other packets */}
                    {![2, 6, 14, 13].includes(selectedPacket.tag) && (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto">
                          {JSON.stringify(selectedPacket.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500 italic">Chọn một gói tin bên trái để xem cấu trúc byte.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
