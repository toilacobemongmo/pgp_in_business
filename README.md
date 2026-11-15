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

> **Lưu ý về phân quyền:** "Role Switcher" trên thanh điều hướng chỉ là bộ chọn **góc nhìn UI**. Việc phân quyền thật nằm ở backend: mỗi request phải kèm token trong header `Authorization: Bearer <token>` (hoặc `X-Auth-Token`), backend ánh xạ token → role (`admin` / `employee` / `partner`) và chặn bằng guard theo từng route. Thiếu token → `401`, sai role → `403`. Màn hình [`AuthLoginView.jsx`](./frontend/src/components/AuthLoginView.jsx) dùng để nhập token; token được lưu ở `localStorage` qua [`api.js`](./frontend/src/api.js).

## 🏗️ Kiến Trúc Kỹ Thuật & Sơ Đồ Quy Trình

### 1. Sơ Đồ Toàn Cảnh Kiến Trúc Hệ Thống (System Architecture)
![System Architecture](./diagrams/system_architecture.png)

### 2. Quy Trình Cấp Chứng Chỉ & Ký Số Xác Thực Toàn Vẹn
![CA & Signing Workflow](./diagrams/ca_and_signing_flow.png)

### 3. Quy Trình Trao Đổi Thông Điệp Mật B2B (Sign-then-Encrypt Pipeline)
![B2B Secure Messaging Pipeline](./diagrams/b2b_e2e_messaging.png)

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

### Biến Môi Trường Bảo Mật

Hệ thống chạy được với cấu hình mặc định, nhưng các biến dưới đây quyết định mức bảo mật thực tế. Đặt trong `.env` (đã gitignore) hoặc export trước khi chạy.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `AUTH_TOKEN_ADMIN` | *(không đặt)* | Token cho role `admin`. Tối thiểu 16 ký tự, ngắn hơn sẽ bị bỏ qua kèm cảnh báo. |
| `AUTH_TOKEN_EMPLOYEE` | *(không đặt)* | Token cho role `employee`. |
| `AUTH_TOKEN_PARTNER` | *(không đặt)* | Token cho role `partner`. |
| `AUTH_DISABLED` | `false` | `true` → **bỏ qua toàn bộ kiểm tra auth**. Chỉ dùng cho dev/demo cục bộ; **không** bật ở môi trường thật. |
| `CA_UNSEAL_TTL_MS` | `300000` (5 phút) | Thời gian sống của phiên Root CA đã unseal. Hết hạn → backend tự niêm phong lại, các route cần khóa trả `423 Locked`. |
| `CA_PASSPHRASE` | *(không đặt)* | Chỉ dùng khi gọi `/api/shamir/split` mà không truyền `secret`; nếu cũng không có thì trả `400`. |
| `DEMO_PLAINTEXT_KEYS` | `false` | `1` / `true` / `yes` / `on` → trả khóa riêng demo (`demoPrivateKeyArmored`, `privateKeyArmoredDemo`) trong response API. Mặc định **TẮT** để khóa riêng không rời khỏi backend. |
| `DB_FILE_OVERRIDE` | *(không đặt)* | Trỏ sang file DB khác trong `backend/data/`. Dùng cho test cách ly; có chặn path traversal. |
| `PORT` | `5000` | Cổng backend. |

### Mảnh Khóa Quorum (Shamir Sharding)

