import React, { useState } from 'react';
import { X, ShieldCheck, Download, Copy, Check, Key } from 'lucide-react';

export default function KeyDetailModal({ isOpen, onClose, item }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !item) return null;

  const keyArmored = item.certifiedPublicKeyArmored || item.publicKeyArmored;

  const handleCopy = () => {
    if (!keyArmored) return;
    navigator.clipboard.writeText(keyArmored);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!keyArmored) return;
    const blob = new Blob([keyArmored], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(item.name || item.organizationName || 'key').replace(/\s+/g, '_')}_${item.keyID}.asc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Chi Tiết Khóa OpenPGP</h2>
            <p className="text-xs text-slate-400">
              {item.name || item.organizationName} &bull; {item.email || item.contactEmail}
            </p>
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs mb-4">
          <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-slate-400">Key ID:</span>
            <span className="font-mono text-cyan-400 font-bold">{item.keyID}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-slate-400">Thuật toán:</span>
            <span className="font-mono text-emerald-400 font-medium">{item.algorithm || 'Ed25519 (ECC)'}</span>
          </div>
          <div className="border-b border-slate-800/80 pb-1.5">
            <span className="text-slate-400 block mb-0.5">Dấu vân tay (Fingerprint):</span>
            <span className="font-mono text-[11px] text-slate-300 break-all select-all">{item.fingerprint}</span>
          </div>
          {item.caIssuer && (
            <div className="flex items-center gap-2 pt-1 text-cyan-300 font-medium">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              <span>Chứng thực bởi Corporate Root CA ({item.caIssuer})</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Toàn văn Khóa Công khai (Armored Public Key Block):</span>
            <button
              onClick={handleCopy}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép Block'}</span>
            </button>
          </div>
          <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-mono text-cyan-300 overflow-x-auto max-h-60 select-all scrollbar-none">
            {keyArmored}
          </pre>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            <Download className="h-4 w-4" />
            Tải Tệp Khóa (.asc)
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
