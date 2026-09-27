import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

export const CA_API = {
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
};

export default api;
