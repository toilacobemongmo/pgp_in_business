# 🛡️ Enterprise OpenPGP Certificate Authority (CA) & B2B Secure Exchange

> **Hạ tầng Trung tâm Chứng thực Chữ ký số OpenPGP & Cổng Giao dịch Trao đổi Doanh nghiệp (Enterprise Trust Center)**  
> Tuân thủ chuẩn mật mã mở **RFC 4880 (OpenPGP)** & Thuật toán đường cong elliptic hiện đại **ECC Curve25519 (Ed25519)**.

---

## 🏛️ Giới Thiệu Hệ Thống

Dự án được xây dựng nhằm giải quyết toàn diện bài toán bảo mật và chữ ký số trong môi trường doanh nghiệp hiện đại:
- **Trung tâm CA Gốc Doanh nghiệp (Corporate Root CA)**: Khởi tạo và bảo trợ nguồn gốc tin cậy (Root of Trust), ký chứng thực danh tính cho cán bộ, nhân viên và các phòng ban.
- **Chứng thực Danh tính Số (Corporate Certification Signature)**: Nhúng trực tiếp chữ ký của CA lên Public Key của nhân viên theo chuẩn OpenPGP Web of Trust.
- **Ký số & Thẩm định Toàn vẹn Tài liệu**: Hỗ trợ ký văn bản (Inline Clearsign) và tệp tin rời (Detached Signature cho PDF, DOCX, ZIP). Thẩm định tính toàn vẹn 100% kèm mộc chứng nhận CA.
- **Trao đổi Mật Liên Doanh nghiệp (B2B Secure Messaging)**: Lưu trữ danh bạ Public Key của các doanh nghiệp đối tác ngoài (FINCORP, Logistics, v.v.), mã hóa đầu cuối (E2E) và ký số chống giả mạo khi trao đổi báo giá, hợp đồng nhạy cảm.
- **Nhật ký Kiểm toán Bất biến (Audit Trail)**: Ghi vết toàn bộ hành vi an ninh, hỗ trợ xuất báo cáo kiểm toán JSON.

---

## 👥 4 Góc Nhìn Người Dùng (Role-Based Architecture)

Hệ thống tích hợp sẵn **Bộ Chuyển Đổi Góc Nhìn (Role Switcher)** ngay trên thanh điều hướng để phục vụ từng đối tượng:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ENTERPRISE PGP TRUST CENTER                           │
├───────────────────┬───────────────────┬───────────────────┬─────────────────┤
│ 👑 CA Admin       │ 👩‍💻 Cán bộ Nội bộ │ 🏢 Đối tác B2B    │ 🔍 Thẩm tra     │
│ (Quản trị toàn    │ (Employee Portal: │ (Partner Gateway: │ (Public Portal: │
│ quyền, cấp/thu    │ Quản lý khóa tôi, │ Tải Root CA, gửi  │ Kéo thả kiểm tra│
│ hồi chứng chỉ)    │ ký số văn bản)    │ báo giá mật E2E)  │ tính toàn vẹn)  │
└───────────────────┴───────────────────┴───────────────────┴─────────────────┘
```

1. **👑 CA Administrator**: Quản lý Root CA Master Key, duyệt cấp và thu hồi chứng chỉ, xem danh bạ toàn diện và nhật ký kiểm toán.
2. **👩‍💻 Cán bộ Doanh nghiệp (Employee Workspace)**: Tự phục vụ (Self-service), xem thẻ danh tính số cá nhân, tải cặp khóa của mình, ký nhanh các phiếu trình/hợp đồng phòng ban.
3. **🏢 Doanh nghiệp Đối tác ngoài (B2B Partner Gateway)**: Đối tác ngoài tải Corporate Root CA Certificate đưa vào Trust Store, tra cứu cán bộ có thẩm quyền và gửi thông điệp mã hóa E2E vào công ty.
4. **🔍 Thẩm tra viên Công khai (Public Verifier)**: Bất kỳ ai bên ngoài cũng có thể kéo thả tài liệu để thẩm định chữ ký và kiểm tra mộc chứng nhận CA một chạm mà không cần đăng nhập.

---

## 🏗️ Kiến Trúc Kỹ Thuật

```mermaid
flowchart TB
    subgraph UI ["Giao diện Doanh nghiệp (React 19 + Tailwind CSS + Lucide Icons)"]
        Dashboard["📊 Dashboard & Trạng thái Root Key"]
        CAModule["📜 Trung tâm Cấp & Thu hồi Chứng chỉ"]
        SignModule["✍️ Ký số & Thẩm định Tính Toàn vẹn"]
        DirectoryModule["🏢 Danh bạ Public Key Doanh nghiệp & Đối tác"]
        MsgModule["🔐 B2B Secure Messaging (Mã hóa E2E & Ký số)"]
        AuditModule["📝 Nhật ký Kiểm toán (Audit Trail)"]
        GuideModule["📖 Trung tâm Tích hợp Máy trạm (GnuPG, Git, Email)"]
    end

    subgraph Backend ["Enterprise CA Server (Node.js + Express + OpenPGP.js Core)"]
        RootCA["🔑 Corporate Root CA Engine (Ed25519)"]
        CertService["🛡️ Key Certification & Issuance Service"]
        DocService["📑 Digital Document Signature Service"]
        B2BService["💬 B2B Encryption & Decryption Pipeline"]
        Store[("💾 Database & Key Ring Store")]
    end

    UI <--> Backend
    CertService --> RootCA
    DocService --> RootCA
    B2BService --> Store
    RootCA --> Store
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu Cầu Môi Trường
- **Node.js**: >= 18.x (khuyên dùng Node.js 20.x hoặc 24.x)
- **NPM**: >= 9.x

