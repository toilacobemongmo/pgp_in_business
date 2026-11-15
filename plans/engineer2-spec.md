# Đặc tả & Ma trận kiểm thử — Phân hệ Kỹ sư 2

**Vai trò:** Quản trị Root CA & Phân quyền Quorum / Key Escrow
**Nguồn phân công:** `BAO_CAO_KY_SU_4_WOT.md` dòng 41 — "Kỹ sư 2 bảo vệ Root CA/quorum; fingerprint Root CA hoặc trust anchor được dùng làm `source`."

---

## 1. Ranh giới trách nhiệm

| Hạng mục | Thuộc Kỹ sư 2 | Không thuộc Kỹ sư 2 |
|---|---|---|
| Sinh / nạp / giải mã khóa riêng Root CA | ✔ | |
| Ký chứng thực danh tính (`signPrimaryUser`) | ✔ | |
| Thu hồi chứng chỉ + sinh revocation signature | ✔ | |
| Shamir split/combine GF(256) | ✔ | |
| Trạng thái SEALED/UNSEALED + Quorum unseal | ✔ | |
| Bóc tách packet RFC 4880 | | ✔ Kỹ sư 1 |
| Dựng cây Merkle / proof | | ✔ Kỹ sư 3 |
| Đồ thị tin cậy / Dijkstra | | ✔ Kỹ sư 4 |
| Mã hóa B2B / streaming | | ✔ Kỹ sư 5 |

**Hợp đồng giao diện:**
- Cung cấp cho Kỹ sư 4: `caConfig.fingerprint` làm `source` của trust anchor.
- Cung cấp cho Kỹ sư 5: chứng chỉ công khai đã được chứng thực (`certifiedPublicKeyArmored`).
- Tiêu thụ từ Kỹ sư 3: `store.logAudit()` để ghi log vào sổ cái Merkle.

---

## 2. Vấn đề hiện trạng (đã kiểm chứng bằng `analysis/probe.mjs`)

| # | Vấn đề | Bằng chứng | Mức độ |
|---|---|---|---|
| V1 | Độ dài share hex = đúng độ dài byte secret | probe P1: secret 31 byte → share hex 31 byte | Trung bình (rò rỉ metadata) |
| V2 | Passphrase Root CA hardcode `EnterpriseRootCAPassphrase@2026` | `backend/pgp-service.js:5`, `backend/server.js:437`, `ShamirKeyShardingView.jsx:125` | Cao |
| V3 | Không có cơ chế Quorum: bất kỳ ai gọi API cấp cert đều ký được | `backend/server.js:77` không kiểm tra trạng thái CA | Cao |
| V4 | Thu hồi chỉ đổi cờ JSON, không sinh revocation signature RFC 4880 | `backend/pgp-service.js:285-314` | Trung bình |
| V5 | `combine()` không kiểm tra `threshold`/`totalShares` nhất quán giữa các mảnh; không kiểm tra `x` nằm trong `[1, n]` | `backend/shamir-service.js:126-155` | Trung bình |
| V6 | Không có xác thực toàn vẹn: mảnh bị sửa 1 byte → trả về rác không báo lỗi | `backend/shamir-service.js:190` trả chuỗi UTF-8 bất kể | Trung bình |

---

## 3. Thiết kế kỹ thuật

### 3.1 Lớp bọc chống lộ độ dài (length-hiding envelope)

Trước khi đưa vào đa thức, secret được đóng gói:

```
payload = [version(1B)=0x02][sessionTag(8B)][lenField(4B BE)][secretBytes][0x00 padding][tag(16B)]
totalLen = roundUp(13 + secretLen, blockSize)   // blockSize = 16; header = 1+8+4 = 13B
```

- `sessionTag`: 8 byte ngẫu nhiên, sinh một lần mỗi `split()`, nhúng vào cả envelope và metadata từng mảnh.
- `lenField` ghi độ dài thật của secret.
- Padding 0x00 lấp đầy tới bội số `blockSize`, khiến độ dài share chỉ phản ánh **bội số 16** chứ không phải byte chính xác.
- `tag` = `SHA-256(payloadWithoutTag)[:16]` — đây là **checksum không khóa** (keyless), **không phải HMAC**. Chỉ dùng để phát hiện hỏng/ghép sai mảnh; kẻ biết cấu trúc có thể tính lại (ghi rõ hạn chế này trong báo cáo).

