import axios from 'axios';

/**
 * TOKEN STORAGE (Workstream A)
 * ----------------------------
 * Token KHÔNG được nhúng vào bundle. Người dùng dán token ở form đăng nhập,
 * token được giữ trong sessionStorage (mất khi đóng tab) và gửi qua header
 * Authorization. Server (backend/auth.js) mới là nơi quyết định role.
 */
const TOKEN_KEY = 'ca_auth_token';

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // sessionStorage bị chặn (private mode) — bỏ qua, request sẽ không kèm token.
  }
}

export function clearToken() {
  setToken('');
}

const api = axios.create({
  baseURL: '/api'
});

// Gắn token vào MỌI request ngay trước khi gửi.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const CA_API = {
  // Auth — tra role hiện tại của token do server quyết định
  whoami: () => api.get('/auth/whoami').then(r => r.data),

  getStatus: () => api.get('/ca/status').then(r => r.data),
  getCertificates: () => api.get('/certificates').then(r => r.data),
  issueCertificate: (data) => api.post('/certificates/issue', data).then(r => r.data),
  revokeCertificate: (id, reason) => api.post(`/certificates/${id}/revoke`, { reason }).then(r => r.data),
  getDirectory: () => api.get('/directory').then(r => r.data),
  importExternalKey: (data) => api.post('/directory/import', data).then(r => r.data),
  deleteDirectoryKey: (id) => api.delete(`/directory/${id}`).then(r => r.data),
  getDocuments: () => api.get('/documents').then(r => r.data),
  signDocument: (formData) => api.post('/documents/sign', formData).then(r => r.data),
  verifyDocument: (formData) => api.post('/documents/verify', formData).then(r => r.data),
  getMessages: () => api.get('/messages').then(r => r.data),
  sendB2BMessage: (data) => api.post('/messages/send', data).then(r => r.data),
  decryptB2BMessage: (data) => api.post('/messages/decrypt', data).then(r => r.data),
  getAuditLogs: () => api.get('/audit-logs').then(r => r.data),
  inspectPackets: (armoredData) => api.post('/inspector/analyze', { armoredData }).then(r => r.data),
  getWotGraph: () => api.get('/wot/graph').then(r => r.data),
  findTrustPath: (sourceFingerprint, targetFingerprint) => api.post('/wot/path', { sourceFingerprint, targetFingerprint }).then(r => r.data),
  splitSecretShamir: (data) => api.post('/shamir/split', data).then(r => r.data),
  recoverSecretShamir: (shares) => api.post('/shamir/recover', { shares }).then(r => r.data),
  // Kỹ sư 2 — Quorum lifecycle của Root CA (SEALED / UNSEALED)
  unsealCA: (shares) => api.post('/ca/unseal', { shares }).then(r => r.data),
  sealCA: () => api.post('/ca/seal', {}).then(r => r.data),
  getMerkleStatus: () => api.get('/merkle/status').then(r => r.data),
  getMerkleProof: (logId) => api.get(`/merkle/proof/${logId}`).then(r => r.data),
  verifyMerkleProof: (data) => api.post('/merkle/verify', data).then(r => r.data),
};

export default api;
