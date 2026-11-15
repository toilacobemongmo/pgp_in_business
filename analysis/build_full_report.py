"""
Master script xây dựng toàn bộ Báo cáo Bài tập lớn PGP
Xuất file: Bao_cao_Bai_tap_lon_PGP.docx và Bao_cao_Bai_tap_lon_PGP.pdf
"""
import sys, os, datetime
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Thêm thư mục hiện tại và chapters vào sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)
sys.path.insert(0, os.path.join(script_dir, 'chapters'))

import docx
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml

from cover_and_prelim import build_cover_and_prelim
from chapter1 import build_chapter_1
from chapter2 import build_chapter_2
from chapter3 import build_chapter_3
from chapter4 import build_chapter_4
from chapter5 import build_chapter_5
from chapter6_and_end import build_chapter_6_and_end

def main():
    print("=== BẮT ĐẦU XÂY DỰNG BÁO CÁO BÀI TẬP LỚN PGP ===")
    doc = Document()

    # 1. Khổ giấy A4 & Căn lề chuẩn học viện
    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.left_margin = Cm(3.0)
        section.right_margin = Cm(2.0)
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        # Trang bìa không hiện số trang
        section.different_first_page_header_footer = True
        
        # Đánh số trang góc phải ở footer
        footer_p = section.footer.paragraphs[0]
        footer_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        footer_p.paragraph_format.space_before = Pt(0)
        footer_p.paragraph_format.space_after = Pt(0)
        r_num = footer_p.add_run()
        r_num.font.name = 'Times New Roman'
        r_num.font.size = Pt(10)
        fld_page = parse_xml(r'<w:fldSimple %s w:instr="PAGE"/>' % nsdecls('w'))
        r_num._r.append(fld_page)

    # 2. Cài đặt font chữ chuẩn
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Times New Roman'
    style_normal.font.size = Pt(12)
    style_normal.font.color.rgb = RGBColor(0x11, 0x18, 0x27)

    # 3. Lắp ráp các phân hệ nội dung
    print("[1/7] Đang tạo Trang bìa và các Danh mục mở đầu...")
    build_cover_and_prelim(doc)

    print("[2/7] Đang tạo Chương 1: Tổng quan và đặt vấn đề...")
    build_chapter_1(doc)

    print("[3/7] Đang tạo Chương 2: Cơ sở lý thuyết và nền tảng mật mã học...")
    build_chapter_2(doc)

    print("[4/7] Đang tạo Chương 3: Thiết kế kiến trúc hệ thống...")
    build_chapter_3(doc)

    print("[5/7] Đang tạo Chương 4: Hiện thực hóa mã nguồn các phân hệ...")
    build_chapter_4(doc)

    print("[6/7] Đang tạo Chương 5: Thử nghiệm thực tế, đánh giá và kiểm chứng bảo mật...")
    build_chapter_5(doc)

    print("[7/7] Đang tạo Chương 6, Tài liệu tham khảo và Phụ lục...")
    build_chapter_6_and_end(doc)

    # Lưu file DOCX chính thức tại thư mục gốc
    output_docx = os.path.abspath('Bao_cao_Bai_tap_lon_PGP.docx')
    doc.save(output_docx)
    print(f"\n✅ Đã xuất tệp DOCX: {output_docx}")
    print(f"   Dung lượng: {os.path.getsize(output_docx):,} bytes")

    # 4. Cập nhật TOC và xuất PDF qua Word COM
    print("\nĐang khởi tạo Microsoft Word COM để cập nhật Mục lục và xuất PDF...")
    try:
        import win32com.client
        word = win32com.client.Dispatch('Word.Application')
        word.Visible = False
        wdoc = word.Documents.Open(output_docx)
        try:
            # Cập nhật bảng Mục lục thật
            try:
                for toc in wdoc.TablesOfContents:
                    toc.Update()
            except Exception as e_toc:
                print(f"Update TablesOfContents note: {e_toc}")
            
            for story in wdoc.StoryRanges:
                try:
                    story.Fields.Update()
                except Exception:
                    pass
            wdoc.Fields.Update()
            wdoc.Save()
            print("✓ Đã cập nhật xong bảng Mục lục (TOC) và các trường tham chiếu.")

            output_pdf = os.path.abspath('Bao_cao_Bai_tap_lon_PGP.pdf')
            # 17 = wdExportFormatPDF
            wdoc.ExportAsFixedFormat(output_pdf, 17)
            print(f"✅ Đã xuất tệp PDF: {output_pdf}")
            print(f"   Dung lượng PDF: {os.path.getsize(output_pdf):,} bytes")
        finally:
            wdoc.Close(False)
            word.Quit()
    except Exception as e:
        print(f"⚠️ Cảnh báo Word COM: {e}")

    # 5. Render các trang mẫu ra file ảnh để kiểm tra trực quan
    print("\nĐang kết xuất các trang mẫu từ PDF sang ảnh bằng PyMuPDF...")
    try:
        import fitz
        output_pdf = os.path.abspath('Bao_cao_Bai_tap_lon_PGP.pdf')
        if os.path.exists(output_pdf):
            pdf_doc = fitz.open(output_pdf)
            total_pages = len(pdf_doc)
            print(f"Tổng số trang trong báo cáo: {total_pages} trang")

            img_dir = os.path.abspath('analysis/rendered_pages')
            os.makedirs(img_dir, exist_ok=True)

            pages_to_render = [
                (0, 'trang_01_bia.png', 'Trang bìa'),
                (1, 'trang_02_muc_luc.png', 'Trang mục lục'),
                (min(6, total_pages - 1), 'trang_chuong1.png', 'Trang đầu Chương 1'),
                (min(12, total_pages - 1), 'trang_co_bang.png', 'Trang có bảng dữ liệu'),
                (min(18, total_pages - 1), 'trang_co_code.png', 'Trang có trích đoạn code'),
                (min(22, total_pages - 1), 'trang_co_hinh.png', 'Trang có sơ đồ hình vẽ')
            ]
            for page_idx, fname, desc in pages_to_render:
                page = pdf_doc.load_page(page_idx)
                pix = page.get_pixmap(dpi=150)
                out_img = os.path.join(img_dir, fname)
                pix.save(out_img)
                print(f"  ✓ Đã lưu ảnh {desc} (Trang {page_idx + 1}): {fname}")
            pdf_doc.close()
    except Exception as e:
        print(f"⚠️ Lỗi render ảnh: {e}")

    print("\n=== HOÀN TẤT TOÀN BỘ QUY TRÌNH ===")

if __name__ == '__main__':
    main()
