"""
Module xây dựng Trang bìa và các mục mở đầu (Mục lục, Tóm tắt, Danh mục thuật ngữ, Danh mục hình vẽ, Danh mục bảng biểu)
"""
import os
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from report_helpers import (
    add_para, add_h1, add_title_no_toc, add_table_caption, add_styled_table, set_cell_margins, set_cell_background
)

def build_cover_and_prelim(doc):
    # ── 1. TRANG BÌA ──────────────────────────────────────────────────────────
    p_top1 = doc.add_paragraph()
    p_top1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_top1.paragraph_format.space_before = Pt(0)
    p_top1.paragraph_format.space_after = Pt(2)
    r_top1 = p_top1.add_run('HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG')
    r_top1.bold = True
    r_top1.font.name = 'Times New Roman'
    r_top1.font.size = Pt(15)

    p_top2 = doc.add_paragraph()
    p_top2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_top2.paragraph_format.space_before = Pt(0)
    p_top2.paragraph_format.space_after = Pt(14)
    r_top2 = p_top2.add_run('KHOA AN TOÀN THÔNG TIN')
    r_top2.bold = True
    r_top2.font.name = 'Times New Roman'
    r_top2.font.size = Pt(15)

    # Logo PTIT
    logo_path = os.path.abspath('analysis/word/media/image1.jpg')
    if os.path.exists(logo_path):
        p_logo = doc.add_paragraph()
        p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo.paragraph_format.space_before = Pt(10)
        p_logo.paragraph_format.space_after = Pt(16)
        r_logo = p_logo.add_run()
        r_logo.add_picture(logo_path, width=Cm(4.2))

    # Báo cáo BTL
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(14)
    p_sub.paragraph_format.space_after = Pt(10)
    r_sub = p_sub.add_run('BÁO CÁO BÀI TẬP LỚN')
    r_sub.bold = True
    r_sub.font.name = 'Times New Roman'
    r_sub.font.size = Pt(16)
    r_sub.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    # Tên đề tài
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(6)
    p_title.paragraph_format.space_after = Pt(28)
    p_title.paragraph_format.line_spacing = 1.3
    r_lbl = p_title.add_run('ĐỀ TÀI: ')
    r_lbl.bold = True
    r_lbl.font.name = 'Times New Roman'
    r_lbl.font.size = Pt(16)
    r_lbl.font.color.rgb = RGBColor(0xB9, 0x1C, 0x1C) # Dark red emphasis
    
    r_name = p_title.add_run('NGHIÊN CỨU, THIẾT KẾ VÀ TRIỂN KHAI\nHỆ THỐNG CẤP CHỨNG THƯ OPENPGP VÀ TRAO ĐỔI DỮ LIỆU B2B AN TOÀN TRONG DOANH NGHIỆP')
    r_name.bold = True
    r_name.font.name = 'Times New Roman'
    r_name.font.size = Pt(16)
    r_name.font.color.rgb = RGBColor(0x11, 0x18, 0x27)

    # Bảng thông tin sinh viên
    tbl_info = doc.add_table(rows=5, cols=2)
    tbl_info.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_info.autofit = False
    
    info_rows = [
        ('Họ và tên:', 'NGUYỄN GIA HÀO'),
        ('Mã sinh viên:', 'B24DCAT088'),
        ('Mã học phần:', '[ĐIỀN]'),
        ('Tên lớp:', '[ĐIỀN]'),
        ('Giảng viên hướng dẫn:', '[ĐIỀN]')
    ]
    for idx, (label, val) in enumerate(info_rows):
        r = tbl_info.rows[idx]
        c0, c1 = r.cells[0], r.cells[1]
        c0.width = Cm(5.5)
        c1.width = Cm(9.5)
        set_cell_margins(c0, top=60, bottom=60, left=80, right=80)
        set_cell_margins(c1, top=60, bottom=60, left=80, right=80)
        
        p0 = c0.paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p0.paragraph_format.space_before = Pt(1)
        p0.paragraph_format.space_after = Pt(1)
        run0 = p0.add_run(label)
        run0.bold = True
        run0.font.name = 'Times New Roman'
        run0.font.size = Pt(12)

        p1 = c1.paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p1.paragraph_format.space_before = Pt(1)
        p1.paragraph_format.space_after = Pt(1)
        run1 = p1.add_run(val)
        run1.font.name = 'Times New Roman'
        run1.font.size = Pt(12)
        if idx in (0, 1):
            run1.bold = True

    # Khoảng cách và địa danh cuối trang bìa
    p_gap = doc.add_paragraph()
    p_gap.paragraph_format.space_before = Pt(45)

    p_bottom = doc.add_paragraph()
    p_bottom.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_bottom.paragraph_format.space_before = Pt(0)
    p_bottom.paragraph_format.space_after = Pt(0)
    r_bot = p_bottom.add_run('HÀ NỘI 2026')
    r_bot.bold = True
    r_bot.font.name = 'Times New Roman'
    r_bot.font.size = Pt(14)

    # Ngắt trang sau bìa
    doc.add_page_break()

    # ── 2. MỤC LỤC (TOC) ──────────────────────────────────────────────────────
    add_title_no_toc(doc, 'MỤC LỤC')
    p_toc = doc.add_paragraph()
    p_toc.paragraph_format.space_before = Pt(6)
    p_toc.paragraph_format.space_after = Pt(12)
    r_toc = p_toc.add_run()._r
    fld1 = OxmlElement('w:fldChar')
    fld1.set(qn('w:fldCharType'), 'begin')
    instr = OxmlElement('w:instrText')
    instr.set(qn('xml:space'), 'preserve')
    instr.text = r'TOC \o "1-3" \h \z \u'
    fld2 = OxmlElement('w:fldChar')
    fld2.set(qn('w:fldCharType'), 'separate')
    fld3 = OxmlElement('w:fldChar')
    fld3.set(qn('w:fldCharType'), 'end')
    r_toc.append(fld1)
    r_toc.append(instr)
    r_toc.append(fld2)
    r_toc.append(fld3)

    doc.add_page_break()

    # ── 3. TÓM TẮT (ABSTRACT) ────────────────────────────────────────────────
    add_h1(doc, 'TÓM TẮT', center=True)
    add_para(doc,
        'Trong kỷ nguyên chuyển đổi số và bùng nổ giao thương điện tử liên tổ chức (B2B), vấn đề đảm bảo an toàn, tính toàn vẹn và thẩm quyền danh tính của các trao đổi dữ liệu trở thành thách thức quan trọng đối với các tổ chức. Chuẩn mật mã OpenPGP (RFC 4880) từ lâu đã được ứng dụng rộng rãi trong bảo vệ dữ liệu với mô hình mạng lưới tín nhiệm phân tán (Web of Trust - WoT). Tuy nhiên, khi đưa vào môi trường doanh nghiệp quy mô lớn, mô hình WoT thuần bộc lộ các điểm nghẽn: sự thiếu vắng cơ chế quản trị tập trung, độ phức tạp trong tính toán đường tin cậy liên phòng ban, rủi ro khi bảo vệ khóa bí mật của quản trị viên gốc, và việc không có cơ chế thu hồi tập trung mang tính đồng bộ nội bộ.'
    )
    add_para(doc,
        'Đề tài "Nghiên cứu, thiết kế và triển khai hệ thống cấp chứng thư OpenPGP và trao đổi dữ liệu B2B an toàn trong doanh nghiệp" được thực hiện nhằm đề xuất giải pháp dung hòa giữa tính phân tán linh hoạt của Web of Trust và cơ chế quản trị của Hạ tầng khóa công khai (PKI). Hệ thống áp dụng mô hình kiến trúc lai (Hybrid Trust Architecture): thiết lập Corporate Root CA nội bộ đóng vai trò neo tin cậy gốc (Trust Anchor) cấp chứng chỉ chính thức, đồng thời duy trì khả năng bảo chứng chéo WoT nội bộ và kết nối cổng giao tiếp B2B đối tác bên ngoài.'
    )
    add_para(doc,
        'Nội dung kỹ thuật trọng tâm của công trình tập trung vào phân hệ bảo vệ Root CA thông qua giao thức phân quyền Quorum dựa trên Lược đồ chia sẻ bí mật Shamir (Shamir Secret Sharing) trên trường hữu hạn $GF(2^8)$. Để hạn chế nguy cơ rò rỉ độ dài bí mật và phân tách rõ giữa các phiên, hệ thống sử dụng cấu trúc đóng gói Shamir Envelope v2 với cơ chế nhúng mã phiên (sessionTag 8-byte), đệm khối bảo vệ (block padding 16-byte) và trường kiểm tra toàn vẹn SHA-256. Khóa riêng Root CA chỉ được giải mã và lưu tạm thời trên bộ nhớ RAM khi tập hợp đủ ngưỡng $k$-trên-$n$ mảnh khóa (cụ thể là 3-trên-5 quản trị viên), kèm theo bộ đếm thời gian tự động niêm phong (Auto-Seal TTL) fail-closed.'
    )
    add_para(doc,
        'Hệ thống được phát triển trên nền tảng Full-Stack: Giao diện trực quan React 19 (Vite), Máy chủ điều phối Express 5, tích hợp thư viện openpgp.js v6 với thuật toán đường cong Elliptic Ed25519/Curve25519, bộ bóc tách gói tin RFC 4880 (Packet Inspector), cây Merkle (RFC 6962) ghi nhật ký kiểm toán, và thuật toán phân tích đường tin cậy WoT Dijkstra. Kết quả thử nghiệm thực tế với 291 assertions kiểm thử đơn vị và tích hợp HTTP của phân hệ Kỹ sư 2 đạt tỷ lệ vượt qua 100%, xác nhận hệ thống vận hành đúng theo kịch bản thiết kế kỹ thuật đề ra.'
    )
    
    doc.add_page_break()

    # ── 4. DANH MỤC THUẬT NGỮ VÀ TỪ VIẾT TẮT ────────────────────────────────
    add_h1(doc, 'DANH MỤC THUẬT NGỮ VÀ TỪ VIẾT TẮT', center=True)
    add_table_caption(doc, 'Bảng 0.1: Bảng giải nghĩa các thuật ngữ viết tắt trong bài báo cáo')
    
    terms_headers = ['Thuật ngữ', 'Tên đầy đủ tiếng Anh', 'Ý nghĩa & Định nghĩa trong hệ thống']
    terms_data = [
        ['PGP', 'Pretty Good Privacy', 'Hệ thống chương trình mật mã hóa và giải mã dữ liệu do Phil Zimmermann phát triển (1991).'],
        ['OpenPGP', 'Open Pretty Good Privacy Standard', 'Tiêu chuẩn mở của IETF (RFC 4880) định nghĩa định dạng thông điệp, chữ ký và chứng thư số.'],
        ['CA', 'Certificate Authority', 'Tổ chức/Cơ quan cấp chứng thư số đóng vai trò neo tin cậy xác thực danh tính.'],
        ['WoT', 'Web of Trust', 'Mạng lưới tín nhiệm phân tán dựa trên chữ ký chứng thực chéo giữa các bên ngang hàng.'],
        ['SSS', "Shamir's Secret Sharing", 'Thuật toán chia sẻ bí mật ngưỡng (k, n) dựa trên phép nội suy đa thức của Adi Shamir (1979).'],
        ['GF(256)', 'Galois Field 2^8', 'Trường hữu hạn gồm 256 phần tử dùng cho các phép toán số học byte trong phân chia bí mật Shamir.'],
        ['ECC', 'Elliptic Curve Cryptography', 'Mật mã học đường cong Elliptic cung cấp độ an toàn cao với kích thước khóa ngắn gọn.'],
        ['Ed25519', 'Edwards-curve Digital Signature', 'Cơ chế chữ ký số khóa công khai hiệu năng cao trên đường cong Edwards xoắn (EdDSA).'],
        ['Curve25519', 'Montgomery Curve 25519', 'Đường cong Montgomery dùng cho giao thức trao đổi khóa Diffie-Hellman (ECDH).'],
        ['Merkle Tree', 'Merkle Hash Tree', 'Cây băm nhị phân kiểm toán tính toàn vẹn và bất biến của dữ liệu (chuẩn RFC 6962).'],
        ['RBAC', 'Role-Based Access Control', 'Mô hình kiểm soát truy cập và ủy quyền tài nguyên dựa trên vai trò người dùng.'],
        ['E2E', 'End-to-End Encryption', 'Mã hóa đầu cuối: dữ liệu chỉ được giải mã duy nhất tại máy trạm của người nhận có thẩm quyền.'],
        ['B2B', 'Business-to-Business', 'Cổng giao tiếp và trao đổi dữ liệu bảo mật giữa các doanh nghiệp đối tác ngoài.'],
        ['TTL', 'Time-To-Live', 'Khoảng thời gian hiệu lực còn lại của phiên làm việc trước khi khóa tự động niêm phong.'],
        ['SPoF', 'Single Point of Failure', 'Điểm hỏng hóc hoặc điểm chết đơn lẻ có thể làm sụp đổ toàn bộ hệ thống an ninh.'],
        ['ASCII Armor', 'ASCII Armored Format', 'Cơ chế đóng gói dữ liệu nhị phân OpenPGP thành văn bản mã hóa Radix-64 kèm checksum CRC24.']
    ]
    add_styled_table(doc, terms_headers, terms_data, col_widths=[2.8, 5.2, 8.0])

    doc.add_page_break()

    # ── 5. DANH MỤC HÌNH VẼ MINH HỌA ─────────────────────────────────────────
    add_h1(doc, 'DANH MỤC HÌNH VẼ MINH HỌA', center=True)
    add_table_caption(doc, 'Bảng 0.2: Danh mục các hình vẽ và biểu đồ trong bài báo cáo')
    
    fig_headers = ['Ký hiệu', 'Tên hình minh họa', 'Trang tham chiếu']
    fig_data = [
        ['Hình 1.1', 'Mô hình tin cậy lai (Hybrid Trust Model) kết hợp Corporate CA và Web of Trust', 'Chương 1'],
        ['Hình 2.1', 'Cấu trúc phân lớp gói tin OpenPGP theo tiêu chuẩn RFC 4880', 'Chương 2'],
        ['Hình 2.2', 'Sơ đồ luồng mã hóa và giải mã đối xứng - bất đối xứng lai trong OpenPGP', 'Chương 2'],
        ['Hình 2.3', 'Kiến trúc mô-đun kỹ thuật và sơ đồ cấu trúc dữ liệu Merkle', 'Chương 2'],
        ['Hình 3.1', 'Quy trình cấp chứng thư và ký mộc CA chứng thực danh tính cán bộ nội bộ', 'Chương 3'],
        ['Hình 3.2', 'Quy trình mã hóa và giải mã thông điệp B2B đối tác ngoài (Sign-then-Encrypt)', 'Chương 3'],
        ['Hình 3.3', 'Quy trình thẩm định chữ ký số tài liệu và kiểm tra mộc CA công khai', 'Chương 3']
    ]
    add_styled_table(doc, fig_headers, fig_data, col_widths=[2.5, 10.5, 3.0])

    doc.add_page_break()

    # ── 6. DANH MỤC BẢNG BIỂU DỮ LIỆU ────────────────────────────────────────
    add_h1(doc, 'DANH MỤC BẢNG BIỂU DỮ LIỆU', center=True)
    add_table_caption(doc, 'Bảng 0.3: Danh mục bảng biểu dữ liệu')
    
    tbl_headers = ['Ký hiệu', 'Tên bảng biểu dữ liệu', 'Trang tham chiếu']
    tbl_data = [
        ['Bảng 0.1', 'Bảng giải nghĩa các thuật ngữ viết tắt trong bài báo cáo', 'Phần mở đầu'],
        ['Bảng 0.2', 'Danh mục các hình vẽ và biểu đồ trong bài báo cáo', 'Phần mở đầu'],
        ['Bảng 0.3', 'Danh mục bảng biểu dữ liệu', 'Phần mở đầu'],
        ['Bảng 1.1', 'So sánh ưu nhược điểm giữa PKI X.509 truyền thống và Web of Trust phân tán', 'Chương 1'],
        ['Bảng 3.1', 'Ma trận phân công trách nhiệm và ranh giới kỹ thuật 5 kỹ sư đồ án', 'Chương 3'],
        ['Bảng 3.2', 'Ma trận kiểm soát truy cập RBAC và quyền hạn theo từng vai trò hệ thống', 'Chương 3'],
        ['Bảng 4.1', 'Đặc tả chi tiết cấu trúc byte của gói tin Shamir Envelope v2', 'Chương 4'],
        ['Bảng 4.2', 'Bảng quy chuẩn ánh xạ mã lỗi HTTP bảo mật và ngữ nghĩa hệ thống', 'Chương 4'],
        ['Bảng 5.1', 'Kết quả kiểm thử máy trạng thái Root CA Seal/Unseal (Nhóm C)', 'Chương 5'],
        ['Bảng 5.2', 'Kết quả kiểm thử tự động thuật toán Shamir Secret Sharing v2 (Nhóm S)', 'Chương 5'],
        ['Bảng 5.3', 'Kết quả kiểm thử xác thực và phân quyền RBAC HTTP (Nhóm B: 107 ca test)', 'Chương 5'],
        ['Bảng 5.4', 'Bảng tổng hợp kết quả kiểm thử thực nghiệm của cả 5 phân hệ kỹ sư', 'Chương 5'],
        ['Bảng 5.5', 'Bảng đối chiếu hiện trạng và chứng cứ mã nguồn của 3 hạng mục bảo mật', 'Chương 5'],
        ['Bảng 6.1', 'Bảng đối chiếu sai lệch thuật toán WoT giữa thực tế hệ thống và tài liệu Kỹ sư 4', 'Chương 6']
    ]
    add_styled_table(doc, tbl_headers, tbl_data, col_widths=[2.5, 10.5, 3.0])

    doc.add_page_break()
    print("Cover and preliminary sections generated successfully.")
