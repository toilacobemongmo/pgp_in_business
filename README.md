# 🛡️ Enterprise OpenPGP Certificate Authority (CA) & B2B Secure Exchange

Hệ thống **Trung tâm Chứng thực Chữ ký số OpenPGP & Cổng Giao dịch Doanh nghiệp (Corporate CA & B2B Portal)** được thiết kế chuyên biệt cho môi trường doanh nghiệp. Hệ thống giải quyết trọn vẹn bài toán xây dựng hạ tầng khóa công khai (PKI) dựa trên tiêu chuẩn OpenPGP (RFC 4880), chứng thực danh tính cán bộ, ký số văn bản/tài liệu và trao đổi thông tin mật liên tổ chức.

---

## 🏛️ Kiến trúc & Mô hình Nghiệp vụ

```
                          ┌─────────────────────────────────────┐
                          │   🏢 CORPORATE ROOT CA MASTER KEY   │
                          │   (Khóa Gốc Tin Cậy Của Doanh Nghiệp)│
                          └──────────────────┬──────────────────┘
                                             │ Ký chứng thực (Certify Key)
                    ┌────────────────────────┴────────────────────────┐
                    ▼                                                 ▼
     ┌─────────────────────────────┐                   ┌─────────────────────────────┐
     │ 👤 Cán bộ / Phòng ban nội bộ │                   │ 🏢 Đối tác B2B (External)    │
     │ - Kế toán trưởng (Duyệt chi)│                   │ - Tập đoàn Tài chính FINCORP│
     │ - Trưởng ban Pháp chế (HĐ)  │                   │ - Tập đoàn Logistics LOGIX  │
     └──────────────┬──────────────┘                   └──────────────┬──────────────┘
                    │                                                 │
                    │   Trao đổi B2B Secure Messaging                 │
                    │   (Mã hóa E2E + Ký số OpenPGP)                  │
                    └─────────────────────────────────────────────────┘
```

### 1. Corporate Root CA (Khóa gốc Doanh nghiệp)
- Hệ thống tự sinh và lưu trữ khóa gốc **Enterprise Corporate Root CA** với thuật toán hiện đại **ECC Ed25519 (Curve25519)** chuẩn RFC 4880.
- Root CA đóng vai trò "Root of Trust" (Nguồn gốc tin cậy tối cao), ký chứng thực (Corporate Certification Signature) lên các Public Key của cán bộ, nhân viên và phòng ban.

### 2. Cấp phát & Chứng thực Khóa (Key Issuance & Certification)
Hỗ trợ đầy đủ **2 phương thức chuẩn doanh nghiệp**:
1. **CA Tự động sinh khóa (Key Generation)**: CA tự sinh cặp khóa OpenPGP an toàn, ký chứng thực và cung cấp Private Key cho nhân viên tải về lưu trữ an toàn.
2. **Người dùng tự nộp Public Key (CSR - Certificate Signing Request)**: Cán bộ tự sinh khóa trên máy tính cá nhân bằng GnuPG / Kleopatra và chỉ gửi Public Key lên để CA ký chứng thực. Đảm bảo Private Key **không bao giờ** rời khỏi thiết bị người dùng.

### 3. Danh bạ Public Key Tập trung & Mạng lưới B2B (Key Directory)
- Quản lý tập trung Public Key của toàn bộ nhân viên nội bộ và các đối tác bên ngoài.
- Dễ dàng tra cứu theo Tên, Email, Phòng ban, Tổ chức hoặc Key ID / Dấu vân tay số (Fingerprint).
- Hỗ trợ nhập (Import) Public Key của doanh nghiệp đối tác để giao dịch an toàn.

