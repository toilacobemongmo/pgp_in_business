# Báo cáo Kỹ sư 2 — Bảo vệ Root CA bằng Quorum (Shamir) & Seal/Unseal

**Vai trò:** Kỹ sư 2 — *"bảo vệ Root CA/quorum; fingerprint Root CA hoặc trust anchor được dùng làm `source`"*
**Phạm vi:** `backend/shamir-service.js`, `backend/pgp-service.js`, `backend/server.js`, `backend/store.js`, `backend/auth.js`, `backend/quorum-shard-store.js`, `backend/demo-mode.js`, `frontend/src/{api.js, components/AuthLoginView.jsx, components/B2BMessagingView.jsx, components/Navbar.jsx, components/ShamirKeyShardingView.jsx}`
**Kiểm thử:** `tests/engineer2-quorum-ca.test.mjs`, `tests/engineer2-api-smoke.mjs`, `tests/engineer2-api-auth.test.mjs`, `tests/engineer2-quorum-shards.test.mjs`, `tests/engineer2-demo-key-gate.test.mjs`

---

## 1. Vấn đề của trạng thái ban đầu

| # | Lỗ hổng | Mức độ | Bằng chứng |
|---|---|---|---|
| V1 | Passphrase Root CA hardcode `EnterpriseRootCAPassphrase@2026` nằm trong source backend **và** frontend | Cao | `findstr` trước khi sửa: 5 vị trí (3 ở frontend) |
| V2 | Khóa riêng Root CA dùng được bất cứ lúc nào, không có khái niệm "niêm phong" | Cao | Mọi route cấp/thu hồi/ký đều gọi trực tiếp `decryptKey` |
| V3 | Envelope Shamir **lộ độ dài chính xác** của bí mật (không padding) | Trung bình | `envelopeSecret` cũ ghi `len` ở dạng biến đổi |
| V4 | **Không** phát hiện mảnh bị ghép lẫn giữa hai lần chia khác nhau | Cao | Test S7 thất bại trước khi sửa |
| V5 | `unenvelopeSecret` **âm thầm trả về bytes thô** khi version ≠ `0x02` | Cao | Test S10/S21 thất bại trước khi sửa |
| V6 | Sinh "revocation certificate" bằng API **không tồn tại** | Cao | `openpgp.createRevocationCertificate is not a function` |
| V7 | Không có endpoint Unseal/Seal; frontend phải nhập passphrase tay | Trung bình | `api.js` không có `unsealCA`/`sealCA` |

---

## 2. Thay đổi đã triển khai

### 2.1 `backend/shamir-service.js` — Envelope v2 có session tag

Cấu trúc gói (block 16 byte, che giấu độ dài chính xác):

```
[0x02][sessionTag 8B][lenField 4B BE][secret][0x00 padding][tag 16B]
```

- **Session tag**: mỗi lần `split()` sinh **một** `sessionTag` 8 byte ngẫu nhiên, nhúng vào cả envelope và metadata từng mảnh (`SHR-<k>OF<n>-<x>-<sessionTagHex16>-<dataHex>`).
- **Chống ghép lẫn phiên (V4)**: `combine()` từ chối nếu mảnh không có `sessionTag` (định dạng v1) hoặc nếu các mảnh khác `sessionTag`; sau khi nội suy còn đối chiếu lại `sessionTag` **bên trong envelope** với metadata.
- **Không còn fallback im lặng (V5)**: `unenvelopeSecret()` ném lỗi khi sai version / sai độ dài / sai tag, thay vì trả bytes rác.
- **Toàn vẹn**: tag = `SHA-256` cắt 16 byte, so sánh bằng `crypto.timingSafeEqual`.

### 2.2 `backend/pgp-service.js` — Máy trạng thái Seal/Unseal