Khi gọi `/api/shamir/split`, các mảnh khóa được ghi thành file `0600` trong `backend/data/quorum-shards/` (**đã gitignore**) qua [`quorum-shard-store.js`](./backend/quorum-shard-store.js), kèm một file README hướng dẫn bàn giao. Cần tối thiểu `k` mảnh để `/api/ca/unseal` khôi phục passphrase — backend **không** giữ bí mật này giữa các lần khởi động. Mỗi mảnh mang `sessionTag` riêng của lần `split()`, nên mảnh từ hai lần split khác nhau **không** ghép được với nhau.

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
├── .gitignore                 # Loại trừ node_modules, db.json, quorum-shards/
├── README.md                  # Tài liệu hướng dẫn sử dụng và kiến trúc
├── backend/
│   ├── server.js              # REST API Express (CA, Certificates, Directory, Signing, B2B)
│   ├── pgp-service.js         # Core OpenPGP Engine + vòng đời khóa Root CA (seal/unseal)
│   ├── shamir-service.js      # Chia/ghép bí mật Shamir trên GF(256), envelope v2
│   ├── quorum-shard-store.js  # Ghi/đọc/xóa mảnh khóa quorum thành file 0600
│   ├── auth.js                # Middleware xác thực token & phân quyền theo role
│   ├── demo-mode.js           # Cổng cờ DEMO_PLAINTEXT_KEYS
│   ├── merkle-engine.js       # Cây Merkle cho nhật ký kiểm toán
│   ├── wot-analyzer.js        # Phân tích Web of Trust (đường tin cậy, điểm nghẽn)
│   ├── pgp-packet-inspector.js# Bóc tách gói tin OpenPGP (RFC 4880)
│   ├── store.js               # JSON Database & Audit Logger
│   └── data/
│       ├── db.example.json    # Mẫu cấu trúc DB (commit được, không chứa khóa)
│       ├── db.json            # DB thật — ĐÃ GITIGNORE, chứa khóa riêng đã mã hóa
│       └── quorum-shards/     # Mảnh khóa quorum — ĐÃ GITIGNORE
├── tests/                     # Bộ test chạy thật bằng node, không cần framework
│   ├── engineer2-quorum-ca.test.mjs    # Shamir + vòng đời CA (46 assertion)
│   ├── engineer2-api-smoke.mjs         # Smoke API end-to-end (21 assertion)
│   ├── engineer2-api-auth.test.mjs     # Xác thực & phân quyền (107 assertion)
│   ├── engineer2-quorum-shards.test.mjs# File I/O mảnh quorum (47 assertion)
│   └── engineer2-demo-key-gate.test.mjs# Cổng khóa demo (48 assertion)
├── plans/
│   └── engineer2-spec.md      # Đặc tả kỹ thuật & ma trận kiểm thử
└── frontend/
    ├── vite.config.js         # Cấu hình Vite & proxy /api → :5000
    └── src/
        ├── App.jsx            # Điều phối view theo role
        ├── api.js             # API Client + giữ token trong localStorage
        └── components/
            ├── AuthLoginView.jsx       # Nhập token để đăng nhập
            ├── Navbar.jsx              # Header, chuyển góc nhìn, đăng xuất
            ├── DashboardView.jsx       # Bảng điều khiển Quản trị CA
            ├── CertificatesView.jsx    # Quản lý Chứng chỉ Cán bộ
            ├── KeyDirectoryView.jsx    # Danh bạ Public Key & Đối tác
            ├── DocumentSigningView.jsx # Phân hệ Ký số & Xác thực
            ├── ShamirKeyShardingView.jsx # Chia mảnh / ghép mảnh / seal / unseal
            ├── B2BMessagingView.jsx    # Cổng trao đổi Mật B2B E2E
            ├── EmployeePortalView.jsx  # Cổng Nhân viên tự phục vụ
            ├── PartnerPortalView.jsx   # Cổng Đối tác B2B ngoài
            ├── PublicVerifierView.jsx  # Cổng Thẩm tra Công khai
            ├── IntegrationGuideView.jsx# Trung tâm Hướng dẫn Tích hợp
            ├── MerkleAuditView.jsx     # Kiểm toán nhật ký bằng cây Merkle
            ├── WebOfTrustView.jsx      # Trực quan hóa Web of Trust
            ├── PacketInspectorView.jsx # Bóc tách gói tin OpenPGP
            ├── IssueCertModal.jsx      # Modal Cấp chứng chỉ
            ├── ImportKeyModal.jsx      # Modal Thêm đối tác B2B
            ├── RevokeCertModal.jsx     # Modal Thu hồi chứng chỉ
            └── KeyDetailModal.jsx      # Modal Xem chi tiết khóa
```

### Chạy Kiểm Thử

```bash
# Từ thư mục gốc — mỗi file tự chứa, không cần framework
node tests/engineer2-quorum-ca.test.mjs
node tests/engineer2-api-smoke.mjs
node tests/engineer2-api-auth.test.mjs
node tests/engineer2-quorum-shards.test.mjs
node tests/engineer2-demo-key-gate.test.mjs
```

Các file test quorum-ca và quorum-shards tự tạo DB tạm cách ly với `db.json` thật rồi dọn dẹp khi kết thúc.

---

## 📄 Bản Quyền & Giấy Phép
Dự án được phát triển phục vụ mục đích nghiên cứu, triển khai bảo mật thông tin và hạ tầng chữ ký số trong môi trường doanh nghiệp. Tuân thủ tiêu chuẩn mã nguồn mở MIT.