Kết quả: hai secret khác độ dài nhưng cùng bucket 16 byte cho **share cùng độ dài** → không rò rỉ byte chính xác.

### 3.2 Kiểm tra hợp lệ khi combine

- Mọi mảnh phải cùng `threshold`, cùng `totalShares`, cùng `data.length`.
- `x` phải trong `[1, totalShares]`, không trùng.
- Số mảnh >= `threshold`.
- `combine()` **từ chối cứng** mảnh định dạng cũ `SHR-kOFn-id-hex` (không có `sessionTag`): `parseShare()` vẫn đọc được nhưng đặt `sessionTag = null`, và `combine()` ném lỗi khi gặp `!sessionTag` — không có legacy fallback, không trả bytes kèm cảnh báo.
- Sau khi nội suy: đối chiếu `sessionTag` trong envelope với `sessionTag` trong metadata từng mảnh; kiểm tra `version == 0x02` và `tag` khớp → nếu không, ném lỗi.

### 3.3 Máy trạng thái Root CA

```
UNINITIALIZED --initCA()--> SEALED --unseal(shares)--> UNSEALED --seal()/timeout--> SEALED
```

- `SEALED`: `issueCertificate` / `revokeCertificate` trả lỗi 423 Locked.
- `UNSEALED`: giữ `caPrivateKey` object trong RAM module-scope (không ghi xuống đĩa), tự động seal sau `UNSEAL_TTL_MS` (mặc định 5 phút) hoặc khi gọi `/api/ca/seal`.
- Trạng thái lưu trong `db.ca_config.isSealed` để restart server quay về SEALED (fail-safe).

### 3.4 Revocation signature

- openpgp 6.3.2 **không có** `createRevocationCertificate` và `openpgp.revokeKey({ key, revocationCertificate: externCert })` không nhận packet từ ngoài. Cơ chế thực tế đã kiểm chứng:
  1. `generateKey()` trả về `revocationCertificate` (pre-generated, Packet Tag 2 loại `0x20`, 192 byte).
  2. `issueCertificate()` lưu ngay vào `certRecord.revocationCertificateArmored` (trước đây bị vứt bỏ).
  3. `revokeCertificate()` gọi `applyRevocationCertificate(publicKey, revocationCert)` để xác minh cert hợp lệ, rồi `revokeKey({ key: privateKey, reasonForRevocation })` để sinh `revokedPublicKeyArmored`.
- Lưu vào `certRecord.revocationCertificateArmored`, `certRecord.revocationSignatureArmored`, `certRecord.revokedPublicKeyArmored`.
- `verifyDocument()` đọc thêm chữ ký thu hồi và trả `isRevoked: true` nếu tìm thấy.

---

## 4. Ma trận ca kiểm thử

### 4.1 Shamir Engine (`backend/shamir-service.js`) — 21 ca, 31 assertion (S1–S21)

| ID | Ca thực tế | Kỳ vọng |
|---|---|---|
| S1 | split 5 mảnh, round-trip ASCII | 5 mảnh; trả "hello" từ 3 |
| S2 | round-trip UTF-8 (tiếng Việt) | đúng chuỗi gốc |
| S3 | mọi tổ hợp con k=3/n=5 | tất cả 10 tổ hợp đều khôi phục đúng |
| S4 | combine không phụ thuộc thứ tự | đúng bất kể hoán vị |
| S5 | k-1 mảnh bị từ chối | throw |
| S6 | trùng x bị từ chối | throw |
| S7 | mảnh từ hai phiên khác nhau bị từ chối | throw |
| S8 | tryCombine phát hiện mảnh bị sửa | `ok=false` |
| S9 | share mang version-v2, bội số block, sessionTag 16 hex | đúng cả 4 assertion |
| S10 | version byte đúng sau nội suy; share riêng lẻ không chứa version byte plaintext | đúng cả 2 assertion |
| S11 | secret rỗng bị từ chối | throw |
| S12 | k > n bị từ chối | throw |
| S13 | hai secret cùng bucket → share cùng độ dài; share = 3 block = 96 hex | đúng cả 2 assertion |
| S14 | hai secret khác bucket → share khác độ dài; cả hai vẫn là bội số block | đúng cả 2 assertion |
| S15 | n > 255 bị từ chối | throw |
| S16 | k < 2 bị từ chối | throw |
| S17 | share sai định dạng bị từ chối | throw |
| S18 | tryCombine ok=true; trả đúng secret | đúng cả 2 assertion |
| S19 | n không phải số nguyên bị từ chối | throw |
| S20 | parseShare đọc được mảnh v1 nhưng sessionTag=null; combine **từ chối cứng** mảnh v1 | đúng cả 2 assertion — không có legacy fallback |
| S21 | envelope sai version bị từ chối; parseShare vẫn đọc được payload | đúng cả 2 assertion |