- `caSession` lưu khóa riêng **chỉ trong RAM**; `SEALED` là mặc định.
- `unsealCA(shareKeys)`: cần đủ `k` mảnh (mặc định 3-of-5) mới khôi phục được passphrase, giải mã khóa, rồi `_armAutoSeal()`.
- TTL tự niêm phong lại (`CA_UNSEAL_TTL_MS`, mặc định 5 phút); `sealCA()` xóa khóa khỏi RAM và là idempotent.
- `requireUnsealed()` / `_getOperatingCaKey()` ném lỗi `statusCode = 423`, `code = 'CA_SEALED'`.
- `readCaPassphrase()` đọc từ biến môi trường `CA_PASSPHRASE`, **bắt buộc ≥ 12 ký tự** — xóa hoàn toàn passphrase hardcode (V1).
- Cổng quorum áp dụng cho: cấp chứng chỉ, thu hồi, ký tài liệu, gửi/giải mã bản tin B2B khi một bên là Root CA.

### 2.3 Sửa lỗi revocation certificate (V6) — phần mất nhiều thời gian nhất

Giả thuyết ban đầu (dùng `openpgp.createRevocationCertificate`) **sai**. Tôi đã kiểm chứng bằng thực nghiệm thay vì đoán:

| Thử nghiệm | Kết quả |
|---|---|
| Liệt kê export của openpgp 6.3.2 | Chỉ có `revokeKey`, **không có** `createRevocationCertificate` |
| `privateKey.getRevocationCertificate()` sau khi đã `readKey` lại | ❌ `Could not find valid key revocation signature in key <id>` |
| `revokeKey({ key: publicKey, revocationCertificate })` với cert ngoài | ❌ `Packet not allowed in this context: publicKey` |
| `generateKey()` (v6) trả về `revocationCertificate` | ✅ **Packet Tag 2**, 192 byte, `Comment: This is a revocation certificate` |
| `applyRevocationCertificate()` trên public key đã parse lại | ✅ `isRevoked() === true` |
| `revokeKey({ key: privateKey, reasonForRevocation })` | ✅ `isRevoked() === true` |

**Kết luận:** openpgp v6 **chỉ** sinh được revocation certificate ngay trong phiên `generateKey()`.

**Cách sửa:**
1. `issueCertificate()` lưu ngay `userKeypair.revocationCertificate` vào trường `revocationCertificateArmored` của chứng chỉ (trước đây giá trị này bị **vứt bỏ**).
2. `revokeCertificate()` thực hiện 2 bước tách biệt: xác minh certificate lưu sẵn áp dụng được lên khóa, và sinh trạng thái khóa đã thu hồi bằng `revokeKey()` trên private key demo. Lưu kết quả vào `revokedPublicKeyArmored`.
3. `_getOperatingCaKey()` vẫn được gọi ở đầu hàm để giữ **cổng quorum** (ném `CA_SEALED`), dù khóa trả về không dùng để ký — vì v6 không hỗ trợ ký revocation bằng khóa bên thứ ba.

### 2.4 `backend/server.js` — API & ngữ nghĩa lỗi

- Thêm `POST /api/ca/unseal` và `POST /api/ca/seal`.
- `/api/ca/status` bọc `initCA()` trong try/catch → 500 `CA_INIT_FAILED` kèm gợi ý đặt `CA_PASSPHRASE`.
- `handleServiceError()` ánh xạ `CA_SEALED` → **HTTP 423 Locked**.
- Route bản tin nhận `senderIsCA` / `recipientIsCA`; chỉ yêu cầu private key phía client khi không phải CA.

### 2.5 `backend/store.js` — Tách DB cho kiểm thử

Thêm `DB_FILE_OVERRIDE` (chỉ cho phép đường dẫn **bên trong** `backend/data/`) để smoke test không ghi đè `db.json` demo. Nếu không có cơ chế này, chạy test HTTP sẽ phá dữ liệu mẫu — tôi đã sao lưu `db.json.bak` trước khi chạy.

### 2.6 Frontend — gỡ passphrase, thêm Unseal/Seal

- `api.js`: thêm `unsealCA(shares)`, `sealCA()`.
- `B2BMessagingView.jsx`: gửi `senderIsCA`/`recipientIsCA` thay vì passphrase; chặn thao tác khi CA SEALED. Đã sửa biểu thức khó đọc `!caInfo?.isSealed === false` → `caInfo?.isSealed !== false`.
- `ShamirKeyShardingView.jsx`: placeholder không còn gợi ý passphrase mặc định; thêm 3 nút (**Unseal Root CA k-of-n**, **Chỉ xem f(0)**, **Seal ngay**) và panel hiển thị TTL tự niêm phong.

---

