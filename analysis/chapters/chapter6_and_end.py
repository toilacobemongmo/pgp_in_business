"""
Chương 6: Kết luận, hạn chế và hướng phát triển + Tài liệu tham khảo + Phụ lục
"""
import os
from docx.shared import Pt, Cm
from report_helpers import (
    add_para, add_bullet, add_h1, add_h2, add_h3,
    add_table_caption, add_styled_table, add_figure, add_code_block
)

def build_chapter_6_and_end(doc):
    add_h1(doc, 'CHƯƠNG 6: KẾT LUẬN, HẠN CHẾ VÀ HƯỚNG PHÁT TRIỂN', center=True)

    # 6.1 Tổng kết
    add_h2(doc, '6.1 Tổng kết kết quả nghiên cứu và sản phẩm thực nghiệm')
    add_para(doc,
        'Sau quá trình nghiên cứu lý thuyết chuyên sâu và hiện thực hóa mã nguồn thực nghiệm, đề tài "Nghiên cứu, thiết kế và triển khai hệ thống cấp chứng thư OpenPGP và trao đổi dữ liệu B2B an toàn trong doanh nghiệp" đã đạt được đầy đủ các mục tiêu đề ra ban đầu, mang lại những đóng góp kỹ thuật thực chất:'
    )
    add_bullet(doc, ' Xây dựng mô hình kiến trúc lai kết hợp tính linh hoạt của Web of Trust và cơ chế quản trị tập trung của Corporate CA, hỗ trợ giải quyết bài toán khởi tạo niềm tin ban đầu và kiểm soát thu hồi chứng chỉ trong doanh nghiệp.', bold_prefix='1. Mô hình kiến trúc lai:')
    add_bullet(doc, ' Thiết kế và cài đặt cấu trúc Shamir Envelope v2 trên trường Galois GF(256) với đệm khối 16 byte, mã phiên sessionTag 64-bit và thẻ kiểm tra toàn vẹn SHA-256, giúp hạn chế rủi ro rò rỉ độ dài bí mật và phát hiện việc ghép nhầm mảnh giữa các phiên.', bold_prefix='2. Bảo vệ khóa gốc Root CA bằng Quorum:')
    add_bullet(doc, ' Thiết lập máy trạng thái 4 nấc (Uninitialized, Sealed, Unsealed, Auto-Seal Expiry) theo nguyên tắc fail-closed. Khóa riêng chỉ tồn tại tạm thời trong RAM khi đủ 3-trên-5 mảnh Quorum, tự động niêm phong lại sau thời gian sống TTL quy định.', bold_prefix='3. Cơ chế cổng kiểm soát Quorum Gate:')
    add_bullet(doc, ' Tích hợp lớp Middleware xác thực Bearer token so sánh đẳng thời gian và phân quyền RBAC phân tách 4 vai trò (Admin, Employee, Partner, Public), xử lý 3 vấn đề an ninh đã xác định ban đầu.', bold_prefix='4. Kiểm soát phân quyền và an ninh API:')
    add_bullet(doc, ' Xây dựng bộ kiểm thử tự động bao gồm 291 khẳng định kiểm thử của phân hệ Kỹ sư 2 và kiểm tra độc lập các phân hệ của Kỹ sư 3, 4, 5, đạt tỷ lệ vượt qua 100% các kịch bản kiểm thử đề ra.', bold_prefix='5. Thực nghiệm và kiểm chứng khoa học:')

    # 6.2 Hạn chế kỹ thuật
    add_h2(doc, '6.2 Những hạn chế kỹ thuật thực tế (Honest Limitations)')
    add_para(doc,
        'Nhằm giữ vững tính trung thực và chuẩn mực học thuật, chúng tôi thẳng thắn chỉ ra các giới hạn kỹ thuật nội tại của hệ thống hiện tại cần được hoàn thiện thêm khi đưa vào môi trường sản xuất quy mô lớn:'
    )
    add_bullet(doc, ' Phiên mở khóa Root CA được duy trì thuần túy trong RAM. Nếu tiến trình Node.js bị sự cố (crash hoặc restart), khóa riêng giải mã sẽ lập tức biến mất khỏi bộ nhớ. Hệ thống quay về trạng thái SEALED an toàn (fail-closed), nhưng để tiếp tục ký chứng chỉ, các quản trị viên bắt buộc phải tập hợp lại đủ 3 mảnh Quorum để unseal thủ công.', bold_prefix='1. Khóa tạm trong RAM phụ thuộc vòng đời tiến trình:')
    add_bullet(doc, ' Thẻ kiểm tra toàn vẹn trong Shamir Envelope v2 hiện tại là mã băm SHA-256 không khóa (Keyless Checksum), không phải mã xác thực thông điệp HMAC. Thẻ này có khả năng phát hiện lỗi hư hỏng ngẫu nhiên hoặc ghép sai mảnh vô tình, nhưng chưa chống được kẻ tấn công chủ động có toàn quyền can thiệp vào thuật toán để tính toán lại mã băm.', bold_prefix='2. Checksum Shamir chưa có khóa (Keyless):')
    add_bullet(doc, ' Do giới hạn kiến trúc của thư viện openpgp.js v6.3.2 (không hỗ trợ ký revocation bằng khóa của bên thứ ba), chữ ký thu hồi hiện tại là dạng Tự thu hồi (Self-Revocation do chính cặp khóa nhân viên ký từ trước khi cấp), chứ chưa phải do khóa Root CA trực tiếp ký mộc đè lên.', bold_prefix='3. Giới hạn cơ chế chữ ký thu hồi của OpenPGP v6:')
    add_bullet(doc, ' Các tệp mảnh Quorum lưu trong thư mục backend/data/quorum-shards/ dù được phân quyền 0600 nhưng vẫn ở dạng chuỗi văn bản gốc (plaintext). Nếu kẻ tấn công chiếm được quyền root trên máy chủ, hắn có thể đọc toàn bộ các file để unseal CA. Do đó, quy trình vận hành bắt buộc quản trị viên phải xóa thư mục này ngay sau khi bàn giao.', bold_prefix='4. Mảnh Quorum lưu cục bộ chưa mã hóa khóa công khai từng người:')
    add_bullet(doc, ' Có sự sai lệch giữa mã nguồn thực tế backend/wot-analyzer.js và tài liệu thiết kế lý thuyết của Kỹ sư 4: Đồ án thực tế dùng thuật toán Dijkstra trọng số cố định (0.95/0.8/0.75) và phát hiện điểm nghẽn bằng đếm bậc nút, trong khi tài liệu lý thuyết đề xuất thuật toán luồng tin cậy độc lập (Independent Trust Flow) và thuật toán Tarjan (Bảng 6.1).', bold_prefix='5. Sai lệch thuật toán Web of Trust giữa thực tế và tài liệu:')

    add_table_caption(doc, 'Bảng 6.1: Bảng đối chiếu sai lệch thuật toán WoT giữa thực tế hệ thống và tài liệu Kỹ sư 4')
    wot_headers = ['Tiêu chí kỹ thuật', 'Tài liệu thiết kế Kỹ sư 4', 'Mã nguồn thực tế (backend/wot-analyzer.js)', 'Đánh giá ảnh hưởng']
    wot_data = [
        ['Trọng số cạnh', 'Suy từ loại chữ ký RFC 4880 (0x10 đến 0x13)', 'Gán cứng theo loại quan hệ: 0.95 (internal), 0.8 (partner), 0.75 (other)', 'Cho ra điểm tin cậy khác nhau trên cùng dữ liệu đồ thị.'],
        ['Hàm mục tiêu tìm đường', 'Dung lượng đường truyền có suy giảm gamma: Cap(P) = prod(w) * gamma^(h-1)', 'Tìm đường ngắn nhất theo chi phí âm logarit qua số bước nhảy (hop count)', 'Dijkstra thực tế tối ưu số chặng, tài liệu tối ưu độ tin cậy tích lũy.'],
        ['Đường tin cậy độc lập', 'Thuật toán findIndependentTrustFlow (triệt tiêu cạnh trùng)', 'Không cài đặt hàm tìm đường độc lập', 'Chưa tận dụng được khả năng tổng hợp xác suất đa đường.'],
        ['Phát hiện điểm nghẽn', 'Thuật toán tìm khớp nối Tarjan (Articulation Points) O(V+E)', 'Đếm bậc của nút (Degree Counting: inDegree * outDegree)', 'Đếm bậc chỉ là giải pháp xấp xỉ, có thể bỏ sót điểm SPoF cục bộ.']
    ]
    add_styled_table(doc, wot_headers, wot_data, col_widths=[3.2, 4.8, 5.0, 5.0])

    # 6.3 Hướng phát triển
    add_h2(doc, '6.3 Hướng phát triển đề tài trong tương lai')
    add_para(doc, 'Để đưa hệ thống lên mức độ hoàn thiện phục vụ môi trường doanh nghiệp thực tế, các định hướng phát triển tiếp theo bao gồm:')
    add_bullet(doc, 'Nâng cấp thẻ kiểm tra toàn vẹn Shamir Envelope sang chuẩn HMAC-SHA256 với khóa bí mật dẫn xuất bằng thuật toán Argon2id hoặc PBKDF2 từ chính dữ liệu bí mật.')
    add_bullet(doc, 'Mã hóa từng mảnh khóa Quorum bằng khóa công khai PGP của từng quản trị viên an ninh trước khi lưu trữ hoặc truyền phát.')
    add_bullet(doc, 'Tích hợp phần cứng bảo mật: Hỗ trợ thẻ thông minh Smart Card (YubiKey / Nitrokey) qua chuẩn PKCS#11 để lưu trữ khóa riêng của nhân viên và mảnh Quorum của quản trị viên.')
    add_bullet(doc, 'Đồng bộ hóa thuật toán Web of Trust sang thuật toán luồng cực đại (Max-Flow Min-Cut) kết hợp thuật toán Tarjan chính xác.')
    add_bullet(doc, 'Tự động hóa ký số Merkle Root Checkpoint bằng khóa Root CA và công bố định kỳ lên mạng lưu trữ phân tán IPFS hoặc sổ cái Blockchain công khai.')

    # ── TÀI LIỆU THAM KHẢO ────────────────────────────────────────────────────
    add_h1(doc, 'TÀI LIỆU THAM KHẢO', center=True, page_break=True)
    add_para(doc, 'Danh mục tài liệu tham khảo được trích dẫn theo định dạng chuẩn IEEE, đảm bảo tính xác thực và khả năng tra cứu nguồn gốc:')
    
    refs = [
        '[1] J. Callas, L. Donnerhacke, H. Finney, D. Shaw, and R. Thayer, "OpenPGP Message Format," IETF RFC 4880, Nov. 2007. [Online]. Available: https://tools.ietf.org/html/rfc4880',
        '[2] B. Laurie, A. Langley, and E. Kasper, "Certificate Transparency," IETF RFC 6962, Jun. 2013. [Online]. Available: https://tools.ietf.org/html/rfc6962',
        '[3] A. Shamir, "How to share a secret," Communications of the ACM, vol. 22, no. 11, pp. 612-613, Nov. 1979. doi: 10.1145/359168.359176',
        '[4] D. J. Bernstein, "Curve25519: new Diffie-Hellman speed records," in Public Key Cryptography - PKC 2006, Lecture Notes in Computer Science, vol. 3958, Springer, Berlin, Heidelberg, pp. 207-228, 2006.',
        '[5] D. J. Bernstein, N. Duif, T. Lange, P. Schwabe, and B.-Y. Yang, "High-speed high-security signatures," Journal of Cryptographic Engineering, vol. 2, no. 2, pp. 77-89, 2012.',
        '[6] S. Josefsson and I. Liusvaara, "Edwards-Curve Digital Signature Algorithm (EdDSA)," IETF RFC 8032, Jan. 2017.',
        '[7] P. Zimmermann, "The Official PGP User\'s Guide," MIT Press, Cambridge, MA, USA, 1995.',
        '[8] OpenPGP.js Development Team, "OpenPGP.js: OpenPGP implementation for JavaScript," Version 6.3.2 Documentation, 2024. [Online]. Available: https://openpgpjs.org/',
        '[9] R. C. Merkle, "A Certified Digital Signature," in Advances in Cryptology: CRYPTO \'89 Proceedings, Lecture Notes in Computer Science, vol. 435, Springer, New York, NY, pp. 218-238, 1989.',
        '[10] E. W. Dijkstra, "A note on two problems in connexion with graphs," Numerische Mathematik, vol. 1, no. 1, pp. 269-271, Dec. 1959.',
        '[11] R. Tarjan, "Depth-First Search and Linear Graph Algorithms," SIAM Journal on Computing, vol. 1, no. 2, pp. 146-160, 1972.',
        '[12] Express.js Foundation, "Express: Fast, unopinionated, minimalist web framework for Node.js," Version 5.x Documentation, 2024. [Online]. Available: https://expressjs.com/',
        '[13] React Core Team, "React 19 Documentation: Actions, Server Components and Optimizations," Meta Platforms, 2024. [Online]. Available: https://react.dev/'
    ]
    for ref in refs:
        p_ref = doc.add_paragraph()
        p_ref.paragraph_format.line_spacing = 1.25
        p_ref.paragraph_format.space_before = Pt(2)
        p_ref.paragraph_format.space_after = Pt(4)
        p_ref.paragraph_format.left_indent = Cm(0.75)
        p_ref.paragraph_format.first_line_indent = Cm(-0.75)
        r = p_ref.add_run(ref)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(11)

    # ── PHỤ LỤC ───────────────────────────────────────────────────────────────
    add_h1(doc, 'PHỤ LỤC: HƯỚNG DẪN CÀI ĐẶT VÀ VẬN HÀNH HỆ THỐNG', center=True, page_break=True)
    
    add_h2(doc, 'A. Yêu cầu môi trường vận hành')
    add_bullet(doc, 'Hệ điều hành: Linux (Ubuntu 22.04+ / Debian 12+), macOS 13+, hoặc Microsoft Windows 10/11.')
    add_bullet(doc, 'Môi trường thực thi: Node.js phiên bản tối thiểu v18.x (khuyến nghị v20.x LTS) và NPM v9+.')
    add_bullet(doc, 'Cổng mạng (Ports): Cổng 5000 (Backend API Express) và Cổng 5173 (Frontend Vite Dev Server).')

    add_h2(doc, 'B. Các bước triển khai và khởi chạy')
    add_para(doc, '1. Cài đặt các gói phụ thuộc (Dependencies) cho cả Backend và Frontend:')
    add_code_block(doc,
        '# Cài đặt thư viện máy chủ backend và frontend từ thư mục gốc\n'
        'npm install\n'
        'npm install --prefix frontend',
        caption='Lệnh B.1: Cài đặt các gói phụ thuộc hệ thống'
    )

    add_para(doc, '2. Cấu hình biến môi trường an ninh (tệp tin .env trong thư mục gốc):')
    add_code_block(doc,
        '# Cấu hình Token phân quyền RBAC (tối thiểu 16 ký tự)\n'
        'AUTH_TOKEN_ADMIN=super_secret_admin_token_2026_x9z\n'
        'AUTH_TOKEN_EMPLOYEE=employee_portal_token_2026_abc\n'
        'AUTH_TOKEN_PARTNER=b2b_partner_gateway_token_2026_xyz\n'
        '\n'
        '# Thời gian sống của phiên Root CA đã unseal (300.000 ms = 5 phút)\n'
        'CA_UNSEAL_TTL_MS=300000\n'
        '\n'
        '# Cổng lưu khóa riêng demo (Mặc định: TẮT)\n'
        'DEMO_PLAINTEXT_KEYS=false\n'
        'PORT=5000',
        caption='Cấu hình B.1: Tệp tin mẫu biến môi trường bảo mật .env'
    )

    add_para(doc, '3. Khởi chạy đồng thời Backend và Frontend:')
    add_code_block(doc,
        '# Khởi chạy song song cả 2 dịch vụ bằng một lệnh duy nhất\n'
        'npm run dev\n'
        '\n'
        '# Truy cập hệ thống trên trình duyệt Web:\n'
        '# Giao diện người dùng: http://localhost:5173\n'
        '# Máy chủ API Backend : http://localhost:5000',
        caption='Lệnh B.2: Khởi động hệ thống'
    )

    add_h2(doc, 'C. Hướng dẫn chạy bộ kiểm thử tự động toàn diện')
    add_para(doc, 'Để thẩm tra lại toàn bộ 291 khẳng định kiểm thử của Kỹ sư 2, thực thi các lệnh độc lập sau từ thư mục gốc:')
    add_code_block(doc,
        '# 1. Kiểm thử thuật toán Shamir Envelope v2 và Máy trạng thái CA (46 ca test)\n'
        'node tests/engineer2-quorum-ca.test.mjs\n'
        '\n'
        '# 2. Kiểm thử luồng tích hợp HTTP Smoke End-to-End (21 ca test)\n'
        'node tests/engineer2-api-smoke.mjs\n'
        '\n'
        '# 3. Kiểm thử xác thực Token và phân quyền RBAC toàn diện (107 ca test)\n'
        'node tests/engineer2-api-auth.test.mjs\n'
        '\n'
        '# 4. Kiểm thử lưu trữ mảnh Quorum thành file POSIX 0600 (47 ca test)\n'
        'node tests/engineer2-quorum-shards.test.mjs\n'
        '\n'
        '# 5. Kiểm thử cổng bảo vệ khóa riêng demo (48 ca test)\n'
        'node tests/engineer2-demo-key-gate.test.mjs\n'
        '\n'
        '# 6. Kiểm thử đếm ngược thời gian TTL tự động niêm phong thực tế (22 ca test)\n'
        'node tests/engineer2-ttl-expiry.test.mjs',
        caption='Lệnh C.1: Quy trình chạy bộ kiểm thử tự động'
    )

    print("Chapter 6, References, and Appendix generated successfully.")