### 4.2 CA Lifecycle & Quorum (`backend/pgp-service.js`) — 9 ca, 15 assertion (C0–C9)

| ID | Ca thực tế | Kỳ vọng |
|---|---|---|
| C0 | import PgpService thành công | không throw |
| C1 | Root CA mặc định SEALED; ttlMs > 0 | đúng cả 2 assertion |
| C2 | requireUnsealed() khi SEALED | statusCode=423, code=CA_SEALED |
| C3 | _getOperatingCaKey() khi SEALED | statusCode=423 |
| C4 | unsealCA mảnh rác bị từ chối | throw "Unseal thất bại" |
| C5 | unsealCA mảng rỗng bị từ chối | throw "Unseal thất bại" |
| C6 | sealCA idempotent khi đã SEALED; vẫn SEALED sau đó | đúng cả 2 assertion |
| C7 | unsealedAt=null, sealExpiresAt=null sau seal | đúng cả 2 assertion |
| C8 | pgp-service.js không còn passphrase hardcode; đọc từ env | đúng cả 2 assertion |
| C9 | TTL đọc từ CA_UNSEAL_TTL_MS | đúng |

### 4.3 API smoke (chạy server thật) — 9 ca, 21 assertion (A1–A9)

| ID | Endpoint | Kỳ vọng |
|---|---|---|
| A1 | `GET /api/ca/status` | 200, có `isSealed` |
| A2 | `POST /api/certificates/issue` khi SEALED | 423 |
| A3 | `POST /api/ca/unseal` mảnh sai | 400 |
| A4 | `POST /api/ca/unseal` đủ mảnh đúng | 200, `isSealed=false` |
| A5 | `POST /api/certificates/issue` khi UNSEALED | 201 |
| A6 | `POST /api/ca/revoke` | 200, status=revoked |
| A7 | `POST /api/ca/seal` | 200 |
| A8 | `POST /api/certificates/issue` sau seal | 423 |
| A9 | `POST /api/shamir/split` không truyền secret | 400 |

### 4.4 Auth & Role (`backend/auth.js`) — 107 assertion (B1–B13)

Bộ test `tests/engineer2-api-auth.test.mjs`, chạy server thật với 4 role-token (admin/security_officer/auditor/employee).

| Nhóm | Ca tiêu biểu | Kỳ vọng |
|---|---|---|
| B1–B4 | Request không có token | 401 |
| B5–B8 | Token sai role | 403 |
| B9–B10 | Token hợp lệ, đúng role | 200/201 |
| B11 | Endpoint admin-only với token employee | 403 |
| B12 | Global error handler trả JSON | có `code` |
| B13 | Mọi route đã bảo vệ có guard | đúng |

### 4.5 Quorum Shard Store (`backend/quorum-shard-store.js`) — 47 assertion

Bộ test `tests/engineer2-quorum-shards.test.mjs`.

| Nhóm | Ca tiêu biểu | Kỳ vọng |
|---|---|---|
| Ghi mảnh | writeShards() ghi 5 file `shard-*.txt` | đúng tên file, nội dung, readme |
| Đọc mảnh | readShard() / readShardKeys() | trả đúng nội dung |
| Dọn mảnh | purgeShards() | xóa hết, không còn file |
| Path guard | writeShards với path lạ | throw |

### 4.6 Demo Key Gate (`backend/demo-mode.js`) — 48 assertion (G1.1–G7.4)

Bộ test `tests/engineer2-demo-key-gate.test.mjs`, dùng `check()` thay `ok()`.

