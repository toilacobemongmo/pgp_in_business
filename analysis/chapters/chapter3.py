"""
Chương 3: Thiết kế kiến trúc hệ thống
"""
import os
from docx.shared import Pt, Cm
from report_helpers import (
    add_para, add_bullet, add_h1, add_h2, add_h3,
    add_table_caption, add_styled_table, add_figure, add_code_block
)

def build_chapter_3(doc):
    add_h1(doc, 'CHƯƠNG 3: THIẾT KẾ KIẾN TRÚC HỆ THỐNG', center=True)

    # 3.1 Yêu cầu bài toán & kiến trúc phân lớp
    add_h2(doc, '3.1 Yêu cầu bài toán và thiết kế kiến trúc phân lớp tổng thể')
    add_para(doc,
        'Hệ thống "Enterprise OpenPGP Certificate Authority & B2B Secure Exchange" được thiết kế nhằm đáp ứng các yêu cầu nghiệp vụ khắt khe của môi trường vận hành thực tế. Kiến trúc hệ thống tuân thủ mô hình 5 phân lớp chuyên biệt (Separation of Concerns), đảm bảo tính module hóa cao, dễ dàng mở rộng và phân tách rõ ràng ranh giới an ninh:'
    )
    add_bullet(doc, ' Xây dựng trên nền tảng React 19 kết hợp công cụ đóng gói Vite và bộ thư viện giao diện Tailwind CSS + Lucide Icons. Cung cấp 4 góc nhìn giao diện người dùng (Role Switcher): Quản trị viên An ninh CA, Cán bộ Nhân viên nội bộ, Doanh nghiệp Đối tác ngoài (B2B Gateway) và Cổng Thẩm tra viên Công khai (Public Verifier).', bold_prefix='1. Phân lớp Trình diễn (Presentation Layer - Frontend):')
    add_bullet(doc, ' Máy chủ Express 5 (Node.js) định tuyến các RESTful API. Tích hợp lớp Middleware xác thực danh tính qua Bearer Token và bộ lọc kiểm soát truy cập dựa trên vai trò (RBAC Guard) trước khi chuyển tiếp yêu cầu vào lõi nghiệp vụ.', bold_prefix='2. Phân lớp Cổng điều phối & Phân quyền (API Gateway & RBAC Layer):')
    add_bullet(doc, ' Đóng gói thư viện openpgp.js v6.3.2. Chịu trách nhiệm thực thi các phép toán mật mã học nặng: Sinh cặp khóa Ed25519/Curve25519, ký mộc CA chứng thực danh tính (Tag 2 Type 0x13), ký số tài liệu (Detached Signature), mã hóa lai B2B (Hybrid Sign-then-Encrypt) và bóc tách gói tin nhị phân.', bold_prefix='3. Phân lớp Lõi Mật mã học (Core Cryptographic Engine):')
    add_bullet(doc, ' Động cơ phân chia và phục hồi bí mật Shamir trên trường Galois GF(256) với cấu trúc Envelope v2. Máy trạng thái quản trị vòng đời Root CA (Sealed/Unsealed), bộ đếm ngược thời gian tự động niêm phong (Auto-Seal TTL) và bộ quản lý lưu trữ mảnh khóa Quorum cục bộ.', bold_prefix='4. Phân lớp Quản trị Trạng thái & Niêm phong Khóa (State & Quorum Vault Layer):')
    add_bullet(doc, ' Cơ sở dữ liệu JSON bất biến lưu trữ danh bạ chứng chỉ, kết hợp với Động cơ cây Merkle (RFC 6962) ghi log kiểm toán không thể sửa đổi (Append-only Audit Log) và bộ phân tích đồ thị tin cậy WoT.', bold_prefix='5. Phân lớp Lưu trữ & Sổ cái Kiểm toán (Persistence & Merkle Ledger Layer):')

    # 3.2 Phân công 5 kỹ sư & Hợp đồng giao diện
    add_h2(doc, '3.2 Ma trận phân công trách nhiệm 5 kỹ sư và hợp đồng giao diện')
    add_para(doc,
        'Để đảm bảo tính độc lập và phối hợp nhịp nhàng trong toàn bộ dự án, ma trận phân công trách nhiệm được thiết lập chặt chẽ giữa 5 kỹ sư. Bảng 3.1 mô tả chi tiết ranh giới kỹ thuật và hợp đồng chuyển giao dữ liệu giữa các phân hệ.'
    )

    add_table_caption(doc, 'Bảng 3.1: Ma trận phân công trách nhiệm và ranh giới kỹ thuật 5 kỹ sư đồ án')
    matrix_headers = ['Kỹ sư', 'Phân hệ phụ trách', 'Trách nhiệm chính', 'Đầu ra chuyển giao cho nhóm']
    matrix_data = [
        ['Kỹ sư 1', 'Packet Inspector', 'Bóc tách gói tin nhị phân RFC 4880, phân tích cú pháp tiêu đề gói (Old/New format), trích xuất chữ ký và kiểm tra CRC24.', 'Bộ phân tích cấu trúc nhị phân và tài liệu đặc tả packet cho Kỹ sư 2, 5.'],
        ['Kỹ sư 2', 'Root CA & Quorum Escrow', 'Bảo vệ Root CA bằng Quorum Shamir GF(256) Envelope v2; Máy trạng thái Seal/Unseal (HTTP 423); Cấp và thu hồi chứng chỉ; Bảo vệ API RBAC.', 'Khóa công khai CA (Trust Anchor) cho Kỹ sư 4; Chứng chỉ chứng thực cho Kỹ sư 5; Log kiểm toán cho Kỹ sư 3.'],
        ['Kỹ sư 3', 'Merkle Audit Engine', 'Xây dựng cây băm Merkle RFC 6962; Quản lý sổ cái Append-only; Tạo Merkle Root Checkpoint; Sinh bằng chứng kiểm toán (Audit Proof / Inclusion Proof).', 'Hàm store.logAudit() cho Kỹ sư 2 ghi log; API /api/merkle/verify kiểm tra tính toàn vẹn.'],
        ['Kỹ sư 4', 'Web of Trust Analyzer', 'Mô hình hóa mạng lưới tín nhiệm thành đồ thị có hướng có trọng số; Cài đặt thuật toán Dijkstra tìm đường tin cậy ngắn nhất; Phát hiện điểm nghẽn (Bottlenecks).', 'API /api/wot/graph và /api/wot/path hỗ trợ đối tác B2B tra cứu độ tin cậy cán bộ công ty.'],
        ['Kỹ sư 5', 'B2B Messaging & Signing', 'Hiện thực luồng trao đổi thông điệp E2E (Sign-then-Encrypt); Giao diện ký số tài liệu văn phòng và thẩm định chữ ký công khai một chạm.', 'Giao diện nghiệp vụ ký số và hòm thư B2B cho người dùng cuối và đối tác.']
    ]
    add_styled_table(doc, matrix_headers, matrix_data, col_widths=[2.0, 3.8, 5.2, 5.0])

    add_para(doc, 'Hợp đồng giao diện (Interface Contracts) của Kỹ sư 2 với các thành viên khác:')
    add_bullet(doc, ' Cung cấp caConfig.fingerprint làm điểm xuất phát neo tin cậy (source / trust anchor) cho thuật toán tìm đường của Kỹ sư 4.', bold_prefix='• Giao tiếp với Kỹ sư 4 (WoT):')
    add_bullet(doc, ' Cung cấp chuỗi khóa công khai đã ký mộc CA (certifiedPublicKeyArmored) để Kỹ sư 5 thực hiện mã hóa thông điệp B2B gửi vào doanh nghiệp.', bold_prefix='• Giao tiếp với Kỹ sư 5 (B2B Messaging):')
    add_bullet(doc, ' Mọi thao tác cấp chứng chỉ, thu hồi chứng chỉ, unseal CA đều gọi hàm store.logAudit() của Kỹ sư 3 để tự động cập nhật lá mới vào cây Merkle.', bold_prefix='• Giao tiếp với Kỹ sư 3 (Merkle Engine):')

    # 3.3 Máy trạng thái Root CA & Quorum Gate
    add_h2(doc, '3.3 Thiết kế máy trạng thái Root CA Seal/Unseal và Quorum Gate (Kỹ sư 2)')
    add_para(doc,
        'Khóa riêng của Corporate Root CA là thành phần an ninh then chốt. Nếu khóa riêng luôn được giữ ở trạng thái giải mã sẵn trong bộ nhớ hoặc trên đĩa, các lỗ hổng tại tầng ứng dụng có thể dẫn đến nguy cơ lộ khóa. Để hạn chế rủi ro này, phân hệ Kỹ sư 2 thiết kế Máy trạng thái Root CA (Root CA State Machine) theo nguyên tắc Niêm phong mặc định (Fail-closed / Default-sealed):'
    )

    add_code_block(doc,
        '              ┌─────────────────────────┐\n'
        '              │      UNINITIALIZED      │\n'
        '              └────────────┬────────────┘\n'
        '                           │ initCA() + Shamir split(3, 5)\n'
        '                           ▼\n'
        '                     ┌───────────┐\n'
        '         ┌───────────│   SEALED  │◄──────────────┐\n'
        '         │           └─────┬─────┘               │\n'
        '         │                 │ unsealCA(shares)    │ sealCA() hoặc\n'
        '         │ Yêu cầu ký/cấp  │ (Đủ k=3/5 mảnh)     │ Hết hạn TTL\n'
        '         │ trả HTTP 423    ▼                     │ (Auto-Seal)\n'
        '         │ Locked    ┌───────────┐               │\n'
        '         └──────────►│  UNSEALED │───────────────┘\n'
        '                     └───────────┘\n'
        '                     Khóa riêng nằm tạm trong RAM\n'
        '                     Cho phép Ký mộc / Cấp / Thu hồi',
        caption='Sơ đồ 3.1: Máy trạng thái vòng đời Root CA (Sealed, Unsealed, Quorum Gate và Auto-Seal)'
    )

    add_para(doc, 'Các trạng thái và quy tắc chuyển đổi bao gồm:')
    add_bullet(doc, ' Trạng thái mặc định an toàn khi khởi động máy chủ hoặc sau khi bị niêm phong. Trong trạng thái này, đối tượng khóa riêng caPrivateKeyObject trong RAM được gán null; trên đĩa db.json, khóa chỉ tồn tại dưới dạng chuỗi văn bản đã mã hóa đối xứng (OpenPGP Encrypted Armored Block). Mọi yêu cầu gọi đến các API cấp chứng chỉ (/api/certificates/issue), thu hồi chứng chỉ (/api/certificates/:id/revoke), hoặc ký tài liệu với tư cách CA đều bị chặn với mã lỗi HTTP 423 Locked kèm mã lỗi hệ thống CA_SEALED.', bold_prefix='1. Trạng thái Niêm phong (SEALED):')
    add_bullet(doc, ' Để mở niêm phong CA, các quản trị viên an ninh cần tập hợp tối thiểu k mảnh khóa hợp lệ (mặc định k=3 trên tổng số n=5). Quản trị viên gửi yêu cầu tới endpoint POST /api/ca/unseal. Động cơ Shamir v2 giải mã đa thức Lagrange, khôi phục cụm mật khẩu gốc, giải mã đối tượng khóa riêng Root CA và đưa vào biến phạm vi module (RAM-only). Trạng thái CA chuyển sang UNSEALED, kích hoạt bộ đếm thời gian TTL (mặc định 5 phút = 300.000 ms).', bold_prefix='2. Trạng thái Mở niêm phong (UNSEALED):')
    add_bullet(doc, ' Cơ chế bảo vệ chủ động chống quên niêm phong: Khi hết thời gian sống CA_UNSEAL_TTL_MS, bộ đếm timer tự động gọi hàm sealCA(). Hàm này ngay lập tức gán null cho đối tượng khóa riêng trong RAM, xóa bộ đếm và đổi cờ trạng thái db.ca_config.isSealed = true. Ngoài ra, quản trị viên có thể chủ động niêm phong tức thì bất cứ lúc nào qua endpoint POST /api/ca/seal.', bold_prefix='3. Cơ chế Tự động Niêm phong (Auto-Seal TTL):')

    # 3.4 Quy trình cấp chứng thư và thu hồi
    add_h2(doc, '3.4 Thiết kế quy trình cấp chứng thư và thu hồi với chữ ký RFC 4880')
    add_para(doc,
        'Quy trình cấp chứng thư cho cán bộ doanh nghiệp và thu hồi chứng chỉ được thiết kế nhằm đảm bảo tính hợp lệ pháp lý cao nhất theo tiêu chuẩn RFC 4880.'
    )

    add_figure(doc, 'diagrams/ca_and_signing_flow.png',
        'Hình 3.1: Quy trình cấp chứng thư và ký mộc CA chứng thực danh tính cán bộ nội bộ'
    )

    add_para(doc,
        'Trong quá trình hiện thực hóa phân hệ thu hồi chứng chỉ (Revocation), thư viện `openpgp.js` v6.3.2 không có hàm độc lập `createRevocationCertificate()` vốn có ở các phiên bản cũ, và hàm `revokeKey()` không nhận một packet thu hồi từ bên ngoài vào public key đã tải lại. Để giải quyết vấn đề tương thích này, hệ thống áp dụng quy trình xử lý gồm 2 bước:'
    )
    add_bullet(doc, ' Khi cấp chứng chỉ tại issueCertificate(), hàm generateKey() của openpgp v6 tự động sinh ra một Chứng chỉ thu hồi chuẩn bị trước (Pre-generated Revocation Certificate: Gói tin Tag 2 loại 0x20, kích thước 192 byte). Hệ thống trích xuất và lưu chuỗi này vào trường revocationCertificateArmored của bản ghi chứng chỉ trong cơ sở dữ liệu (trước đây giá trị này chưa được mã nguồn cũ lưu trữ).', bold_prefix='Bước 1: Lưu giữ chứng chỉ thu hồi chuẩn bị trước:')
    add_bullet(doc, ' Khi nhận được yêu cầu thu hồi chứng chỉ tại POST /api/certificates/:id/revoke, hệ thống thực hiện hai thao tác kiểm chứng song song: (1) Gọi hàm applyRevocationCertificate(publicKey, revocationCert) để xác nhận chứng chỉ thu hồi lưu trữ khớp cấu trúc gói tin và áp dụng thành công lên khóa công khai; và (2) Sinh chuỗi khóa công khai đã thu hồi chính thức (revokedPublicKeyArmored) để đưa vào danh bạ công khai.', bold_prefix='Bước 2: Áp dụng và phát hành chữ ký thu hồi:')

    # 3.5 Trao đổi thông điệp B2B
    add_h2(doc, '3.5 Thiết kế trao đổi thông điệp bảo mật B2B (Sign-then-Encrypt)')
    add_para(doc,
        'Cổng giao tiếp B2B (Business-to-Business Gateway) phục vụ cho việc gửi và nhận các tài liệu mật giữa doanh nghiệp và các đối tác bên ngoài (ví dụ đơn đặt hàng, báo giá, phụ lục hợp đồng). Hệ thống áp dụng quy chuẩn mật mã học: Ký trước rồi mới Mã hóa (Sign-then-Encrypt).'
    )

    add_figure(doc, 'diagrams/b2b_e2e_messaging.png',
        'Hình 3.2: Quy trình mã hóa và giải mã thông điệp B2B đối tác ngoài (Sign-then-Encrypt)'
    )

    add_para(doc, 'Các bước chi tiết trong luồng xử lý thông điệp B2B:')
    add_bullet(doc, ' Người gửi (ví dụ: Doanh nghiệp đối tác ngoài) tạo nội dung thông điệp hoặc đính kèm tài liệu. Phía máy khách sử dụng khóa bí mật riêng của người gửi (Sender Private Key) để tạo một Chữ ký số tách rời (Detached Signature) trên dữ liệu gốc. Chữ ký này đảm bảo tính xác thực nguồn gốc và chống chối bỏ.', bold_prefix='Bước 1: Ký số xác thực:')
    add_bullet(doc, ' Dữ liệu gốc và chữ ký số được đóng gói và nén bằng thuật toán ZLIB/ZIP nhằm giảm thiểu dung lượng và xóa bỏ các mẫu quy luật thống kê ngôn ngữ (ngăn ngừa tấn công phân tích tần suất).', bold_prefix='Bước 2: Nén dữ liệu:')
    add_bullet(doc, ' Hệ thống sinh một Khóa phiên ngẫu nhiên 256-bit (Session Key) bằng bộ CSPRNG. Dữ liệu nén được mã hóa đối xứng bằng thuật toán AES-256 trong chế độ SEIPD (Tag 18) có kiểm soát toàn vẹn.', bold_prefix='Bước 3: Mã hóa đối xứng:')
    add_bullet(doc, ' Khóa phiên được mã hóa bất đối xứng bằng Khóa công khai của người nhận (Recipient Public Key - Curve25519) và đóng gói thành gói tin Tag 1. Chỉ người nhận sở hữu khóa bí mật tương ứng mới có thể giải mã khóa phiên này.', bold_prefix='Bước 4: Đóng gói mã hóa lai (Hybrid Packaging):')
    add_bullet(doc, ' Khi người nhận giải mã thông điệp, hệ thống tự động trích xuất chữ ký số của người gửi, đối chiếu với danh bạ khóa công khai đã được xác thực, và trả về trạng thái xác thực chữ ký (Signature Verification: Valid/Invalid) ngay trên giao diện người dùng.', bold_prefix='Bước 5: Tiếp nhận và thẩm tra:')

    # 3.6 Merkle, WoT, Inspector
    add_h2(doc, '3.6 Thiết kế các phân hệ hỗ trợ: Merkle Audit, Web of Trust và Packet Inspector')
    add_para(doc,
        'Bên cạnh hạt nhân Root CA và B2B Gateway, ba phân hệ kỹ thuật còn lại đóng vai trò quan trọng trong việc hỗ trợ hệ sinh thái:'
    )
    add_figure(doc, 'diagrams/pgp_digital_signing_verification_flow.png',
        'Hình 3.3: Quy trình thẩm định chữ ký số tài liệu và kiểm tra mộc CA công khai'
    )
    add_bullet(doc, ' Phân hệ của Kỹ sư 3 ghi lại mọi sự kiện quản trị (cấp chứng chỉ, thu hồi chứng chỉ, unseal CA, đăng ký đối tác). Mỗi sự kiện trở thành một lá trên cây Merkle. Cây duy trì giá trị Merkle Root bất biến. Khi có yêu cầu kiểm toán, hệ thống trích xuất đường dẫn Audit Proof để kiểm tra xem một bản ghi log cụ thể có từng bị chỉnh sửa trong cơ sở dữ liệu hay không.', bold_prefix='1. Phân hệ Cây Merkle (RFC 6962):')
    add_bullet(doc, ' Phân hệ của Kỹ sư 4 xây dựng đồ thị có hướng biểu diễn các mối quan hệ tín nhiệm. Khi hai doanh nghiệp đối tác chưa từng gặp gỡ trực tiếp, thuật toán Dijkstra tìm đường đi ngắn nhất giữa hai nút trên đồ thị. Trọng số tin cậy được tính toán tích lũy theo các cạnh bảo chứng (0x10 đến 0x13). Đồng thời, thuật toán Tarjan được tích hợp để phát hiện các "Điểm nghẽn tin cậy" (Bottlenecks) - các mắt xích mà nếu bị thỏa hiệp sẽ làm đứt gãy toàn bộ chuỗi tin cậy liên tổ chức.', bold_prefix='2. Phân hệ Web of Trust Analyzer:')
    add_bullet(doc, ' Phân hệ của Kỹ sư 1 và 5 cung cấp công cụ bóc tách trực quan mọi chuỗi văn bản ASCII Armored OpenPGP. Công cụ giải mã Radix-64, phân tích từng byte của Packet Header, hiển thị cây phân cấp gói tin, mã thuật toán, thông số băm và cờ bảo vệ tính toàn vẹn SEIPD.', bold_prefix='3. Phân hệ OpenPGP Packet Inspector:')

    # 3.7 RBAC Matrix
    add_h2(doc, '3.7 Ma trận kiểm soát truy cập dựa trên vai trò (RBAC Matrix)')
    add_para(doc,
        'Để bảo vệ toàn diện hệ thống API chống lại các truy cập trái phép, Kỹ sư 2 thiết lập ma trận phân quyền RBAC chặt chẽ tại backend. Các vai trò được phân định rõ ràng: Quản trị viên (Admin), Cán bộ nhân viên (Employee), Doanh nghiệp đối tác ngoài (Partner), và Người thẩm tra nặc danh (Public). Bảng 3.2 mô tả chi tiết quyền hạn trên từng nhóm endpoint.'
    )

    add_table_caption(doc, 'Bảng 3.2: Ma trận kiểm soát truy cập RBAC và quyền hạn theo từng vai trò hệ thống')
    rbac_headers = ['Nhóm tài nguyên / Endpoint API', 'Public', 'Partner', 'Employee', 'Admin']
    rbac_data = [
        ['GET /api/ca/status (Xem trạng thái niêm phong CA)', 'Cho phép (200)', 'Cho phép (200)', 'Cho phép (200)', 'Cho phép (200)'],
        ['GET /api/directory (Tra cứu danh bạ khóa công khai)', 'Cho phép (200)', 'Cho phép (200)', 'Cho phép (200)', 'Cho phép (200)'],
        ['POST /api/documents/verify (Thẩm định chữ ký công khai)', 'Cho phép (200)', 'Cho phép (200)', 'Cho phép (200)', 'Cho phép (200)'],
        ['POST /api/ca/unseal, /api/ca/seal (Quorum Unseal/Seal CA)', 'Chặn (401)', 'Chặn (403)', 'Chặn (403)', 'Cho phép (200)'],
        ['POST /api/certificates/issue (Cấp mới chứng chỉ cán bộ)', 'Chặn (401)', 'Chặn (403)', 'Chặn (403)', 'Cho phép (200|423)'],
        ['POST /api/certificates/:id/revoke (Thu hồi chứng chỉ)', 'Chặn (401)', 'Chặn (403)', 'Chặn (403)', 'Cho phép (200|423)'],
        ['POST /api/shamir/split, /api/shamir/recover (Phân chia/Ghép mảnh)', 'Chặn (401)', 'Chặn (403)', 'Chặn (403)', 'Cho phép (200|423)'],
        ['GET /api/certificates (Xem danh sách hồ sơ chứng chỉ nhân sự)', 'Chặn (401)', 'Chặn (403)', 'Cho phép (200)', 'Cho phép (200)'],
        ['POST /api/documents/sign (Ký số tài liệu nội bộ)', 'Chặn (401)', 'Chặn (403)', 'Cho phép (200)', 'Cho phép (200)'],
        ['GET /api/messages, POST /api/messages/decrypt (Hòm thư B2B)', 'Chặn (401)', 'Cho phép (200)', 'Cho phép (200)', 'Cho phép (200)'],
        ['GET /api/merkle/* (Xem trạng thái và chứng minh cây Merkle)', 'Chặn (401)', 'Chặn (403)', 'Chặn (403)', 'Cho phép (200)'],
        ['GET /api/wot/* (Tra cứu đồ thị và tìm đường tin cậy)', 'Chặn (401)', 'Chặn (403)', 'Cho phép (200)', 'Cho phép (200)']
    ]
    add_styled_table(doc, rbac_headers, rbac_data, col_widths=[5.5, 2.6, 2.6, 2.6, 2.7])

    doc.add_page_break()
    print("Chapter 3 generated successfully.")
