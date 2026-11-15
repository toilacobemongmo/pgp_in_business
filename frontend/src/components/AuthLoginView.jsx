import React, { useState } from 'react';
import { Shield, KeyRound, LogIn, AlertTriangle } from 'lucide-react';
import { CA_API, setToken, getToken, clearToken } from '../api';

/**
 * WORKSTREAM A — Đăng nhập bằng token do server cấp.
 *
 * Không có secret nào nằm trong bundle: người dùng dán token (do quản trị viên
 * gán qua biến môi trường AUTH_TOKEN_*), frontend gửi lên /api/auth/whoami và
 * CHỈ hiển thị role mà server trả về. Nếu server chưa cấu hình token nào thì
 * form này báo rõ thay vì để người dùng đoán.
 */
export default function AuthLoginView({ onAuthenticated, onContinueAsPublic }) {
  const [token, setTokenValue] = useState(getToken());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = token.trim();
    if (!trimmed) {
      setError('Vui lòng nhập token được cấp bởi quản trị viên hệ thống.');
      return;
    }

    setBusy(true);
    setToken(trimmed);
    try {
      const who = await CA_API.whoami();
      if (!who?.authenticated) {
        clearToken();
        setError('Token không hợp lệ hoặc chưa được cấu hình trên server (401).');
        return;
      }
      onAuthenticated(who);
    } catch (err) {
      clearToken();
      setError(err?.response?.data?.error || 'Không kết nối được máy chủ xác thực.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 mb-4">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Enterprise OpenPGP CA</h1>
          <p className="text-sm text-slate-400 mt-2">
            Xác thực do máy chủ kiểm soát — role không còn là state ở trình duyệt.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label htmlFor="auth-token" className="block text-xs font-semibold text-slate-300 mb-2">
              Access Token (AUTH_TOKEN_ADMIN / _EMPLOYEE / _PARTNER)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                id="auth-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setTokenValue(e.target.value)}
                placeholder="Dán token được cấp..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Token chỉ được giữ trong sessionStorage của tab này, không nằm trong bundle build.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 rounded-lg text-sm font-semibold transition"
          >
            <LogIn className="w-4 h-4" />
            {busy ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>

          <button
            type="button"
            onClick={onContinueAsPublic}
            className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Tiếp tục với tư cách khách (chỉ xác thực chữ ký công khai)
          </button>
        </form>
      </div>
    </div>
  );
}
