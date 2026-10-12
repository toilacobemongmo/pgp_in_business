import React, { useState, useEffect } from 'react';
import { 
  Network, Share2, Compass, ShieldAlert, ShieldCheck, 
  ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, KeyRound, Sparkles
} from 'lucide-react';
import { CA_API } from '../api';

export default function WebOfTrustView({ caInfo }) {
  const [graphData, setGraphData] = useState(null);
  const [resilience, setResilience] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dijkstra Path Finder States
  const [sourceNode, setSourceNode] = useState('');
  const [targetNode, setTargetNode] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [calculatingPath, setCalculatingPath] = useState(false);

  const fetchGraph = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await CA_API.getWotGraph();
      if (res.success) {
        setGraphData(res.graph);
        setResilience(res.resilience);
        if (res.graph.nodes?.length >= 2) {
          setSourceNode(res.graph.nodes[0].id);
          setTargetNode(res.graph.nodes[1].id);
        }
      } else {
        setError(res.error || 'Không thể tải đồ thị Web of Trust.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối khi tải mạng lưới tin cậy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const handleCalculatePath = async () => {
    if (!sourceNode || !targetNode) {
      setError('Vui lòng chọn cả điểm bắt đầu (Nguồn) và đích đến (Đích).');
      return;
    }
    setCalculatingPath(true);
    setError('');
    try {
      const res = await CA_API.findTrustPath(sourceNode, targetNode);
      if (res.success) {
        setPathResult(res.pathResult);
      } else {
        setError(res.error || 'Tính toán đường dẫn tin cậy thất bại.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Lỗi khi chạy thuật toán Dijkstra.');
    } finally {
      setCalculatingPath(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border border-teal-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Network className="w-48 h-48 text-teal-400" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold mb-3 border border-teal-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Graph Theory & Trust Metric Algorithm (Dijkstra)</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Mạng Lưới Tin Cậy Web of Trust & Phân Tích Đường Dẫn (Trust Chain)
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Ứng dụng lý thuyết đồ thị và thuật toán Dijkstra để giải bài toán xác thực chữ ký chéo (Cross-signing). 
            Tự động tìm đường dẫn tin cậy ngắn nhất, tính điểm trọng số hội tụ (Aggregated Trust Score) 
            và phát hiện các điểm nút thắt cổ chai an ninh trong mô hình B2B phi tập trung.
          </p>
        </div>
      </div>

      {/* Control & Resilience Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Tổng số Nút Khóa (Nodes)</span>
          <p className="text-xl font-bold text-teal-300 mt-1">{graphData?.nodes?.length || 0}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Liên kết Chữ ký (Edges)</span>
          <p className="text-xl font-bold text-cyan-300 mt-1">{graphData?.edges?.length || 0}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Mật độ Đồ thị (Density)</span>
          <p className="text-xl font-bold text-white mt-1">{resilience?.networkDensity || '0.000'}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Nút Trung tâm (Hubs)</span>
          <p className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5" />
            {resilience?.criticalHubs?.length || 0} Nút Trọng yếu
          </p>
        </div>
      </div>

      {/* Path Finding (Dijkstra) Simulator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-teal-400" />
            <h2 className="text-sm font-bold text-white">
              Thuật Toán Dijkstra: Tìm Đường Dẫn Tin Cậy Giữa 2 Thực Thể (Trust Path Discovery)
            </h2>
          </div>
          <button
            onClick={fetchGraph}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Làm mới mạng lưới
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Thực Thể Nguồn (Người gửi / Điểm kiểm tra):</label>
            <select
              value={sourceNode}
              onChange={(e) => setSourceNode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:ring-1 focus:ring-teal-500"
            >
              {graphData?.nodes?.map(n => (
                <option key={n.id} value={n.id}>
                  [{n.type === 'root_ca' ? 'ROOT CA' : n.type === 'external_partner' ? 'PARTNER' : 'EMPLOYEE'}] {n.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center items-center pb-2 text-slate-500">
            <ArrowRight className="w-5 h-5" />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Thực Thể Đích (Cần thẩm tra độ tin cậy):</label>
            <select
              value={targetNode}
              onChange={(e) => setTargetNode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:ring-1 focus:ring-teal-500"
            >
              {graphData?.nodes?.map(n => (
                <option key={n.id} value={n.id}>
                  [{n.type === 'root_ca' ? 'ROOT CA' : n.type === 'external_partner' ? 'PARTNER' : 'EMPLOYEE'}] {n.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleCalculatePath}
            disabled={calculatingPath}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg font-medium text-xs shadow-lg shadow-teal-600/30 transition-all disabled:opacity-50"
          >
            {calculatingPath ? 'Đang tính toán ma trận đồ thị...' : 'Chạy Thuật Toán Tìm Chuỗi Tin Cậy (Dijkstra)'}
          </button>
        </div>

        {/* Path Result Display */}
        {pathResult && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-teal-800/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs text-slate-400">Kết quả tính toán:</span>
                <p className="text-sm font-bold text-white mt-0.5">{pathResult.explanation}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Số bước nhảy (Hops)</span>
                  <span className="text-xs font-bold text-teal-400">{pathResult.hopCount} Hops</span>
                </div>
                <div className="text-right pl-3 border-l border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Điểm tin cậy (Trust Score)</span>
                  <span className="text-sm font-bold text-emerald-400">{pathResult.aggregatedTrustScore} / 1.0</span>
                </div>
              </div>
            </div>

            {/* Path Flow Visualizer */}
            {pathResult.found && pathResult.path && (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-300 block">Chuỗi Tin Cậy (Trust Verification Chain):</span>
                <div className="flex flex-wrap items-center gap-2">
                  {pathResult.path.map((node, index) => (
                    <React.Fragment key={node.id}>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 flex items-center gap-2.5 shadow">
                        <KeyRound className={`w-4 h-4 ${node.type === 'root_ca' ? 'text-amber-400' : node.type === 'external_partner' ? 'text-indigo-400' : 'text-teal-400'}`} />
                        <div>
                          <p className="text-xs font-bold text-white leading-tight">{node.label}</p>
                          <span className="text-[10px] font-mono text-slate-400">{node.keyID || node.id.substring(0, 8)}</span>
                        </div>
                      </div>
                      {index < pathResult.path.length - 1 && (
                        <div className="flex items-center text-teal-400 px-1">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Network Nodes & Topology Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Cấu Trúc Tô-pô Mạng Lưới Tin Cậy & Các Mối Quan Hệ Chứng Thực Chữ Ký
            </h3>
          </div>
        </div>
        <div className="p-4 overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {graphData?.nodes?.map((node) => {
              const connectedEdges = graphData?.edges?.filter(e => e.source === node.id || e.target === node.id) || [];
              return (
                <div key={node.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        node.type === 'root_ca' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        node.type === 'external_partner' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                        'bg-teal-950 text-teal-300 border border-teal-800'
                      }`}>
                        {node.type}
                      </span>
                      <h4 className="text-xs font-bold text-white mt-1.5">{node.label}</h4>
                      <p className="text-[11px] text-slate-400 truncate">{node.email}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-900 text-[11px] text-slate-400 flex justify-between items-center">
                    <span>Liên kết chứng thực:</span>
                    <span className="font-semibold text-teal-400">{connectedEdges.length} Chữ ký số</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