| Nhóm | Ca tiêu biểu | Kỳ vọng |
|---|---|---|
| G1 | DEMO_PLAINTEXT_KEYS không đặt | `demoPrivateKeyArmored` không xuất hiện trong response |
| G2 | DEMO_PLAINTEXT_KEYS=false | như G1 |
| G3 | DEMO_PLAINTEXT_KEYS=1 | khóa có mặt trong response (cờ bật) |
| G4–G7 | Mutation test | 5 ca độc lập đều bắt được gate bị phá |

---

## 5. Tiêu chí hoàn thành

1. Toàn bộ 46 assertion quorum-ca (S1–S21, C0–C9) + 21 assertion smoke (A1–A9) + 107 assertion auth (B1–B13) + 47 assertion quorum-shards + 48 assertion demo-key-gate PASS bằng chạy thật.
2. Không còn chuỗi `EnterpriseRootCAPassphrase@2026` xuất hiện trong `backend/*.js` và `frontend/src/components/ShamirKeyShardingView.jsx`.
3. `db.json` được thêm vào `.gitignore`; trường `demoPrivateKeyArmored` / `privateKeyArmoredDemo` chỉ xuất hiện trong response khi `DEMO_PLAINTEXT_KEYS=1` (flag-gated, mặc định OFF) — khóa vẫn tồn tại trong DB cho demo, nhưng không lộ ra API trừ khi cờ bật.
4. Các file khác của nhóm (merkle, wot, inspector) vẫn `node --check` EXIT=0.
5. Báo cáo `Bao_cao_Ky_su_2.md` ghi rõ: dữ liệu test là tổng hợp, số lần chạy, và các hạn chế (chưa có HSM, chưa có audit trail ký số cho unseal, TTL quản lý trong RAM).

## 6. Rủi ro đã biết

Các mục dưới đây là hạn chế **còn tồn tại sau khi sửa**, không phải việc phải làm tiếp. Mục nào đã xử lý thì ghi rõ đã xử lý.

- **`privateKeyArmored` KHÔNG bị xóa.** Khóa riêng Root CA vẫn nằm trong `db.json` (đã gitignore) và là đầu vào bắt buộc của `unsealCA()` (`backend/pgp-service.js:109` đọc `caConfig.privateKeyArmored`, `:127` giải mã bằng passphrase khôi phục từ quorum). Chỉ khóa **demo** (`demoPrivateKeyArmored` / `privateKeyArmoredDemo`) mới bị cổng `DEMO_PLAINTEXT_KEYS` chặn. Việc xóa hẳn `privateKeyArmored` sẽ làm hỏng unseal — chưa làm, và nếu làm phải kèm migrate sang HSM hoặc file khóa ngoài DB.
- **Audit trail của unseal không quy được về từng cá nhân.** `unsealCA()` có ghi `CA_UNSEAL` (`backend/pgp-service.js:141`), nhưng `actor` là chuỗi tĩnh `'Multi-Admin Quorum'` và `details` chỉ ghi **số lượng** mảnh, không ghi danh tính người giữ mảnh nào. Tương tự `sealCA()` ghi `'Security Officer'` cố định (`:67`). Muốn truy trách nhiệm cần truyền danh tính từng người giữ mảnh vào `unsealCA()` — chưa có.
- **TTL chỉ quản lý trong RAM.** `caSession.expiresAt` là biến tiến trình; restart backend là mất trạng thái SEALED/UNSEALED và mọi phiên unseal bị reset. Không có cơ chế persist để chống bỏ qua TTL bằng cách restart.
- **Mảnh khóa nằm trên đĩa dạng plaintext.** `quorum-shard-store.js` ghi file `0600` trong `backend/data/quorum-shards/` (đã gitignore). Quyền `0600` chỉ chặn user khác trên cùng máy; ai đọc được thư mục đó là đủ ngưỡng k để unseal. Chưa mã hóa mảnh bằng khóa của từng người giữ.
- **`DEMO_PLAINTEXT_KEYS=1` đưa khóa riêng về client.** Cờ này phục vụ demo/học tập; khi bật, `demoPrivateKeyArmored` trả về trong response API. Không dùng ở môi trường thật.
- **Chưa thể kiểm thử với HSM/TPM.** Toàn bộ bằng chứng chỉ ở mức ứng dụng Node.js; không có chứng cứ nào về bảo vệ khóa ở lớp phần cứng.
- **Frontend đã bỏ passphrase hardcode** — `B2BMessagingView.jsx:61` gửi `senderIsCA: true` + KeyID, backend ký bằng session RAM và trả `423` nếu CA chưa UNSEALED. Rủi ro V2 trong §2 đã đóng; mục này ghi lại để người đọc báo cáo cũ không hiểu nhầm.

