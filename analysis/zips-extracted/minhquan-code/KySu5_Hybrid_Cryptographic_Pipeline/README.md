# Phân Hệ Kỹ Sư 5: Hybrid Cryptographic Pipeline & Detached Stream Hashes

## 1. Tổng quan Kiến trúc
Phân hệ Kỹ sư 5 chịu trách nhiệm toàn bộ tầng xử lý mật mã lai (Hybrid Cryptography) và luồng dữ liệu dung lượng lớn trong dự án **Enterprise OpenPGP Certificate Authority & B2B Secure Exchange**, tuân thủ nghiêm ngặt **IETF RFC 4880**, **RFC 9580 (Crypto-Refresh)** và **RFC 6637**.

### Các tệp mã nguồn sở hữu:
- `backend/pgp-service.js`: Lõi xử lý mật mã lai Sign-then-Encrypt, phòng chống Surreptitious Forwarding (Subpacket 35), chặn lỗ hổng EFail (CVE-2017-17688), ký tách rời dạng Streaming với Backpressure (RAM < 50MB), và chuẩn hóa Clearsign RFC 4880.
- `backend/server.js`: Cổng API RESTful & **Stateless Public Verifier** thực thi chính sách **Zero-Disk** (xử lý thuần túy trên RAM).
- `tests/test-engineer5.js`: Bộ kiểm thử chức năng và kịch bản diễn tập Red Team.
- `tests/benchmark-stream.js`: Công cụ đo đạc hiệu năng và mức chiếm dụng RAM RSS trên các tệp 500MB - 2GB.

## 2. Hướng dẫn Cài đặt & Chạy Kiểm thử
```bash
npm install
npm test
# Chạy stress-test với tệp 500MB (hoặc truyền tham số 1024, 2048 cho 1GB/2GB)
node tests/benchmark-stream.js 500
```
