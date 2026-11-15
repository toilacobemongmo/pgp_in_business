# Bàn giao kỹ sư 3 — Cây Merkle kiểm toán

Người phụ trách: Nguyễn Thế Dương. Phiên bản bàn giao: 1.0.0.

Module độc lập theo đặc tả phân công đã cung cấp; chưa ghép hoặc chạy trên repository của nhóm. Không cần cài thư viện npm. Không phải một dịch vụ Certificate Transparency hoàn chỉnh.

## Chạy nhanh trên Windows hoặc Linux

Cài Node.js có hỗ trợ `node:test` (khai báo tối thiểu 18; bản bàn giao đã kiểm thử trên 24.22.1). Giải nén, mở Terminal trong thư mục có `package.json`:

```bash
node --test test/merkle-engine.test.js
node examples/demo.js
node examples/benchmark.js
```

Có thể dùng `npm test`, `npm run demo`, `npm run benchmark` tương đương. Không cần `npm install`. Demo và benchmark ghi đè các file JSON kết quả cùng tên trong `results/`.

## Các file

| File | Nội dung |
|---|---|
| `backend/merkle-engine.js` | Chuẩn hóa JSON, dựng cây, thêm log, tạo và kiểm tra proof, đối soát toàn bộ log |
| `test/merkle-engine.test.js` | 20 nhóm kiểm thử; kiểm tra 8.256 vị trí lá của cây từ 1 đến 128 lá |
| `examples/demo.js` | 5 log giả lập; demo sửa/xóa/đổi thứ tự và ranh giới tin cậy của root |
| `examples/benchmark.js` | Đo 100.000 log mặc định; có thể truyền số log làm tham số |
| `results/` | Kết quả đã chạy trong môi trường tạo bản bàn giao |

## Dùng trong backend CommonJS

```js
const { MerkleEngine, verifyInclusion } = require('./backend/merkle-engine');
const logs = [
  { id: 1, actor: 'Duong', action: 'SIGN', resource: 'hop-dong.pdf' },
  { id: 2, actor: 'Duong', action: 'VERIFY', resource: 'hop-dong.pdf' }
];
const tree = new MerkleEngine(logs);
const checkpoint = tree.checkpoint();
// BẮT BUỘC lưu/xác thực checkpoint ở nơi đáng tin cậy bên ngoài dữ liệu được kiểm tra.
const proof = tree.getProof(0);
console.log(verifyInclusion(logs[0], proof, checkpoint)); // true
console.log(verifyInclusion({ ...logs[0], action: 'DELETE' }, proof, checkpoint)); // false
tree.append({ id: 3, action: 'REVOKE' });
```

## Hợp đồng API

- `new MerkleEngine(records = [])`: dựng từ mảng giá trị JSON thuần theo đúng thứ tự.
- `append(record)`: chỉ thêm cuối; trả về chỉ số lá bắt đầu từ 0. Dữ liệu không hợp lệ làm hàm ném lỗi và không thay đổi cây.
- `size`, `getRootHash()`, `checkpoint()`: số bản ghi, root hex viết thường, checkpoint `{version, treeSize, rootHash}`.
- `getRecord(index)`: bản sao bản ghi, không thể thay đổi trạng thái nội bộ.
- `getProof(index)`: `{version, leafIndex, treeSize, auditPath:[{direction,hash}]}`. Hướng nói về nút anh em, thứ tự từ lá lên gốc.
- `verifyProof(rawLeaf, auditPath, rootHashHex)`: API tương thích mẫu đặc tả; chỉ kiểm tra đường băm, không ràng buộc chỉ số/kích thước. Có cả export và instance method.
- `verifyInclusion(rawLeaf, proof, trustedCheckpoint)`: API ưu tiên; kiểm tra thêm phiên bản, chỉ số, kích thước, hướng và độ dài đường đi. Có cả export và instance method.
- `MerkleEngine.verifyLedger(records, trustedCheckpoint)`: đối soát toàn bộ bản ghi đúng kích thước và thứ tự; trả boolean.
- `canonicalize(value)`, `hashLeaf(value)`: các hàm hỗ trợ được export.

## Điều kiện và giới hạn tích hợp

1. Checkpoint không tự được ký trong module này. Nhóm trưởng cần kết nối chức năng ký/xác minh checkpoint hoặc kho root độc lập có kiểm soát. Không lấy root do cùng bên không tin cậy gửi kèm proof làm chuẩn.
2. Cây và bản ghi nằm trong RAM; chưa có database, WAL, phục hồi sau sự cố, API HTTP, hàng đợi epoch hoặc consistency proof giữa hai checkpoint. `append` chỉ đảm bảo thêm cuối trong instance hiện tại.
3. Chuẩn hóa áp dụng cho giá trị JSON thuần trong bộ nhớ. Hàm từ chối NaN, Infinity, BigInt, undefined, Date, getter, symbol, chu trình, mảng thưa và surrogate đơn. Không làm Unicode NFC/NFD. Chuỗi có khoảng trắng vẫn được giữ nguyên.
4. Nếu nhận JSON thô, tầng nhập phải từ chối tên thuộc tính trùng trước khi chuyển thành object. `JSON.parse` không phát hiện được chúng sau khi parse. Số vượt độ chính xác IEEE 754 nên biểu diễn bằng chuỗi từ nguồn; module không thể khôi phục chữ số đã mất. Giới hạn kích thước/độ sâu request ở tầng HTTP.
5. Dữ liệu trả về được sao chép; trường private bảo vệ khỏi chỉnh sửa nhầm. Điều này không chống kẻ kiểm soát tiến trình, hệ điều hành hoặc kho checkpoint.
6. Muốn phát hiện file PDF bị sửa, lưu SHA-256 của nội dung file trong trường `documentHash` của log và tính lại khi kiểm tra. Đổi file mà không đưa băm file vào quy trình kiểm tra sẽ không tự làm Merkle báo lỗi.
7. Không ghi private key, passphrase hoặc nội dung bí mật vào log. Không tuyên bố dữ liệu bất biến tuyệt đối hoặc thời gian kiểm tra cố định trên mọi máy.
8. Gói dùng CommonJS. Dự án có `"type":"module"` cần đổi file sang `.cjs` và điều chỉnh import, hoặc chuyển phần export sang ESM. Chưa kiểm thử tích hợp repository nhóm.

## Kết quả bàn giao

20/20 nhóm kiểm thử PASS. Benchmark thực tế và môi trường nằm trong `results/benchmark-results.json`. Ở cây 100.000 log, proof tại lá 50.000 có 17 hash = 544 byte dữ liệu hash nhị phân; cả JSON proof là 1.710 byte. Các thời gian là một lần đo tại môi trường tạo gói, không phải kết quả trên máy cá nhân của thành viên.

RFC 6962 là cơ sở cây theo yêu cầu phân công, dù đã được RFC 9162 thay thế. Gói chỉ áp dụng cấu trúc hash và inclusion proof của RFC 6962; không tự nhận tương thích toàn bộ giao thức CT. Mã được viết cho bản bàn giao này, không trích mã triển khai trong RFC.

Tài liệu: https://www.rfc-editor.org/rfc/rfc6962 — mục 2.1; https://www.rfc-editor.org/rfc/rfc8785 — mục 3.2.