## 3. Kết quả kiểm thử (đã chạy thật)

```
node tests/engineer2-quorum-ca.test.mjs       →  46 PASS / 0 FAIL / 46 TOTAL   (S1–S21, C0–C9)
node tests/engineer2-api-smoke.mjs            →  21 PASS / 0 FAIL / 21 TOTAL   (A1–A9)
node tests/engineer2-api-auth.test.mjs        → 107 PASS / 0 FAIL / 107 TOTAL  (B1–B13, 401/403/200)
node tests/engineer2-quorum-shards.test.mjs   →  47 PASS / 0 FAIL / 47 TOTAL   (quorum shard file I/O)
node tests/engineer2-demo-key-gate.test.mjs   →  48 PASS / 0 FAIL / 48 TOTAL   (DEMO_PLAINTEXT_KEYS gate)
node tests/engineer2-ttl-expiry.test.mjs      →  22 PASS / 0 FAIL / 22 TOTAL   (E1–E8, TTL hết hạn thật)
                                            ─────────────────────────────────
                                            291 PASS / 0 FAIL / 291 TOTAL
npx oxlint src                                →  0 errors (74 warnings)
```

Bộ test unit gồm S1–S21 (Shamir) và C0–C9 (trạng thái CA). Bộ smoke test chạy HTTP thật trên cổng 5001 với DB tạm, đi qua toàn bộ vòng đời: `SEALED → issue 423 → unseal sai 400 → unseal đúng 200 → issue 200 → revoke 200 → seal 200 → issue 423`.

Bộ TTL-expiry (Workstream E) đặt `CA_UNSEAL_TTL_MS = 2000`, gọi `initCA()` + `unsealCA()` với 3 mảnh, chờ 2.15 giây, xác nhận `getSealState().isSealed === true` (kiểm tra thời gian) và `requireUnsealed()` throw `423`. Khẳng định thêm: re-unseal hoạt động lại sau khi TTL hết hạn.

Các ca **thực sự bắt được lỗi** (không phải test trang trí): S7 (ghép lẫn phiên), S10/S21 (fallback im lặng), A7 (revocation certificate), E6/E7 (TTL hết hạn → sealed + 423).

---

## 4. Hạn chế & điểm yếu cần nêu khi bảo vệ

Đây là các điểm chưa hoàn thiện, không phải điểm mạnh:

1. **TTL chỉ nằm trong RAM.** Nếu tiến trình Node bị kill đột ngột, khóa riêng biến mất cùng tiến trình — trạng thái an toàn (fail-closed), nhưng không có cơ chế khôi phục ngoài việc unseal lại bằng quorum.
2. **`sessionTag` không chống được kẻ tấn công chủ động.** Nó phát hiện *ghép lẫn vô tình*, không chống kẻ có toàn quyền sửa metadata mảnh. Chống giả mạo thực sự dựa vào tag SHA-256 trong envelope, và tag này **không có khóa** (không phải HMAC) — kẻ biết cấu trúc có thể tính lại tag. Muốn chống mạnh phải dùng HMAC với khóa dẫn xuất từ chính secret.
3. **Revocation certificate do chính chủ khóa ký** (self-revocation) chứ không phải CA ký lên khóa nhân viên. Đây là giới hạn của openpgp v6, không phải lựa chọn thiết kế. Cần nêu rõ nếu bị hỏi "CA ký revocation thế nào".
4. **Khóa cho chứng chỉ do người dùng tự nhập** (không phải CA sinh) sẽ có `revocationCertificateArmored = null` và `demoPrivateKeyArmored = null`, nên thu hồi chỉ đổi trạng thái trong DB — không sinh được artifact mật mã. Test hiện chỉ phủ nhánh CA tự sinh khóa.
5. **Shamir che giấu độ dài chính xác, không che giấu số block.** Bí mật 5 và 12 byte đều ra share 96 ký tự hex, nhưng bí mật vượt ngưỡng 16 byte sẽ dài hơn. Spec S13 đã được sửa cho đúng thực tế này.
6. **~~Chưa có test cho `CA_UNSEAL_TTL_MS` hết hạn thật.~~** ✅ **Đã có** — `tests/engineer2-ttl-expiry.test.mjs` (22 assertion) đặt TTL = 2s, unseal, chờ hết hạn, xác nhận `getSealState().isSealed === true` và `requireUnsealed()` throw 423.
7. **Chưa kiểm thử giao diện.** `oxlint` báo 0 error nhưng tôi chưa chạy ứng dụng React để bấm thử 3 nút Unseal/Seal/View-f(0).
8. **`backend/wot-analyzer.js` không phải thuật toán của Kỹ sư 4.** Bản trong dự án gán trọng số cạnh cứng theo quan hệ (0.95/0.8/0.75) thay vì suy từ loại chứng thực (0x10–0x13), tối ưu theo số hop thay vì `capacity` có hệ số suy giảm `gamma`, không có `findIndependentTrustFlow`, và phát hiện điểm nghẽn bằng đếm bậc thay vì Tarjan. Hai bản cho ra **điểm tin cậy khác nhau trên cùng dữ liệu**. Bảng đối chiếu đầy đủ ở `plans/engineer2-spec.md` §7.
9. **`CA_UNSEAL` không truy được về từng cá nhân.** Audit log ghi `actor = 'Multi-Admin Quorum'` cố định và chỉ ghi *số lượng* mảnh, không ghi ai giữ mảnh nào.
10. **Mảnh khóa nằm trên đĩa dạng plaintext.** File `0600` trong `backend/data/quorum-shards/` (đã gitignore) chỉ chặn user khác cùng máy; ai đọc được thư mục là đủ ngưỡng k để unseal. Chưa mã hóa mảnh bằng khóa riêng của từng người giữ.