### 4. Ký số & Xác thực Tài liệu Điện tử (Document Signing & Verification)
- **Ký văn bản trực tiếp**: Sinh chữ ký bảo mật inline clearsigned (`-----BEGIN PGP SIGNED MESSAGE-----`).
- **Ký tệp tin rời (Detached Signature)**: Ký mọi định dạng tài liệu (PDF, DOCX, ZIP, v.v.), xuất file chữ ký số rời (`.sig.asc`).
- **Xác thực toàn vẹn & Kiểm tra chuỗi CA**: Kiểm tra dữ liệu có bị chỉnh sửa hay không, đồng thời đối chiếu khóa của người ký có được bảo chứng bởi Corporate Root CA hay không.
- Cảnh báo tức thì nếu chứng chỉ của người ký đã bị **Thu hồi (Revoked)**.

### 5. Trao đổi Mật Liên Doanh nghiệp (B2B Secure Messaging)
- **Mã hóa đầu cuối (E2E Encryption)**: Nội dung và tài liệu được mã hóa bằng **Public Key của doanh nghiệp đối tác**. Chỉ bên nhận sở hữu Private Key mới giải mã được.
- **Ký số chứng thực (Digital Signature)**: Thông điệp đồng thời được ký bằng **Private Key của doanh nghiệp gửi**.
- **Giải mã & Tem chứng nhận**: Bên nhận mở khóa và nhận được tem xác thực danh tính: *"Chữ ký của Đối tác HỢP LỆ và xác thực danh tính 100%"*.

### 6. Nhật ký Kiểm toán Bất biến (Audit Trail)
- Tự động ghi vết toàn bộ sự kiện: Khởi tạo Root CA, Cấp chứng chỉ, Thu hồi khóa, Ký văn bản, Xác thực, Gửi nhận tin B2B.

---

## 🚀 Khởi chạy Ứng dụng

Hệ thống đã cài đặt sẵn các package cần thiết. Bạn chỉ cần chạy lệnh sau từ thư mục dự án:

```powershell
npm run dev
```

- **Frontend UI**: [http://localhost:5173](http://localhost:5173) (Giao diện React + Tailwind CSS phong cách Enterprise Cyber Security).
- **Backend CA Server**: [http://localhost:5000](http://localhost:5000) (REST API Express + OpenPGP.js Core).

---

## 📁 Cấu trúc Thư mục

```
pgp_in_business_environment/
├── package.json               # Root scripts chạy đồng thời backend & frontend
├── backend/
│   ├── server.js              # REST API Express (CA, Certificates, Directory, Signing, B2B)
│   ├── pgp-service.js         # Core OpenPGP.js (Generate, Certify, Sign, Verify, Encrypt)
│   ├── store.js               # JSON Database & Audit Logger
│   └── data/
│       └── db.json            # Cơ sở dữ liệu trạng thái CA, Khóa & Tin nhắn
└── frontend/
    ├── src/
    │   ├── App.jsx            # Ứng dụng trung tâm & Điều hướng phân hệ
    │   ├── api.js             # API Client Axios
    │   └── components/
    │       ├── Navbar.jsx              # Header & Trạng thái Root CA
    │       ├── DashboardView.jsx       # Bảng điều khiển tổng quan CA
    │       ├── CertificatesView.jsx    # Phân hệ Quản lý Chứng chỉ
    │       ├── KeyDirectoryView.jsx    # Danh bạ Public Key Nội bộ & Đối tác
    │       ├── DocumentSigningView.jsx # Phân hệ Ký & Xác thực số
    │       ├── B2BMessagingView.jsx    # Cổng trao đổi Mật B2B E2E
    │       ├── AuditLogsView.jsx       # Nhật ký Kiểm toán An ninh
    │       ├── IssueCertModal.jsx      # Modal Cấp chứng chỉ
    │       ├── ImportKeyModal.jsx      # Modal Thêm khóa đối tác
    │       ├── RevokeCertModal.jsx     # Modal Thu hồi chứng chỉ
    │       └── KeyDetailModal.jsx      # Modal Xem chi tiết khóa & Fingerprint
```