---

## 7. Khác biệt so với `wot-analyzer.js` của Kỹ sư 4

Phần này ghi nhận chỗ **không tương thích** giữa `backend/wot-analyzer.js` của dự án và bản gốc `wot-analyzer.js` trong `PGP_KySu4_WoT_Source.zip` (Kỹ sư 4). Đây là ghi nhận trung thực, không phải tuyên bố bản nào đúng hơn.

| Hạng mục | Bản Kỹ sư 4 (gốc) | Bản trong dự án (`backend/wot-analyzer.js`) | Hệ quả |
|---|---|---|---|
| Trọng số cạnh | Suy ra từ **loại chứng thực** qua bảng cứng: `0x10→0.5`, `0x11→0.65`, `0x12→0.8`, `0x13→1.0` (`certificationWeight`) | Gán cứng theo **quan hệ**: `CA_CERTIFIED→0.95`, `B2B_FEDERATED_TRUST→0.8`, `CROSS_SIGNATURE→0.75` | Cùng một cặp khóa cho ra điểm tin cậy khác nhau giữa hai bản. Số của dự án không suy ra được từ dữ liệu chứng thực thật. |
| Đại lượng tối ưu | `capacity` nhân dồn có **hệ số suy giảm `gamma = 0.85`** cho mỗi hop (hop đầu không giảm); chi phí `cost = -log(capacity)` | `cost = 1` mỗi hop (tối ưu **số hop**), điểm tin cậy chỉ nhân dồn `weight` và **không có suy giảm theo độ sâu** | Đường đi chọn được có thể khác nhau. Dự án ưu tiên ít hop; bản gốc ưu tiên capacity cao. |
| Giới hạn độ sâu | `maxHops = 4` mặc định, vượt là cắt | **Không giới hạn** độ sâu | Bản gốc tránh được đường đi quá dài gây điểm tin cậy thấp giả tạo; dự án thì không. |
| Tìm nhiều đường độc lập | Có `findIndependentTrustFlow` với `maxPaths = 3`, gộp song song bằng `combineParallelWeights` = `1 − Π(1 − wᵢ)` | **Không có** | Dự án không phát hiện được "nhiều đường tin cậy yếu cộng lại thành mạnh" — đây là thiếu sót thật, không phải lựa chọn thiết kế. |
| Điểm nghẽn | `findSecurityBottlenecks` dùng thuật toán **Tarjan** (dfs + low-link) tìm articulation point | `analyzeNetworkResilience` chỉ đếm bậc: `totalConnections >= 3` → `isCriticalHub` | Khác bản chất. Đếm bậc không tìm ra điểm nghẽn đồ thị; một nút bậc 4 trong một cụm tách rời vẫn bị gắn nhãn "critical hub". |
| Xử lý chu trình | `current.path.includes(edge.target)` → bỏ cạnh quay lại | Không kiểm tra chu trình; dựa vào `visited` | Với đồ thị có chu trình, `prev` của dự án có thể tạo đường đi không đơn giản. |
| Kiểm tra đầu vào | Ném `TypeError` / `RangeError` với `gamma` ngoài `(0,1]`, `maxHops` không phải số nguyên… | Không validate; nhận thẳng object `graph` đã dựng sẵn | Bản dự án không dùng lại được như thư viện độc lập. |
| Định dạng module | CommonJS (`module.exports`) | ESM (`export class`) | Không import chéo trực tiếp được nếu không đổi module system. |

**Kết luận:** hai bản không phải cùng một thuật toán. `backend/wot-analyzer.js` là bản viết lại phục vụ hiển thị trong app (nhận `graph` đã dựng từ `buildTrustGraph`), **không** thay thế được bản của Kỹ sư 4 và không tái lập được kết quả số của bản đó. Nếu cần đối chiếu số liệu với Kỹ sư 4, phải chạy bản gốc.