---

## 5. Tệp thay đổi

| Tệp | Loại |
|---|---|
| `backend/shamir-service.js` | Sửa — envelope v2, sessionTag, bỏ fallback |
| `backend/pgp-service.js` | Sửa — seal/unseal, quorum gate, lưu revocation cert, sửa `revokeCertificate()` |
| `backend/server.js` | Sửa — endpoint unseal/seal, 423, `senderIsCA`/`recipientIsCA` |
| `backend/store.js` | Sửa — `DB_FILE_OVERRIDE` |
| `backend/auth.js` | Mới — xác thực token + phân quyền role (Workstream A) |
| `backend/quorum-shard-store.js` | Mới — ghi mảnh Shamir ra file 0600 trong `backend/data/quorum-shards/` (Workstream B) |
| `backend/demo-mode.js` | Mới — cờ `DEMO_PLAINTEXT_KEYS` gác khóa riêng demo, mặc định OFF (Workstream C) |
| `frontend/src/api.js` | Sửa — `unsealCA`, `sealCA`; thêm Bearer token header |
| `frontend/src/components/AuthLoginView.jsx` | Mới — form đăng nhập token (Workstream A) |
| `frontend/src/components/B2BMessagingView.jsx` | Sửa — bỏ passphrase, sửa guard |
| `frontend/src/components/Navbar.jsx` | Sửa — hiển thị role, nút đăng xuất (Workstream A) |
| `frontend/src/components/ShamirKeyShardingView.jsx` | Sửa — UI unseal/seal |
| `tests/engineer2-quorum-ca.test.mjs` | Mới — 46 assertion (S1–S21, C0–C9); đã sửa cách ly DB |
| `tests/engineer2-api-smoke.mjs` | Mới — 21 assertion HTTP (A1–A9) |
| `tests/engineer2-api-auth.test.mjs` | Mới — 107 assertion 401/403/200 (B1–B13, Workstream A) |
| `tests/engineer2-quorum-shards.test.mjs` | Mới — 47 assertion quorum shard file I/O (Workstream B) |
| `tests/engineer2-demo-key-gate.test.mjs` | Mới — 48 assertion cờ DEMO_PLAINTEXT_KEYS (Workstream C) |
| `tests/engineer2-ttl-expiry.test.mjs` | Mới — 22 assertion TTL hết hạn thật (Workstream E) |
| `.gitignore` | Sửa — thêm `backend/data/db.json`, `backend/data/quorum-shards/` |
| `backend/data/db.example.json` | Mới — mẫu DB không có khóa riêng |
| `plans/engineer2-spec.md` | Sửa — đặc tả + ma trận test, sửa S13 |
| `Bao_cao_Ky_su_2.md` | Mới — báo cáo này |
