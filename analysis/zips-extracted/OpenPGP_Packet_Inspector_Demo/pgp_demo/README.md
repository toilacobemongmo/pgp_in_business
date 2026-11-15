# OpenPGP Packet Inspector Demo

## Chạy nhanh

Cần Node.js; bộ chạy toàn bộ cần thêm GnuPG trong PATH. Môi trường đã thử: Node.js v24.22.1, GnuPG 2.4.7. Không cần npm install.

Mở terminal tại thư mục này:

```bash
node backend/pgp-packet-inspector.js samples/signature.asc
node backend/pgp-packet-inspector.js samples/public.asc
node backend/pgp-packet-inspector.js samples/signature-sha1-mutated.pgp
node backend/pgp-packet-inspector.js samples/truncated.pgp
node backend/pgp-packet-inspector.js samples/bad-crc.asc
```

Mã thoát: 0 = không có error/policy trong kiểm tra đã làm (vẫn có thể có unsupported); 1 = lỗi đọc/cấu trúc ngoài; 2 = lỗi thân hoặc chính sách. coverage luôn partial.

Tạo lại mẫu và chạy cả 33 ca kiểm thử:

```bash
node run-demo.js
```

Lần chạy mới sẽ ghi đè samples và results, tạo khóa mới và timestamp mới. Fingerprint/signature thay đổi là bình thường. Script tạo keyring tạm rồi xóa; khóa riêng chỉ ở trong bộ nhớ tiến trình Node và không được xuất ra gói này. Không tuyên bố xóa triệt để mọi bản sao trong RAM của môi trường JavaScript.

## Các mẫu

- signature.asc, message.txt, rsa-public.pgp: chữ ký RSA/SHA-256 thật và khóa công khai, đã được GnuPG xác minh.
- message-tampered.txt: sửa nội dung, GnuPG từ chối chữ ký cũ.
- public.asc: hai packet ECC legacy đóng gói từ khóa Node tạo; KHÔNG phải chứng thư chuyển giao đầy đủ, thiếu chứng nhận/binding.
- signature-sha1-mutated.pgp: sửa ID băm thành 2 để thử policy; KHÔNG phải chữ ký SHA-1 hợp lệ.
- truncated.pgp: thiếu năm byte cuối.
- bad-crc.asc: CRC sai, dữ liệu nhị phân không đổi.

## Kết quả và giới hạn

results/tests.json chứa kết quả 33 ca. results/gpg-verify.txt và gpg-verify-tampered.txt là kiểm chứng độc lập. results-run.txt lưu log toàn bộ lần chạy ban đầu.

Parser dùng Buffer, không streaming; giới hạn input 16 MiB. Không giải mã, giải nén hoặc xác minh chữ ký bên trong inspector. Chữ ký v6 chưa giải mã. Đọc MPI không kiểm tra mọi tính chuẩn tắc; đọc khóa không kiểm tra tính hợp lệ điểm, mọi KDF hay mọi tổ hợp version/algorithm. Chỉ 3 loại subpacket được giải nghĩa. CRC lỗi giá trị chỉ warning; CRC lỗi cú pháp vẫn bị từ chối, nên chưa đạt đầy đủ quy tắc tiếp nhận Armor RFC 9580. Không dùng như công cụ bảo đảm an toàn trong sản phẩm thực tế.

## Tham khảo

- https://www.rfc-editor.org/rfc/rfc9580.html
- https://www.rfc-editor.org/rfc/rfc4880.html
- https://www.rfc-editor.org/errata/rfc9580
- https://gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html
- https://nodejs.org/api/buffer.html
- https://nodejs.org/api/crypto.html

Mã demo được viết cho báo cáo học tập. Các số liệu thực nghiệm mô tả đúng bộ mẫu đi kèm, không phải đánh giá tuân thủ đầy đủ RFC.
