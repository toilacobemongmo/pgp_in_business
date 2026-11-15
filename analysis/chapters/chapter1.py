"""
Chương 1: Tổng quan và đặt vấn đề
"""
import os
from docx.shared import Pt, Cm
from report_helpers import (
    add_para, add_bullet, add_h1, add_h2, add_h3,
    add_table_caption, add_styled_table, add_figure
)

def build_chapter_1(doc):
    add_h1(doc, 'CHƯƠNG 1: TỔNG QUAN VÀ ĐẶT VẤN ĐỀ', center=True)

    # 1.1 Bối cảnh PKI
    add_h2(doc, '1.1 Bối cảnh PKI và nhu cầu bảo mật thông tin trong doanh nghiệp số')
    add_para(doc,
        'Trong thời đại kinh tế số, các tổ chức và doanh nghiệp phải đối mặt với áp lực chưa từng có về an toàn thông tin. Các hoạt động trao đổi văn bản nội bộ, phê duyệt hợp đồng điện tử và đặc biệt là giao thương giữa các doanh nghiệp đối tác (B2B) đều diễn ra trên môi trường mạng công cộng mở. Điều này đặt ra yêu cầu nghiêm ngặt về ba thuộc tính an ninh căn bản: Tính bảo mật (Confidentiality) - ngăn ngừa lộ lọt thông tin; Tính toàn vẹn (Integrity) - phát hiện can thiệp sửa đổi trái phép; và Tính chống chối bỏ (Non-repudiation) - xác thực chính xác danh tính chủ thể tạo lập dữ liệu.'
    )
    add_para(doc,
        'Để giải quyết bài toán trên, Hạ tầng khóa công khai (Public Key Infrastructure - PKI) dựa trên tiêu chuẩn X.509 đã được triển khai rộng rãi trong nhiều thập kỷ qua. Tuy nhiên, PKI truyền thống mang tính tập trung cao độ, quy trình cấp phát chứng thư số qua các Cơ quan thẩm quyền (Certificate Authority - CA) thương mại thường tốn kém chi phí, thủ tục xác minh cồng kềnh và thiếu tính linh hoạt trong các mô hình cộng tác liên cơ quan ngang hàng. Ngược lại, chuẩn OpenPGP (RFC 4880) nổi lên như một giải pháp mật mã mã nguồn mở mạnh mẽ, cho phép người dùng tự sinh cặp khóa, tự ký và mã hóa thông điệp mà không phụ thuộc vào một nhà cung cấp chứng thư thương mại độc quyền nào.'
    )

    # 1.2 Hạn chế của WoT thuần & Mô hình Hybrid
    add_h2(doc, '1.2 Hạn chế cốt tử của mô hình Web of Trust thuần và sự cần thiết của mô hình Hybrid CA')
    add_para(doc,
        'Mô hình tin cậy nguyên bản của OpenPGP là Mạng lưới tín nhiệm (Web of Trust - WoT). Trong WoT, không có cơ quan quản lý tập trung; tính xác thực của một khóa công khai được hình thành thông qua các chữ ký bảo chứng chéo (Key Signing) giữa những người dùng tin tưởng lẫn nhau. Mô hình này rất lý tưởng cho các cộng đồng mã nguồn mở và trao đổi cá nhân, nhưng khi áp dụng vào môi trường quản trị doanh nghiệp, nó bộc lộ những điểm nghẽn nghiêm trọng sau:'
    )
    add_bullet(doc, ' Sự thiếu vắng của chính sách định danh tập trung: Một nhân viên mới vào công ty không thể tự động được toàn thể đối tác và đồng nghiệp tin tưởng ngay nếu chưa thu thập đủ chữ ký xác nhận từ các thành viên khác.', bold_prefix='1. Điểm nghẽn khởi tạo danh tính (Bootstrapping):')
    add_bullet(doc, ' Để xác định một khóa của đối tác có hợp lệ hay không, hệ thống phải duyệt qua toàn bộ đồ thị mạng lưới để tìm đường tin cậy (Trust Path). Khi số lượng thực thể lên tới hàng chục nghìn, bài toán tìm đường và tổng hợp trọng số xác suất trở nên quá tải.', bold_prefix='2. Độ phức tạp tính toán đường tin cậy:')
    add_bullet(doc, ' Khi một nhân viên nghỉ việc hoặc khóa bí mật bị lộ, trong mô hình WoT thuần không có cơ chế thu hồi tập trung mang tính bắt buộc (Mandatory Revocation) áp đặt toàn bộ hệ thống hủy bỏ hiệu lực của khóa đó ngay lập tức.', bold_prefix='3. Khó khăn trong quản lý vòng đời và thu hồi khóa:')
    add_bullet(doc, ' Nếu doanh nghiệp áp dụng mô hình CA tập trung đơn lẻ, khóa riêng của Root CA trở thành mục tiêu tấn công trọng yếu (High-value Target). Kẻ xâm nhập chiếm được khóa Root CA có thể giả mạo chữ ký quản trị, cấp chứng chỉ tùy ý và làm suy giảm nghiêm trọng độ tin cậy của toàn hệ thống.', bold_prefix='4. Rủi ro điểm chết duy nhất (Single Point of Failure - SPoF):')

    add_table_caption(doc, 'Bảng 1.1: So sánh ưu nhược điểm giữa PKI X.509 truyền thống và Web of Trust phân tán')
    comp_headers = ['Tiêu chí so sánh', 'Hạ tầng PKI X.509 truyền thống', 'Mô hình Web of Trust thuần', 'Mô hình Hybrid CA đề xuất']
    comp_data = [
        ['Mô hình định danh', 'Phân cấp hình cây (Hierarchical)', 'Mạng lưới ngang hàng (Mesh)', 'Lai: Root CA + Mạng lưới WoT'],
        ['Neo tin cậy (Trust Anchor)', 'Các Root CA thương mại cài sẵn', 'Từng người dùng tự quyết định', 'Corporate Root CA của doanh nghiệp'],
        ['Chi phí vận hành', 'Rất cao (mua chứng thư hàng năm)', 'Miễn phí, phân tán', 'Tối ưu, triển khai nội bộ linh hoạt'],
        ['Khả năng kiểm soát thu hồi', 'Tập trung qua CRL / OCSP', 'Rất khó, lan truyền chậm', 'Tập trung tức thời qua CA & Merkle'],
        ['Bảo vệ khóa gốc', 'Phụ thuộc thiết bị phần cứng HSM đắt đỏ', 'Không có khóa gốc', 'Quorum Shamir k-of-n (Software Vault)'],
        ['Khả năng mở rộng B2B', 'Yêu cầu Cross-Certification phức tạp', 'Dựa trên gặp gỡ ký chéo (Key Party)', 'Cổng B2B Gateway kết hợp WoT']
    ]
    add_styled_table(doc, comp_headers, comp_data, col_widths=[2.8, 4.3, 4.3, 4.6])

    add_para(doc,
        'Xuất phát từ các phân tích trên, đồ án đề xuất giải pháp kiến trúc lai (Hybrid Trust Model): Lấy Corporate Root CA làm neo tin cậy gốc (Trust Anchor) cấp chứng chỉ chính thức cho toàn bộ cán bộ công nhân viên, đồng thời cho phép duy trì các mối quan hệ bảo chứng chéo WoT giữa các phòng ban và đối tác B2B bên ngoài. Đặc biệt, để giảm thiểu rủi ro SPoF của Root CA mà không cần phụ thuộc các thiết bị HSM phần cứng đắt tiền, chúng tôi ứng dụng Lược đồ chia sẻ bí mật Shamir để phân quyền quản trị Root CA cho một hội đồng Quorum gồm nhiều thành viên an ninh.'
    )

    add_figure(doc, 'diagrams/system_architecture.png',
        'Hình 1.1: Mô hình tin cậy lai (Hybrid Trust Model) kết hợp Corporate CA và Web of Trust'
    )

    # 1.3 Mục tiêu và nhiệm vụ
    add_h2(doc, '1.3 Mục tiêu và nhiệm vụ kỹ thuật của đề tài')
    add_para(doc, 'Mục tiêu tổng quát của đề tài là xây dựng một nền tảng quản trị danh tính số OpenPGP cấp doanh nghiệp, tăng cường mức độ an toàn cho khóa gốc thông qua cơ chế Quorum, cung cấp dịch vụ ký số tài liệu và kênh trao đổi dữ liệu B2B mật mã hóa đầu cuối kèm khả năng kiểm toán.')
    add_para(doc, 'Các nhiệm vụ kỹ thuật cụ thể bao gồm:')
    add_bullet(doc, 'Nghiên cứu cấu trúc gói tin RFC 4880, thuật toán chữ ký số Ed25519, trao đổi khóa Curve25519 và thư viện OpenPGP.js v6.')
    add_bullet(doc, 'Thiết kế và hiện thực thuật toán phân chia bí mật Shamir trên trường hữu hạn GF(256), xây dựng cấu trúc Envelope v2 chống rò rỉ siêu dữ liệu độ dài và chống tấn công trộn mảnh giữa các phiên.')
    add_bullet(doc, 'Xây dựng máy trạng thái Root CA Seal/Unseal, thực thi cơ chế cổng kiểm soát Quorum 3-of-5 và cơ chế tự động niêm phong (Auto-Seal TTL).')
    add_bullet(doc, 'Thiết lập quy trình thu hồi chứng chỉ chuẩn RFC 4880 sinh Revocation Signature hợp lệ.')
    add_bullet(doc, 'Xây dựng sổ cái kiểm toán cây Merkle (RFC 6962) ghi log hoạt động không thể giả mạo và phân hệ phân tích đường tin cậy Web of Trust.')
    add_bullet(doc, 'Hiện thực hệ thống Full-Stack (React 19 + Express 5), kiểm soát truy cập RBAC và thực hiện kiểm thử tự động toàn diện với hơn 290 khẳng định kiểm thử.')

    # 1.4 Đối tượng và phạm vi
    add_h2(doc, '1.4 Đối tượng, phạm vi nghiên cứu và ranh giới phân công 5 kỹ sư')
    add_para(doc,
        'Đối tượng nghiên cứu của đồ án là các chuẩn mật mã khóa công khai OpenPGP (RFC 4880), lý thuyết chia sẻ bí mật ngưỡng Shamir, cấu trúc dữ liệu cây Merkle (RFC 6962) và các giao thức trao đổi dữ liệu an toàn B2B. Phạm vi triển khai là một hệ sinh thái ứng dụng Web hoàn chỉnh phục vụ cho một tổ chức doanh nghiệp có quy mô vừa và lớn kết nối với các đối tác chiến lược bên ngoài.'
    )
    add_para(doc,
        'Đề tài được phối hợp thực hiện bởi nhóm 5 kỹ sư với ranh giới trách nhiệm và hợp đồng kỹ thuật được phân định rõ ràng như sau:'
    )
    add_bullet(doc, ' Nghiên cứu chi tiết cấu trúc các Packet RFC 4880 (Tag 1, 2, 4, 6, 8, 9, 14), xây dựng công cụ bóc tách nhị phân, kiểm tra CRC24 và thẩm định cú pháp gói tin.', bold_prefix='• Kỹ sư 1 (Phân hệ Packet Inspector):')
    add_bullet(doc, ' Chịu trách nhiệm bảo vệ hạt nhân Root CA bằng cơ chế Quorum; hiện thực máy trạng thái Seal/Unseal; thuật toán Shamir Envelope v2; sinh và thẩm định chữ ký thu hồi (Revocation Signature); kiểm soát phân quyền RBAC và an ninh cổng API.', bold_prefix='• Kỹ sư 2 (Phân hệ Root CA & Quorum Escrow):')
    add_bullet(doc, ' Xây dựng động cơ cây băm Merkle theo chuẩn RFC 6962; tạo lập sổ cái kiểm toán bất biến (Append-only Ledger); sinh bằng chứng kiểm toán (Audit Proof) và bằng chứng nhất quán (Consistency Proof).', bold_prefix='• Kỹ sư 3 (Phân hệ Merkle Audit Engine):')
    add_bullet(doc, ' Xây dựng mô hình đồ thị có hướng biểu diễn mạng lưới tín nhiệm WoT; cài đặt thuật toán Dijkstra tìm đường tin cậy ngắn nhất và thuật toán phát hiện điểm thắt nghẽn đường truyền (Bottleneck Detection).', bold_prefix='• Kỹ sư 4 (Phân hệ Web of Trust Analyzer):')
    add_bullet(doc, ' Thiết kế kiến trúc truyền nhận thông điệp mã hóa đầu cuối B2B (Sign-then-Encrypt); tích hợp các luồng ký tài liệu số doanh nghiệp và tối ưu hóa hiệu năng truyền tải.', bold_prefix='• Kỹ sư 5 (Phân hệ B2B Messaging & Document Signing):')

    # 1.5 Bố cục
    add_h2(doc, '1.5 Bố cục toàn văn của bài báo cáo')
    add_para(doc, 'Nội dung báo cáo được cấu trúc thành 6 chương logic, đi từ nền tảng lý thuyết đến thiết kế, hiện thực hóa mã nguồn, đánh giá thực nghiệm và kết luận:')
    add_bullet(doc, ' Giới thiệu bối cảnh, lý do chọn đề tài, mục tiêu, ranh giới phân công và phương pháp nghiên cứu.', bold_prefix='Chương 1: Tổng quan và đặt vấn đề:')
    add_bullet(doc, ' Trình bày cơ sở lý thuyết mật mã: Chuẩn OpenPGP RFC 4880, thuật toán Ed25519/Curve25519, phân cấp CA và WoT, toán học chia sẻ bí mật Shamir trên GF(256) và cây Merkle RFC 6962.', bold_prefix='Chương 2: Cơ sở lý thuyết và nền tảng mật mã học:')
    add_bullet(doc, ' Đặc tả kiến trúc phân lớp tổng thể, sơ đồ tương tác giữa 5 phân hệ kỹ sư, máy trạng thái Root CA, quy trình cấp/thu hồi chứng thư và các luồng nghiệp vụ B2B.', bold_prefix='Chương 3: Thiết kế kiến trúc hệ thống:')
    add_bullet(doc, ' Trích dẫn và phân tích chi tiết các đoạn mã nguồn cốt lõi trong hệ thống: shamir-service.js, pgp-service.js, auth.js, quorum-shard-store.js, merkle-engine.js và wot-analyzer.js.', bold_prefix='Chương 4: Hiện thực hóa mã nguồn các phân hệ:')
    add_bullet(doc, ' Báo cáo kết quả thử nghiệm thực tế với 291 assertions của Kỹ sư 2 và các bộ test của Kỹ sư 3, 4, 5; chứng minh việc khắc phục 3 lỗ hổng bảo mật cốt lõi kèm bảng số liệu đo đạc thực tế.', bold_prefix='Chương 5: Thử nghiệm thực tế, đánh giá và kiểm chứng bảo mật:')
    add_bullet(doc, ' Đánh giá tổng kết, phân tích trung thực các hạn chế kỹ thuật hiện tại của hệ thống và đề xuất định hướng phát triển trong tương lai.', bold_prefix='Chương 6: Kết luận, hạn chế và hướng phát triển:')

    doc.add_page_break()
    print("Chapter 1 generated successfully.")