### Cài Đặt Dependencies
Từ thư mục gốc dự án:
```bash
# Cài đặt thư viện cho backend
npm install --prefix backend

# Cài đặt thư viện cho frontend
npm install --prefix frontend

# Cài đặt root runner
npm install
```

### Khởi Chạy Hệ Thống
Chạy đồng thời cả Backend (port 5000) và Frontend (port 5173):
```bash
npm run dev
```

- **Frontend Portal**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api/ca/status](http://localhost:5000/api/ca/status)

---

## 📖 Hướng Dẫn Tích Hợp Công Cụ Máy Trạm (Integration Hub)

Hệ thống cho phép người dùng sử dụng cặp khóa được cấp trên các phần mềm phổ biến:

### 1. GnuPG / Gpg4win / Kleopatra (Windows/Linux)
```bash
# Nhập khóa cá nhân và khóa Root CA:
gpg --import my_private_key.asc
gpg --import corporate-root-ca.asc

# Ký số văn bản:
gpg --clearsign hop_dong.txt

# Ký số file nhị phân (PDF, DOCX):
gpg --armor --detach-sign bang_ke.pdf

# Xác thực chữ ký tài liệu:
gpg --verify hop_dong.txt.asc
```

### 2. Ký Số Email (Mozilla Thunderbird / Microsoft Outlook)
1. Tải Private Key cá nhân (`.asc`) từ Cổng Nhân viên.
2. Mở Thunderbird &rarr; `Account Settings` &rarr; `End-to-End Encryption` &rarr; `Add Key` &rarr; `Import an existing OpenPGP Key`.
3. Bật tùy chọn tự động ký số (*Digitally sign unencrypted messages*) để đối tác nhận diện danh tính công ty.

### 3. Ký Số Code / Git Commit Signing (Kỹ sư phần mềm)
```bash
git config --global user.signingkey <YOUR_KEY_ID>
git config --global commit.gpgsign true
git commit -S -m "feat: triển khai module bảo mật mới"
```

### 4. Tích Hợp REST API Vào ERP / CRM
```bash
curl -X POST http://localhost:5000/api/documents/sign \
  -H "Content-Type: application/json" \
  -d '{
    "textContent": "Ủy nhiệm chi số #UNC-2026",
    "signerPrivateKeyArmored": "-----BEGIN PGP PRIVATE KEY BLOCK-----\n...",
    "signerPassphrase": ""
  }'
```

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
pgp_in_business_environment/
├── package.json               # Root scripts khởi chạy song song backend & frontend
├── .gitignore                 # Cấu hình loại trừ file rác và node_modules
├── README.md                  # Tài liệu hướng dẫn sử dụng và kiến trúc
├── backend/
│   ├── server.js              # REST API Express (CA, Certificates, Directory, Signing, B2B)
│   ├── pgp-service.js         # Core OpenPGP Engine (Sign, Verify, Encrypt, Decrypt)
│   ├── store.js               # JSON Database & Audit Logger
│   └── data/                  # Thư mục lưu trữ database cục bộ
└── frontend/
    ├── vite.config.js         # Cấu hình Vite & TailwindCSS proxy
    └── src/
        ├── App.jsx            # Điều phối Router và Role Switcher
        ├── api.js             # API Client Axios
        └── components/
            ├── Navbar.jsx              # Header & Role Switcher
            ├── DashboardView.jsx       # Bảng điều khiển Quản trị CA
            ├── CertificatesView.jsx    # Quản lý Chứng chỉ Cán bộ
            ├── KeyDirectoryView.jsx    # Danh bạ Public Key & Đối tác
            ├── DocumentSigningView.jsx # Phân hệ Ký số & Xác thực
            ├── B2BMessagingView.jsx    # Cổng trao đổi Mật B2B E2E
            ├── EmployeePortalView.jsx  # Cổng Nhân viên tự phục vụ
            ├── PartnerPortalView.jsx   # Cổng Đối tác B2B ngoài
            ├── PublicVerifierView.jsx  # Cổng Thẩm tra Công khai
            ├── IntegrationGuideView.jsx# Trung tâm Hướng dẫn Tích hợp
            ├── IssueCertModal.jsx      # Modal Cấp chứng chỉ
            ├── ImportKeyModal.jsx      # Modal Thêm đối tác B2B
            ├── RevokeCertModal.jsx     # Modal Thu hồi chứng chỉ
            └── KeyDetailModal.jsx      # Modal Xem chi tiết khóa
```

---

## 📄 Bản Quyền & Giấy Phép
Dự án được phát triển phục vụ mục đích nghiên cứu, triển khai bảo mật thông tin và hạ tầng chữ ký số trong môi trường doanh nghiệp. Tuân thủ tiêu chuẩn mã nguồn mở MIT.
