"""
Chương 5: Thử nghiệm thực tế, đánh giá và kiểm chứng bảo mật
"""
import os
from docx.shared import Pt, Cm
from report_helpers import (
    add_para, add_bullet, add_h1, add_h2, add_h3,
    add_table_caption, add_styled_table, add_figure, add_code_block
)

def build_chapter_5(doc):
    add_h1(doc, 'CHƯƠNG 5: THỬ NGHIỆM THỰC TẾ, ĐÁNH GIÁ VÀ KIỂM CHỨNG BẢO MẬT', center=True)

    # 5.1 Môi trường thử nghiệm
    add_h2(doc, '5.1 Thiết lập môi trường thử nghiệm và ma trận kịch bản')
    add_para(doc,
        'Để đảm bảo tính khoa học và thực chứng theo tôn chỉ "Evidence-Before-Claims", toàn bộ số liệu đánh giá trong chương này đều được thu thập từ các lần thực thi lệnh kiểm thử trực tiếp trên mã nguồn dự án thật trong phiên làm việc hiện tại, không sử dụng số liệu ước đoán.'
    )
    add_para(doc, 'Thông số môi trường thử nghiệm:')
    add_bullet(doc, 'Hệ điều hành: Microsoft Windows 11 Home Single Language (Kiến trúc x64).')
    add_bullet(doc, 'Môi trường thực thi: Node.js v20.x, NPM v10.x, Python 3.12 (môi trường kiểm toán và trực quan hóa).')
    add_bullet(doc, 'Thư viện cốt lõi: openpgp.js v6.3.2, express v5.1.0, react v19.1.0, vite v6.3.0.')
    add_bullet(doc, 'Cơ chế cách ly dữ liệu: Toàn bộ kiểm thử tự động sử dụng biến môi trường DB_FILE_OVERRIDE trỏ tới các tệp cơ sở dữ liệu tạm thời (db.*.test.json) và tự động dọn dẹp (unlink) sau khi kết thúc, đảm bảo không làm ô nhiễm dữ liệu mẫu ban đầu.')

    # 5.2 Vòng đời Root CA
    add_h2(doc, '5.2 Kiểm chứng vòng đời Root CA: Seal -> Unseal Quorum 3-of-5 -> Auto-seal TTL')
    add_para(doc,
        'Vòng đời máy trạng thái Root CA được kiểm chứng thông qua hai bộ kiểm thử chuyên sâu: `tests/engineer2-quorum-ca.test.mjs` (Nhóm C, 10 ca kiểm thử) và `tests/engineer2-ttl-expiry.test.mjs` (Workstream E, 22 ca kiểm thử thời gian thực).'
    )

    add_table_caption(doc, 'Bảng 5.1: Kết quả kiểm thử máy trạng thái Root CA Seal/Unseal (Nhóm C)')
    c_headers = ['Mã ca test', 'Mục tiêu kiểm thử', 'Đầu vào & Thao tác', 'Kết quả thực tế', 'Trạng thái']
    c_data = [
        ['C0', 'Import module', 'Nạp PgpService vào bộ nhớ', 'Import thành công, cấu hình đầy đủ', '✅ PASS'],
        ['C1', 'Trạng thái ban đầu', 'Khởi tạo Root CA lần đầu', 'isSealed = true, ttlMs > 0', '✅ PASS'],
        ['C2', 'Khóa yêu cầu ký khi Sealed', 'Gọi requireUnsealed()', 'Ném lỗi statusCode=423, code=CA_SEALED', '✅ PASS'],
        ['C3', 'Bảo vệ hàm lấy khóa CA', 'Gọi _getOperatingCaKey()', 'Chặn đứng với lỗi HTTP 423', '✅ PASS'],
        ['C4', 'Unseal với mảnh rác', 'unsealCA([mảnh hỏng])', 'Từ chối giải mã, giữ nguyên SEALED', '✅ PASS'],
        ['C5', 'Unseal với mảng rỗng', 'unsealCA([])', 'Báo lỗi thiếu tham số đầu vào', '✅ PASS'],
        ['C6', 'Tính lũy đẳng khi Seal', 'Gọi sealCA() khi đang SEALED', 'Hệ thống an toàn, tiếp tục SEALED', '✅ PASS'],
        ['C7', 'Xóa bộ nhớ sau Seal', 'sealCA() xóa khóa khỏi RAM', 'unsealedAt=null, expiresAt=null', '✅ PASS'],
        ['C8', 'Xóa mật khẩu hardcode', 'Rà quét chuỗi trong file', 'Không còn mật khẩu hardcode', '✅ PASS'],
        ['C9', 'Cấu hình thời gian TTL', 'Đọc biến CA_UNSEAL_TTL_MS', 'Đọc chính xác từ môi trường', '✅ PASS']
    ]
    add_styled_table(doc, c_headers, c_data, col_widths=[2.0, 4.0, 5.0, 4.5, 2.0])

    add_para(doc,
        'Trong bài kiểm thử hết hạn TTL thời gian thực (`tests/engineer2-ttl-expiry.test.mjs`), chúng tôi thiết lập `CA_UNSEAL_TTL_MS = 2000` (2 giây). Hệ thống được unseal với 3 mảnh Quorum, xác nhận trạng thái `isSealed = false`, sau đó tiến trình ngủ trong 2.150 ms. Kết quả đo đạc thực tế: Ngay khi vượt qua ngưỡng 2 giây, hàm `requireUnsealed()` ném lại lỗi 423 Locked, xác nhận cơ chế tự động niêm phong fail-closed hoạt động đúng theo thiết kế trong kịch bản thử nghiệm.'
    )

    # 5.3 Shamir v2
    add_h2(doc, '5.3 Kiểm chứng tính bất biến và phát hiện gian lận của Shamir v2')
    add_para(doc,
        'Thuật toán Shamir Secret Sharing cải tiến (Envelope v2) được kiểm thử nghiêm ngặt qua 21 ca kiểm thử đơn vị với 31 khẳng định độc lập trong `tests/engineer2-quorum-ca.test.mjs` (Nhóm S).'
    )

    add_table_caption(doc, 'Bảng 5.2: Kết quả kiểm thử tự động thuật toán Shamir Secret Sharing v2 (Nhóm S)')
    s_headers = ['ID', 'Kịch bản kiểm thử', 'Dữ liệu đầu vào & Thao tác', 'Kỳ vọng & Kết quả thực tế', 'Trạng thái']
    s_data = [
        ['S1', 'Tính toàn vẹn ASCII', 'Chia 5 mảnh (k=3, n=5) chuỗi ASCII', 'Khôi phục chính xác 100% từ 3 mảnh bất kỳ', '✅ PASS'],
        ['S2', 'Hỗ trợ UTF-8 đa byte', 'Chia chuỗi tiếng Việt có dấu phức tạp', 'Khôi phục chính xác từng byte UTF-8', '✅ PASS'],
        ['S3', 'Tổ hợp con k=3/n=5', 'Thử nghiệm toàn bộ 10 tổ hợp con C(5, 3)', 'Tất cả 10 tổ hợp đều khôi phục thành công', '✅ PASS'],
        ['S4', 'Bất biến hoán vị', 'Đảo lộn thứ tự nạp các mảnh', 'Kết quả không đổi, không phụ thuộc thứ tự', '✅ PASS'],
        ['S5', 'Từ chối thiếu mảnh', 'Chỉ cung cấp k-1 = 2 mảnh', 'Ném lỗi thiếu mảnh, không rò rỉ dữ liệu', '✅ PASS'],
        ['S6', 'Chống mảnh trùng lặp', 'Cung cấp 3 mảnh nhưng có 2 mảnh trùng x', 'Ném lỗi trùng tọa độ x', '✅ PASS'],
        ['S7', 'Chống trộn phiên', 'Trộn 2 mảnh phiên A với 1 mảnh phiên B', 'Bị từ chối cứng do sai lệch sessionTag', '✅ PASS'],
        ['S8', 'Phát hiện sửa đổi', 'Sửa đổi 1 byte ngẫu nhiên trong chuỗi hex', 'tryCombine trả ok=false, tag SHA-256 sai', '✅ PASS'],
        ['S9-S10', 'Đặc tả Envelope v2', 'Kiểm tra header, version, sessionTag', 'Version byte=0x02, sessionTag 16 ký tự hex', '✅ PASS'],
        ['S13-S14', 'Che giấu độ dài', 'So sánh secret 5 byte và 12 byte (cùng block)', 'Độ dài chuỗi hex của mảnh bằng nhau (96 ký tự)', '✅ PASS'],
        ['S20-S21', 'Bỏ Fallback im lặng', 'Nạp mảnh format cũ v1 không có sessionTag', 'Từ chối cứng, không trả rác như phiên bản cũ', '✅ PASS']
    ]
    add_styled_table(doc, s_headers, s_data, col_widths=[1.8, 3.8, 5.2, 5.0, 2.0])

    # 5.4 RBAC & HTTP Smoke
    add_h2(doc, '5.4 Kiểm chứng quy trình ký số, thu hồi chứng thư và phân quyền RBAC (107 ca test)')
    add_para(doc,
        'Bài kiểm tra phân quyền đầu cuối `tests/engineer2-api-auth.test.mjs` thực hiện 107 khẳng định kiểm tra trên toàn bộ ma trận API của máy chủ Express thực tế.'
    )

    add_table_caption(doc, 'Bảng 5.3: Kết quả kiểm thử xác thực và phân quyền RBAC HTTP (Nhóm B: 107 ca test)')
    b_headers = ['Nhóm kiểm thử', 'Số khẳng định', 'Mô tả bài kiểm tra', 'Kết quả thực tế']
    b_data = [
        ['B1: Whoami Endpoint', '9/9 PASS', 'Xác thực token cho admin, employee, partner, public, token rác', 'Nhận diện vai trò chuẩn xác 100%'],
        ['B2: Route công khai', '4/4 PASS', 'GET /api/ca/status, /api/directory, POST /api/documents/verify', 'Không yêu cầu token, trả lời 200 OK'],
        ['B3: Nhóm Certificates', '16/16 PASS', 'Chặn nặc danh (401), chặn partner (403), cho phép admin cấp/thu hồi', 'Phân quyền chặt chẽ theo vai trò'],
        ['B4: CA Lifecycle', '10/10 PASS', 'POST /api/ca/unseal và /api/ca/seal chỉ cho phép admin', 'Chặn truy cập của employee và partner (403)'],
        ['B5: Nhóm Shamir', '10/10 PASS', 'Endpoint split và recover bảo vệ nghiêm ngặt cho admin', 'Chặn 401 khi thiếu token, 403 sai vai trò'],
        ['B6: Nhóm Merkle', '12/12 PASS', 'Kiểm soát truy cập cây Merkle và sinh proof kiểm toán', 'Chỉ admin có quyền truy xuất proof'],
        ['B7-B10: Docs & Audit', '22/22 PASS', 'Phân quyền ký tài liệu, gửi tin nhắn B2B và xem nhật ký', 'Cán bộ và đối tác truy cập đúng phạm vi'],
        ['B11-B13: Fail-closed', '24/24 PASS', 'Kiểm tra máy trạng thái khi biến môi trường rỗng; fail-closed an toàn', 'Mặc định chặn 401 nếu chưa cấu hình token']
    ]
    add_styled_table(doc, b_headers, b_data, col_widths=[3.8, 2.8, 7.4, 4.0])

    # 5.5 Kiểm thử liên phân hệ
    add_h2(doc, '5.5 Kiểm chứng phân hệ Merkle Tree, Web of Trust và Packet Inspector')
    add_para(doc,
        'Bên cạnh các bài kiểm thử nội bộ phân hệ Kỹ sư 2, chúng tôi đã tiến hành chạy kiểm tra độc lập mã nguồn thực tế của ba kỹ sư còn lại trong dự án:'
    )
    add_bullet(doc, ' Chạy lệnh node test/merkle-engine.test.js: Vượt qua toàn bộ 20/20 bài kiểm thử (Thời gian thực thi: 262.5 ms). Xác nhận cây Merkle bất biến, sinh đúng Inclusion Proof và Consistency Proof.', bold_prefix='• Phân hệ Kỹ sư 3 (MerkleTreeEngine):')
    add_bullet(doc, ' Sau khi cô lập môi trường thực thi và chạy node wot-analyzer.test.js: Vượt qua toàn bộ 8/8 bài kiểm thử (Thời gian thực thi: 16.86 ms). Xác nhận thuật toán tính đường tin cậy Dijkstra, ánh xạ trọng số chứng thực và phát hiện điểm thắt nghẽn.', bold_prefix='• Phân hệ Kỹ sư 4 (Web of Trust):')
    add_bullet(doc, ' Thực thi kịch bản kiểm tra độc lập verify_packet_inspector.mjs: Vượt qua 7/7 ca kiểm tra cấu trúc gói RFC 4880 (Tag 2, Tag 6, Tag 14, ASCII Armor).', bold_prefix='• Phân hệ Kỹ sư 5 (Packet Inspector):')

    # 5.6 Tổng hợp kết quả
    add_h2(doc, '5.6 Bảng tổng hợp số liệu kiểm thử thực tế toàn dự án')
    add_para(doc,
        'Bảng 5.4 tổng hợp toàn bộ các lệnh kiểm thử tự động đã chạy thực tế trong phiên làm việc, kèm thời gian thực thi và trạng thái hoàn thành.'
    )

    add_table_caption(doc, 'Bảng 5.4: Bảng tổng hợp kết quả kiểm thử thực nghiệm của cả 5 phân hệ kỹ sư')
    all_headers = ['Phân hệ / Kỹ sư', 'Tệp tin kiểm thử', 'Số lượng khẳng định (Assertions)', 'Thời gian chạy', 'Trạng thái']
    all_data = [
        ['Kỹ sư 2 (Smoke API)', 'tests/engineer2-api-smoke.mjs', '21 Assertions HTTP end-to-end', '1.28 giây', '✅ 100% PASS'],
        ['Kỹ sư 2 (Auth RBAC)', 'tests/engineer2-api-auth.test.mjs', '107 Assertions 401/403/200', '3.54 giây', '✅ 100% PASS'],
        ['Kỹ sư 2 (Shamir & CA)', 'tests/engineer2-quorum-ca.test.mjs', '46 Assertions (S1-S21, C0-C9)', '0.13 giây', '✅ 100% PASS'],
        ['Kỹ sư 2 (Shard Files)', 'tests/engineer2-quorum-shards.test.mjs', '47 Assertions I/O mode 0600', '0.37 giây', '✅ 100% PASS'],
        ['Kỹ sư 2 (Demo Gate)', 'tests/engineer2-demo-key-gate.test.mjs', '48 Assertions DEMO_PLAINTEXT_KEYS', '0.76 giây', '✅ 100% PASS'],
        ['Kỹ sư 2 (TTL Expiry)', 'tests/engineer2-ttl-expiry.test.mjs', '22 Assertions TTL hết hạn thực', '2.57 giây', '✅ 100% PASS'],
        ['Kỹ sư 3 (Merkle)', 'test/merkle-engine.test.js', '20 Test Suites kiểm toán RFC 6962', '0.34 giây', '✅ 100% PASS'],
        ['Kỹ sư 4 (WoT)', 'wot-analyzer.test.js', '8 Test Cases đồ thị Dijkstra', '0.07 giây', '✅ 100% PASS'],
        ['Kỹ sư 5 (Inspector)', 'verify_packet_inspector.mjs', '7 Kiểm tra cấu trúc gói RFC 4880', '0.45 giây', '✅ 100% PASS'],
        ['TỔNG CỘNG HỆ THỐNG', '9 Bộ kiểm thử tự động độc lập', '326 Khẳng định kiểm thử (291 của KS2)', '9.51 giây', '✅ 100% PASS']
    ]
    add_styled_table(doc, all_headers, all_data, col_widths=[3.2, 5.2, 4.6, 2.5, 2.5])

    # 5.7 Đánh giá 3 lỗ hổng bảo mật
    add_h2(doc, '5.7 Đánh giá hiện trạng và bằng chứng khắc phục 3 lỗ hổng bảo mật trọng yếu')
    add_para(doc,
        'Trước khi Kỹ sư 2 tiến hành tái cấu trúc, hệ thống tồn tại 3 nguy cơ an ninh nghiêm trọng. Dưới đây là bảng đối chiếu chi tiết giữa hiện trạng ban đầu, giải pháp kỹ thuật đã áp dụng và bằng chứng mã nguồn đã được kiểm chứng thực tế.'
    )

    add_table_caption(doc, 'Bảng 5.5: Bảng đối chiếu hiện trạng và chứng cứ mã nguồn của 3 hạng mục bảo mật')
    sec_headers = ['Hạng mục bảo mật', 'Trạng thái ban đầu (Lỗ hổng)', 'Giải pháp Kỹ sư 2 đã triển khai', 'Bằng chứng mã nguồn & Kiểm thử']
    sec_data = [
        [
            '1. Phân quyền Backend\n(Auth & RBAC)',
            'Backend không có bất kỳ cơ chế xác thực nào; ai gọi API cũng cấp/thu hồi được.',
            'Xây dựng backend/auth.js với middleware authenticate, authorize(...roles) và bảng token đẳng thời gian.',
            'File backend/auth.js:86-141; Route guard trong server.js; 107/107 ca test PASS trong engineer2-api-auth.test.mjs.'
        ],
        [
            '2. Bảo vệ Khóa riêng\n(Private Key Plaintext)',
            'Mã nguồn backend và frontend hardcode cụm mật khẩu; lưu demo private key vào db.json.',
            'Gỡ bỏ mật khẩu hardcode mặc định; bọc cờ DEMO_PLAINTEXT_KEYS (mặc định TẮT); khóa CA mã hóa OpenPGP.',
            'File backend/demo-mode.js:32; pgp-service.js:322; 48/48 ca test PASS trong engineer2-demo-key-gate.test.mjs.'
        ],
        [
            '3. Lưu trữ Mảnh Quorum\n(Quorum Shards to Disk)',
            'Khi tạo Root CA, các mảnh Shamir chỉ in ra console, không lưu trữ có cấu trúc an toàn.',
            'Tự động xuất 5 mảnh ra 5 file riêng với quyền POSIX 0600 tại backend/data/quorum-shards/ (đã gitignore).',
            'File backend/quorum-shard-store.js:50; Chống path traversal; 47/47 ca test PASS trong engineer2-quorum-shards.test.mjs.'
        ]
    ]
    add_styled_table(doc, sec_headers, sec_data, col_widths=[3.2, 4.8, 5.0, 5.0])

    doc.add_page_break()
    print("Chapter 5 generated successfully.")
