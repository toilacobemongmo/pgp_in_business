"""
Tạo Bao_cao_tong_hop_ATTT.docx
Báo cáo tổng hợp 5 kỹ sư — đề tài Enterprise OpenPGP CA & B2B Secure Exchange
"""
import io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from docx import Document
from docx.shared import Pt, RGBColor, Cm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

# ── helpers ──────────────────────────────────────────────────────────────────

def set_heading(doc, text, level=1, center=False):
    h = doc.add_heading(text, level=level)
    if center:
        h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    return h

def add_para(doc, text='', bold=False, italic=False, size=None, color=None,
             center=False, indent=False):
    p = doc.add_paragraph()
    if center:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    if size:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor(*color)
    if indent:
        p.paragraph_format.left_indent = Cm(0.75)
    return p

def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Cm(0.5 + level * 0.5)
    p.add_run(text)
    return p

def add_simple_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = 'Table Grid'
    # header row
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for para in hdr[i].paragraphs:
            for run in para.runs:
                run.bold = True
        tc = hdr[i]._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), '2E4057')
        tcPr.append(shd)
        for para in hdr[i].paragraphs:
            for run in para.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    # data rows
    for row_data in rows:
        row = table.add_row()
        for i, cell_text in enumerate(row_data):
            row.cells[i].text = str(cell_text)
    if col_widths:
        for col_idx, width in enumerate(col_widths):
            for cell in table.columns[col_idx].cells:
                cell.width = Cm(width)
    return table

def add_separator(doc):
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), '2E4057')
    pBdr.append(bottom)
    pPr.append(pBdr)
    return p

# ── document setup ────────────────────────────────────────────────────────────

doc = Document()

# page margins
for section in doc.sections:
    section.top_margin    = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin   = Cm(3.0)
    section.right_margin  = Cm(2.0)

# default font
style = doc.styles['Normal']
style.font.name = 'Times New Roman'
style.font.size = Pt(12)

# ── TRANG BÌA ─────────────────────────────────────────────────────────────────

doc.add_paragraph()
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('TRƯỜNG ĐẠI HỌC CÔNG NGHỆ')
run.font.size = Pt(14)
run.font.name = 'Times New Roman'

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('KHOA CÔNG NGHỆ THÔNG TIN')
run.font.size = Pt(14)
run.bold = True
run.font.name = 'Times New Roman'

doc.add_paragraph()
doc.add_paragraph()
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('BÁO CÁO TỔNG HỢP')
run.font.size = Pt(20)
run.bold = True
run.font.color.rgb = RGBColor(0x2E, 0x40, 0x57)
run.font.name = 'Times New Roman'

doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('AN TOÀN THÔNG TIN — BÀI TẬP LỚN')
run.font.size = Pt(16)
run.bold = True
run.font.name = 'Times New Roman'

doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('Enterprise OpenPGP Certificate Authority &\nB2B Secure Exchange')
run.font.size = Pt(14)
run.italic = True
run.font.name = 'Times New Roman'

doc.add_paragraph()
doc.add_paragraph()
doc.add_paragraph()

# info table
info_table = doc.add_table(rows=4, cols=2)
info_table.alignment = WD_TABLE_ALIGNMENT.CENTER
info_data = [
    ('Học phần', 'Cơ sở An Toàn Thông Tin (INT3307)'),
    ('Nhóm thực hiện', 'Nhóm 5 kỹ sư'),
    ('Ngày hoàn thành', '12 tháng 11 năm 2026'),
    ('Phiên bản', '1.0 — Bản cuối'),
]
for i, (label, value) in enumerate(info_data):
    info_table.rows[i].cells[0].text = label
    info_table.rows[i].cells[1].text = value
    for run in info_table.rows[i].cells[0].paragraphs[0].runs:
        run.bold = True

doc.add_page_break()

# ── MỤC LỤC tóm tắt ──────────────────────────────────────────────────────────

set_heading(doc, 'MỤC LỤC', level=1)

toc_items = [
    'I.    TỔNG QUAN DỰ ÁN',
    'II.   KỸ SƯ 1 — Pipeline Mật Mã Lai (Hybrid Cryptographic Pipeline)',
    'III.  KỸ SƯ 2 — Bảo Vệ Root CA bằng Quorum (Shamir) & Seal/Unseal',
    'IV.   KỸ SƯ 3 — Cây Merkle Kiểm Toán Tính Toàn Vẹn Nhật Ký',
    'V.    KỸ SƯ 4 — Phân Tích Web of Trust (WoT)',
    'VI.   KỸ SƯ 5 — Phân Tích Gói Tin OpenPGP & Kiểm Tra Tuân Thủ RFC',
    'VII.  ĐÁNH GIÁ TÍCH HỢP & ĐIỂM GIAO NHAU',
    'VIII. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN',
    'IX.   TÀI LIỆU THAM KHẢO',
]
for item in toc_items:
    add_bullet(doc, item)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
# PHẦN I — TỔNG QUAN
# ═══════════════════════════════════════════════════════════════════════════════

set_heading(doc, 'I. TỔNG QUAN DỰ ÁN', level=1)

add_para(doc,
    'Đề tài xây dựng một hệ thống Tổ chức Chứng thực (CA) doanh nghiệp theo chuẩn OpenPGP '
    'kết hợp kênh trao đổi thông điệp bảo mật giữa các đối tác (B2B Secure Exchange). '
    'Hệ thống được phân rã thành năm phân hệ độc lập, mỗi phân hệ do một kỹ sư chuyên trách '
    'thiết kế, triển khai và kiểm thử. Báo cáo này tổng hợp toàn bộ kết quả từ năm phân hệ '
    'và đánh giá sự phối hợp kỹ thuật giữa chúng.')

set_heading(doc, '1.1 Kiến trúc tổng thể', level=2)

add_para(doc,
    'Hệ thống vận hành theo mô hình phân tầng, trong đó Root CA là trung tâm tin cậy '
    'và mọi hoạt động mật mã đều phải đi qua một trong năm phân hệ:')

arch_rows = [
    ('Kỹ sư 1 (Kỹ sư 5)', 'Hybrid Cryptographic Pipeline', 'Sign-then-Encrypt với Ed25519 + X25519 ECDH, xử lý stream tệp lớn không giới hạn RAM'),
    ('Kỹ sư 2', 'Root CA Quorum & Seal/Unseal', 'Bảo vệ khóa riêng Root CA bằng Shamir 3-of-5, TTL tự niêm phong, xác thực role'),
    ('Kỹ sư 3', 'Merkle Audit Log', 'Cây Merkle RFC 6962 cam kết tính toàn vẹn của nhật ký hệ thống, inclusion proof O(log N)'),
    ('Kỹ sư 4', 'Web of Trust (WoT)', 'Đồ thị tin cậy Dijkstra có trọng số, phát hiện điểm nghẽn, tìm đường độc lập'),
    ('Kỹ sư 5', 'OpenPGP Packet Inspector', 'Bộ đọc nhị phân theo RFC 4880/9580, kiểm tra ranh giới, phát hiện thuật toán yếu'),
]
add_simple_table(doc,
    ['Phân hệ', 'Tên', 'Chức năng chính'],
    arch_rows,
    col_widths=[3.5, 4.5, 8.5])

doc.add_paragraph()
add_para(doc,
    'Toàn bộ backend được viết bằng Node.js ES Module, frontend bằng React/Vite. '
    'Dữ liệu được lưu trong file JSON (db.json) gitignored, và mảnh khóa Shamir '
    'trong thư mục backend/data/quorum-shards/ với quyền 0600.')

set_heading(doc, '1.2 Tóm tắt kết quả kiểm thử tổng hợp', level=2)

test_rows = [
    ('Kỹ sư 2 — Quorum CA', 'engineer2-quorum-ca.test.mjs', '46 / 46', 'S1–S21 (Shamir), C0–C9 (trạng thái CA)'),
    ('Kỹ sư 2 — API Smoke', 'engineer2-api-smoke.mjs', '21 / 21', 'A1–A9, vòng đời SEALED→issue→revoke→seal'),
    ('Kỹ sư 2 — Auth/Role', 'engineer2-api-auth.test.mjs', '107 / 107', 'B1–B13, 401/403/200 mọi endpoint'),
    ('Kỹ sư 2 — Shard I/O', 'engineer2-quorum-shards.test.mjs', '47 / 47', 'Ghi/đọc/xóa file mảnh 0600'),
    ('Kỹ sư 2 — Demo Gate', 'engineer2-demo-key-gate.test.mjs', '48 / 48', 'Cờ DEMO_PLAINTEXT_KEYS ON/OFF'),
    ('Kỹ sư 2 — TTL Expiry', 'engineer2-ttl-expiry.test.mjs', '22 / 22', 'E1–E8, TTL = 2s, 423 sau hết hạn'),
    ('Kỹ sư 3 — Merkle', 'merkle-engine.test.js', '20 / 20', 'Nhóm 01–20, 100k bản ghi'),
    ('Kỹ sư 4 — WoT', 'wot-analyzer.test.js', '12 / 12', 'Dijkstra, bottleneck, independent flow'),
    ('Kỹ sư 5 — Packet Inspector', 'run-demo.js', '33 / 33', 'CRC, MPI, partial body, weak hash, GPG verify'),
    ('Kỹ sư 5 — Hybrid Pipeline', 'test-engineer5.js', 'Manual', 'Sign+Encrypt, Surreptitious Forwarding, Stream 2GB'),
]
add_simple_table(doc,
    ['Phân hệ', 'File kiểm thử', 'Kết quả', 'Phạm vi'],
    test_rows,
    col_widths=[4.0, 5.5, 2.0, 5.0])

doc.add_paragraph()
p = doc.add_paragraph()
run = p.add_run('Tổng: 356 assertion kiểm thử tự động PASS, 0 FAIL (không tính test manual Pipeline Kỹ sư 1/5).')
run.bold = True

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
# PHẦN II — KỸ SƯ 1 / 5 (Hybrid Cryptographic Pipeline)
# ═══════════════════════════════════════════════════════════════════════════════

set_heading(doc, 'II. KỸ SƯ 1 (5) — HYBRID CRYPTOGRAPHIC PIPELINE', level=1)

add_para(doc,
    'Phân hệ do Kỹ sư 5 (Minh Quân) phụ trách, tập trung vào pipeline mật mã lai '
    'Sign-then-Encrypt xử lý tệp lớn (thử nghiệm đến 2 GB) với RAM RSS < 50 MB. '
    'File nguồn: backend/pgp-service.js (phiên bản KySu5), backend/server.js, '
    'tests/test-engineer5.js, tests/benchmark-stream.js.')

set_heading(doc, '2.1 Pipeline mật mã 4 tầng', level=2)

add_para(doc,
    'Pipeline áp dụng chuẩn RFC 9580 (Crypto-Refresh) theo thứ tự Sign-then-Encrypt:')

pipeline_rows = [
    ('Tầng 1 — Ký số', 'Ed25519 (RFC 9580 Algo ID 27 / RFC 8032)',
     'Signature Packet Tag 2 trên dữ liệu gốc, nhúng Subpacket 35 (Intended Recipient Fingerprint)'),
    ('Tầng 2 — Nén', 'ZLIB (RFC 1950, Packet Tag 8)',
     'Nén tổ hợp (Signature + Literal Data) trước mã hóa, giảm băng thông và ẩn kích thước'),
    ('Tầng 3 — Mã hóa', 'AES-256 SEIPD v1 (Tag 18 + MDC) / SEIPD v2 (Tag 20 AEAD)',
     'Session Key 256-bit từ CSPRNG, cấm Tag 9 (không MDC) chống EFail CVE-2017-17688'),
    ('Tầng 4 — Bọc khóa', 'X25519 ECDH (RFC 6637 / RFC 9580 Algo ID 28)',
     'Bí mật chung ECDH với Public Key người nhận, bọc Session Key bằng AES Key Wrap'),
]
add_simple_table(doc,
    ['Tầng', 'Thuật toán', 'Mục đích bảo mật'],
    pipeline_rows,
    col_widths=[3.5, 5.0, 8.0])

set_heading(doc, '2.2 Xử lý stream tệp lớn — Backpressure 64 KB', level=2)

add_para(doc,
    'Thay vì nạp toàn bộ tệp vào RAM bằng fs.readFile(), phân hệ dùng Stream Transformer '
    'có kiểm soát áp lực ngược (Backpressure) với highWaterMark = 64 KB. '
    'Kết quả đo thực tế:')

bench_rows = [
    ('100 MB', '~245.0 MB RSS', '31.4 MB RSS', '285 MB/s', 'ĐẠT — tiết kiệm 87% RAM'),
    ('500 MB', '~1,180.0 MB RSS', '34.1 MB RSS', '310 MB/s', 'ĐẠT — dưới ngưỡng 50 MB'),
    ('1 GB', '~2,340.0 MB RSS (rủi ro crash)', '34.8 MB RSS', '322 MB/s', 'ĐẠT'),
    ('2 GB', 'CRASH — Heap OOM', '36.2 MB RSS', '318 MB/s', 'ĐẠT — ổn định O(1)'),
]
add_simple_table(doc,
    ['Kích thước', 'Nạp toàn bộ (fs.readFile)', 'Streaming 64 KB', 'Thông lượng', 'Đánh giá'],
    bench_rows,
    col_widths=[2.0, 4.5, 3.5, 2.5, 4.0])

set_heading(doc, '2.3 Chống Surreptitious Forwarding', level=2)

add_para(doc,
    'Phân hệ nhúng Subpacket 35 (Intended Recipient Fingerprint) vào Signature Packet. '
    'Khi Bob giải mã gói tin gửi cho Alice rồi chuyển tiếp cho Charlie, hệ thống của Charlie '
    'ném lỗi 403 SECURITY_REJECT ngay lập tức vì Fingerprint trong Subpacket 35 '
    'không khớp với Public Key của Charlie. '
    'Điều này triệt tiêu kịch bản EFail và tấn công chuyển tiếp bí mật (Surreptitious Forwarding).')

set_heading(doc, '2.4 Hạn chế và điểm cần lưu ý', level=2)

for item in [
    'Phân hệ standalone, chưa tích hợp với Root CA Kỹ sư 2 (dùng khóa độc lập).',
    'Test manual — chưa có bộ unit test tự động; benchmark cần chạy lại trên môi trường sản xuất.',
    'Chưa kiểm thử trên Windows (benchmark chạy trên linux/x64 AMD EPYC).',
]:
    add_bullet(doc, item)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
# PHẦN III — KỸ SƯ 2 (Root CA Quorum & Seal/Unseal)
# ═══════════════════════════════════════════════════════════════════════════════

set_heading(doc, 'III. KỸ SƯ 2 — BẢO VỆ ROOT CA BẰNG QUORUM (SHAMIR) & SEAL/UNSEAL', level=1)

add_para(doc,
    'Phân hệ do Kỹ sư 2 phụ trách. Phạm vi gồm backend/shamir-service.js, '
    'backend/pgp-service.js, backend/server.js, backend/store.js, backend/auth.js, '
    'backend/quorum-shard-store.js, backend/demo-mode.js, và các component frontend '
    'tương ứng. Toàn bộ 291 assertion kiểm thử PASS.')

set_heading(doc, '3.1 Lỗ hổng trạng thái ban đầu', level=2)

vuln_rows = [
    ('V1', 'Cao', 'Passphrase Root CA hardcode trong source backend và frontend (5 vị trí)'),
    ('V2', 'Cao', 'Khóa riêng Root CA dùng được bất cứ lúc nào — không có "niêm phong"'),
    ('V3', 'Trung bình', 'Envelope Shamir lộ độ dài chính xác của bí mật (không padding)'),
    ('V4', 'Cao', 'Không phát hiện mảnh bị ghép lẫn giữa hai lần chia khác nhau (Test S7 fail)'),
    ('V5', 'Cao', 'unenvelopeSecret() âm thầm trả về bytes thô khi version ≠ 0x02 (S10/S21 fail)'),
    ('V6', 'Cao', 'Sinh revocation certificate bằng API không tồn tại (openpgp.createRevocationCertificate)'),
    ('V7', 'Trung bình', 'Không có endpoint Unseal/Seal — frontend phải nhập passphrase thủ công'),
]
add_simple_table(doc,
    ['Mã', 'Mức', 'Mô tả'],
    vuln_rows,
    col_widths=[1.0, 2.5, 13.0])

set_heading(doc, '3.2 Thay đổi đã triển khai', level=2)

changes = [
    ('shamir-service.js — Envelope v2 + Session Tag',
     'Cấu trúc: [0x02][sessionTag 8B][lenField 4B BE][secret][padding][tag 16B]\n'
     'Session tag 8 byte ngẫu nhiên nhúng vào envelope và metadata từng mảnh. '
     'Chống ghép lẫn phiên (V4): combine() từ chối mảnh khác sessionTag. '
     'Toàn vẹn: SHA-256 cắt 16 byte, so sánh bằng crypto.timingSafeEqual. '
     'Không còn fallback im lặng (V5): ném lỗi khi sai version/độ dài/tag.'),
    ('pgp-service.js — Máy trạng thái Seal/Unseal',
     'caSession lưu khóa riêng chỉ trong RAM; SEALED là mặc định. '
     'unsealCA(shareKeys) cần đủ k=3 mảnh (3-of-5) để khôi phục passphrase và giải mã khóa. '
     'TTL tự niêm phong lại (CA_UNSEAL_TTL_MS, mặc định 5 phút). '
     'readCaPassphrase() đọc từ biến môi trường CA_PASSPHRASE ≥ 12 ký tự — xóa passphrase hardcode (V1). '
     'requireUnsealed() ném lỗi statusCode=423, code=CA_SEALED.'),
    ('server.js — API & ngữ nghĩa lỗi',
     'Thêm POST /api/ca/unseal và POST /api/ca/seal. '
     'handleServiceError() ánh xạ CA_SEALED → HTTP 423 Locked. '
     'Route bản tin nhận senderIsCA/recipientIsCA.'),
    ('auth.js — Xác thực token + phân quyền role',
     '24 endpoint được gắn guard authenticate()+authorize(). '
     'Bốn role: ADMIN, OFFICER, PARTNER, PUBLIC. '
     'Token-based Bearer authentication, timing-safe comparison.'),
    ('quorum-shard-store.js — Ghi mảnh ra file 0600',
     'Mảnh Shamir được ghi vào backend/data/quorum-shards/ với quyền 0600 (gitignored). '
     'initCA() gọi writeShards() kèm cảnh báo bàn giao.'),
    ('demo-mode.js — Cờ DEMO_PLAINTEXT_KEYS',
     'demoPrivateKeyArmored chỉ trả về khi DEMO_PLAINTEXT_KEYS=true (mặc định OFF). '
     '.gitignore bổ sung db.json; thêm db.example.json làm mẫu không có khóa riêng.'),
]
for title, desc in changes:
    p = doc.add_paragraph()
    run = p.add_run(title)
    run.bold = True
    add_para(doc, desc, indent=True)

set_heading(doc, '3.3 Kết quả kiểm thử', level=2)

ks2_test_rows = [
    ('engineer2-quorum-ca.test.mjs', '46 / 46', 'S1–S21 (Shamir v2), C0–C9 (trạng thái CA)'),
    ('engineer2-api-smoke.mjs', '21 / 21', 'A1–A9, HTTP thật trên port 5001, DB tạm'),
    ('engineer2-api-auth.test.mjs', '107 / 107', 'B1–B13, 401/403/200 mọi endpoint có guard'),
    ('engineer2-quorum-shards.test.mjs', '47 / 47', 'Ghi/đọc/xóa file mảnh 0600'),
    ('engineer2-demo-key-gate.test.mjs', '48 / 48', 'Cờ DEMO_PLAINTEXT_KEYS ON và OFF'),
    ('engineer2-ttl-expiry.test.mjs', '22 / 22', 'E1–E8: TTL=2s, unseal, chờ 2.15s, 423, re-unseal'),
    ('TỔNG', '291 / 291', ''),
]
add_simple_table(doc,
    ['File kiểm thử', 'Kết quả', 'Phạm vi'],
    ks2_test_rows,
    col_widths=[7.0, 2.5, 7.0])

set_heading(doc, '3.4 Hạn chế còn lại', level=2)

ks2_limits = [
    'TTL chỉ nằm trong RAM — kill tiến trình xóa khóa (fail-closed, nhưng không có recovery tự động).',
    'sessionTag không chống được kẻ tấn công chủ động; tag SHA-256 không có khóa, chống được vô tình.',
    'Revocation certificate do chính chủ khóa tự ký (self-revocation) — giới hạn của openpgp v6.',
    'Mảnh khóa trên đĩa dạng plaintext (0600 chỉ chặn user cùng máy); chưa mã hóa bằng khóa người giữ.',
    'Audit log ghi actor = "Multi-Admin Quorum" cố định — không truy được về từng cá nhân.',
    'Chưa kiểm thử giao diện React (3 nút Unseal/Seal/View-f(0)) bằng browser automation.',
]
for item in ks2_limits:
    add_bullet(doc, item)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
# PHẦN IV — KỸ SƯ 3 (Merkle Audit Log)
# ═══════════════════════════════════════════════════════════════════════════════

set_heading(doc, 'IV. KỸ SƯ 3 — CÂY MERKLE KIỂM TOÁN TÍNH TOÀN VẸN NHẬT KÝ', level=1)

add_para(doc,
    'Phân hệ do Kỹ sư 3 (Nguyễn Thế Dương) phụ trách. File nguồn: backend/merkle-engine.js. '
    'Module không có phụ thuộc npm bên ngoài; kiểm thử trên Node.js ≥ 18.')

set_heading(doc, '4.1 Cơ sở lý thuyết — Cây Merkle RFC 6962', level=2)

add_para(doc,
    'Mỗi lá đại diện một bản ghi nhật ký. Các hàm băm được định nghĩa rõ ràng:')
for formula in [
    'H_empty = SHA256(chuỗi byte rỗng)',
    'H_leaf  = SHA256(0x00 ║ UTF8(CanonicalJSON(record)))',
    'H_node  = SHA256(0x01 ║ leftHash ║ rightHash)',
]:
    add_bullet(doc, formula)

add_para(doc,
    'Hai tiền tố 0x00/0x01 phân biệt lá và nút trong để tránh second-preimage attack. '
    'Cây năm lá được tổ chức theo lũy thừa 2 lớn nhất nhỏ hơn N — không nhân đôi lá cuối '
    '(khác cách triển khai Bitcoin).')

set_heading(doc, '4.2 Chuẩn hóa JSON (RFC 8785)', level=2)

add_para(doc,
    'Hàm canonicalize() sắp xếp khóa theo thứ tự UTF-16, giữ thứ tự phần tử mảng, '
    'và ghép chuỗi từng thuộc tính thay vì JSON.stringify (tránh JavaScript đưa '
    'khóa dạng số về thứ tự số học). '
    'Từ chối NaN, Infinity, chu trình, surrogate đơn, getter, và các kiểu không phải JSON thuần.')

set_heading(doc, '4.3 API và độ phức tạp', level=2)

api_rows = [
    ('new MerkleEngine(records)', 'Tạo cây từ mảng theo đúng thứ tự', 'O(N)'),
    ('append(record)', 'Thêm lá, cập nhật đường biên phải', 'O(log N)'),
    ('getRootHash() / checkpoint()', 'Root hash hoặc bộ thông tin đối chiếu', 'O(1)'),
    ('getProof(index)', 'Sinh inclusion proof', 'O(log N)'),
    ('verifyProof(record, path, root)', 'Kiểm tra đường băm', 'O(log N)'),
    ('verifyInclusion(record, proof, cp)', 'Kiểm tra kèm metadata', 'O(log N)'),
    ('MerkleEngine.verifyLedger(logs, cp)', 'Đối soát toàn bộ log với checkpoint', 'O(N)'),
]
add_simple_table(doc,
    ['Phương thức', 'Mô tả', 'Độ phức tạp'],
    api_rows,
    col_widths=[5.5, 8.5, 2.5])

set_heading(doc, '4.4 Kết quả kiểm thử và benchmark', level=2)

add_para(doc, '20/20 nhóm kiểm thử PASS, bao gồm:')
for item in [
    'Nhóm 01–09: Cây rỗng, vector SHA-256, cây 1 lá, Unicode, số thực, chu trình, getter.',
    'Nhóm 10–11: Root mọi vị trí lá với N=1..128; cây 5 lá chia 4+1.',
    'Nhóm 12–15: Phát hiện sửa log, hash, root, hướng proof, metadata, độ dài proof.',
    'Nhóm 16–20: Không rò tham chiếu; proof cũ/mới; API tương thích mẫu đặc tả; root giả bị từ chối.',
]:
    add_bullet(doc, item)

add_para(doc)
bench_ks3 = [
    ('100,000 bản ghi', 'AMD EPYC 9V74 80-Core (linux/x64)'),
    ('Dựng cây ban đầu', '1,156.6 ms'),
    ('Sinh inclusion proof', '0.181 ms'),
    ('Kiểm tra proof (trung bình 1,000 lượt)', '0.052 ms/lượt'),
    ('Thêm 1 bản ghi', '0.683 ms'),
    ('Số hash trong proof', '17 (= log₂(100,000))'),
    ('Kích thước proof JSON', '1,710 byte'),
    ('RSS tại thời điểm đọc', '292.58 MiB'),
]
add_simple_table(doc,
    ['Thông số', 'Giá trị'],
    bench_ks3,
    col_widths=[7.0, 9.5])

set_heading(doc, '4.5 Hạn chế và hướng tích hợp', level=2)
for item in [
    'Module độc lập — cần nhóm trưởng ghép với backend/store.js và kết nối tầng lưu trữ nhật ký.',
    'Chưa có bằng chứng mật mã cho "chỉ thêm" liên phiên; muốn kiểm toán lịch sử dài hạn cần checkpoint bên ngoài.',
    'Cây không ngăn ghi sự kiện giả — chỉ phát hiện sai lệch khi so với checkpoint đáng tin cậy.',
    'Chưa kiểm thử trên môi trường sản xuất; đã thử trên Node.js 24.22.1 linux/x64.',
]:
    add_bullet(doc, item)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
# PHẦN V — KỸ SƯ 4 (Web of Trust)
# ═══════════════════════════════════════════════════════════════════════════════

set_heading(doc, 'V. KỸ SƯ 4 — PHÂN TÍCH WEB OF TRUST (WoT)', level=1)

add_para(doc,
    'Phân hệ do Kỹ sư 4 phụ trách. File nguồn: backend/wot-analyzer.js (phiên bản KySu4). '
    'Module CommonJS, không phụ thuộc runtime bên ngoài.')

set_heading(doc, '5.1 Mô hình đồ thị Dijkstra có trọng số', level=2)

add_para(doc,
    'Đỉnh V là fingerprint khóa công khai hoặc User ID; cạnh có hướng E là certification '
    'từ signer đến subject. Trọng số theo loại chứng thực (RFC 4880 §5.2.3.14):')

weight_rows = [
    ('0x10 — Generic Certification', '0.50'),
    ('0x11 — Persona Certification', '0.65'),
    ('0x12 — Casual Certification', '0.80'),
    ('0x13 — Positive Certification', '0.95'),
]
add_simple_table(doc,
    ['Loại chứng thực', 'Trọng số'],
    weight_rows,
    col_widths=[8.0, 3.0])

add_para(doc)
add_para(doc,
    'Với các cạnh song song (nhiều chứng thực cùng nguồn-đích): '
    'w_parallel = 1 − Π(1 − w_i). '
    'Capacity của đường P gồm k cạnh: C(P) = Πwᵢ × γ^(k−1), γ = 0.85. '
    'Vì ln là hàm tăng trên (0,1], argmax C(P) = argmin[−ln C(P)], '
    'chi phí cộng được và không âm — Dijkstra duy trì bất biến tối ưu. '
    'Giới hạn hop ≤ 4 ngăn đường tin cậy vô nghĩa.')

set_heading(doc, '5.2 Luồng độc lập và điểm nghẽn (SPoF)', level=2)

add_para(doc,
    'Cơ chế lặp tìm đường tốt nhất rồi loại các cạnh/nút nội bộ đã dùng '
    'để tạo các đường node-disjoint. Aggregate capacity: 1 − Π(1 − Cᵢ). '
    'Phát hiện điểm nghẽn bằng thuật toán Tarjan (SCC) — khác bản trong dự án '
    'chỉ dùng đếm bậc nút.')

set_heading(doc, '5.3 Lưu ý quan trọng: Hai phiên bản wot-analyzer.js', level=2)

diff_rows = [
    ('Nguồn gốc trọng số', '0.95/0.8/0.75 — cứng theo quan hệ', 'Suy từ loại chứng thực 0x10–0x13 (RFC 4880)'),
    ('Hàm tối ưu', 'Số hop ít nhất', 'Capacity có hệ số suy giảm γ=0.85'),
    ('Luồng độc lập', 'Không có findIndependentTrustFlow', 'Có (node-disjoint paths)'),
    ('Phát hiện bottleneck', 'Đếm bậc nút (degree)', 'Tarjan SCC'),
    ('Điểm tin cậy', 'Khác trên cùng dữ liệu', '—'),
]
add_simple_table(doc,
    ['Tiêu chí', 'backend/wot-analyzer.js (dự án hiện tại)', 'wot-analyzer.js (Kỹ sư 4 bàn giao)'],
    diff_rows,
    col_widths=[4.0, 6.0, 6.5])

add_para(doc)
add_para(doc,
    'Bảng đối chiếu đầy đủ trong plans/engineer2-spec.md §7. '
    'Khuyến nghị: thay backend/wot-analyzer.js bằng phiên bản Kỹ sư 4 '
    'trước khi sử dụng WoT trong quyết định tin cậy thực tế.',
    italic=True, color=(0xC0, 0x20, 0x20))

set_heading(doc, '5.4 Kết quả kiểm thử', level=2)

add_para(doc,
    'Bộ test dùng node:test và node:assert, bao phủ: đồ thị rỗng, chu trình, đa cạnh, '
    'phân mảnh, floating-point precision, điều kiện fail-closed (định danh rỗng, '
    'xác suất ngoài [0,1], gamma không dương). 12/12 test PASS.')

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
# PHẦN VI — KỸ SƯ 5 (OpenPGP Packet Inspector)
# ═══════════════════════════════════════════════════════════════════════════════

set_heading(doc, 'VI. KỸ SƯ 5 — PHÂN TÍCH GÓI TIN OPENPGP & KIỂM TRA TUÂN THỦ RFC', level=1)

add_para(doc,
    'Phân hệ do Kỹ sư 5 phụ trách. File nguồn: backend/pgp-packet-inspector.js. '
    'Bộ đọc nhị phân thuần JavaScript, không phụ thuộc thư viện OpenPGP bên ngoài — '
    'mỗi bước dịch bit và byte đều có thể kiểm chứng độc lập.')

set_heading(doc, '6.1 Phạm vi triển khai', level=2)

scope_rows = [
    ('Header', 'Old và New; độ dài xác định; ghép partial body; Old indeterminate'),
    ('ASCII Armor', 'Một khối MESSAGE/PUBLIC KEY BLOCK/SIGNATURE; Base64; chẩn đoán CRC-24'),
    ('MPI', 'Đọc bit length, byte length và giá trị hex; kiểm tra thiếu dữ liệu'),
    ('Public key', 'Trường v4 và v6; RSA, ECC legacy (Ed25519Legacy/Curve25519Legacy), native 32 byte'),
    ('Signature', 'Thân chữ ký v4; MPI theo mã thuật toán'),
    ('Subpacket', 'Tách mọi phần tử; giải nghĩa thời gian tạo, issuer key ID và issuer fingerprint'),
    ('Chính sách', 'Phát hiện MD5 (mã 2) hoặc SHA-1 (mã 1) trong trường băm chữ ký v4 → WEAK_SIGNATURE_HASH'),
    ('Ngoài phạm vi', 'Xác minh mật mã, giải mã, giải nén, thân chữ ký v6, toàn bộ luật thứ tự packet'),
]
add_simple_table(doc,
    ['Hạng mục', 'Mức hỗ trợ'],
    scope_rows,
    col_widths=[3.5, 13.0])

set_heading(doc, '6.2 Kiểm tra ranh giới và giới hạn tài nguyên', level=2)

add_para(doc,
    'Mọi thao tác lấy dữ liệu đều đi qua take(n) với kiểm tra Number.isSafeInteger '
    'và điều kiện n > buffer.length − pos. '
    'Giới hạn thiết kế: đầu vào tối đa 16 MiB, 10,000 packet, 10,000 phần tử subpacket. '
    'Phát hiện partial body thiếu phần kết thúc, MPI bị cắt, và subpacket độ dài 0.')

set_heading(doc, '6.3 Kết quả kiểm thử — 33/33 PASS', level=2)

inspector_rows = [
    ('1–13', 'CRC vector; New/Old header mọi dạng; partial body; reject partial signature'),
    ('14–19', 'Truncated body; MPI 9 bit; MPI bị cắt; subpacket 224; subpacket độ dài 0'),
    ('20–23', 'Chặn SHA-1 (mã 1) và MD5 (mã 2); Synthetic SHA-256; unknown critical subpacket'),
    ('24–26', 'CRC khớp; CRC lệch chỉ cảnh báo; CRC vắng chấp nhận'),
    ('27–29', 'Chữ ký v6 chưa hỗ trợ; khóa v6 Algo 25 (X25519); khóa v6 Algo 27 (Ed25519)'),
    ('30–33', 'Armor Base64 lỗi; GPG từ chối tài liệu sửa; RSA thật được parse + GPG xác minh; ECC tạo bởi Node nhận ra'),
]
add_simple_table(doc,
    ['Ca', 'Nội dung'],
    inspector_rows,
    col_widths=[1.5, 15.0])

add_para(doc)
add_para(doc,
    'Ca kiểm thử 32 (RSA detached signature được GPG verify) và 33 (Node ECC keys) '
    'xác nhận parser hoạt động đúng với tệp thực tế, không chỉ dữ liệu tổng hợp.',
    italic=True)

set_heading(doc, '6.4 Hạn chế', level=2)

for item in [
    'Chưa xác minh mật mã nội bộ — chỉ đọc và phân loại, cần GnuPG để kiểm tra chữ ký thật.',
    'Chưa kiểm tra đầy đủ thứ tự packet, ngữ nghĩa từng thuật toán, chuẩn tắc MPI theo ngữ cảnh.',
    'Giải nén cần giới hạn cả đầu vào lẫn sau giải nén (zip bomb); chưa triển khai.',
    'Chưa xây dựng corpus và thực hiện kiểm thử vi sai với các parser OpenPGP khác.',
]:
    add_bullet(doc, item)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
# PHẦN VII — ĐÁNH GIÁ TÍCH HỢP
# ═══════════════════════════════════════════════════════════════════════════════

set_heading(doc, 'VII. ĐÁNH GIÁ TÍCH HỢP & ĐIỂM GIAO NHAU', level=1)

set_heading(doc, '7.1 Điểm giao nhau kỹ thuật giữa các phân hệ', level=2)

cross_rows = [
    ('Root CA fingerprint',
     'Kỹ sư 2 (trust anchor)',
     'Kỹ sư 1 (Subpacket 35), Kỹ sư 4 (source node WoT)',
     'API /api/ca/status trả publicKeyArmored và fingerprint'),
    ('Nhật ký kiểm toán',
     'Kỹ sư 2 (logAudit() → db.audit_logs)',
     'Kỹ sư 3 (Merkle Audit)',
     'Cần ghép: MerkleEngine.append() cho mỗi bản ghi logAudit'),
    ('Chứng chỉ nhân viên',
     'Kỹ sư 2 (issueCertificate)',
     'Kỹ sư 4 (nút trong WoT)',
     'certRecord.fingerprint đưa vào edges của wot-analyzer'),
    ('Gói tin OpenPGP',
     'Kỹ sư 1 (tạo), Kỹ sư 2 (ký/mã hóa)',
     'Kỹ sư 5 (phân tích)',
     'Kỹ sư 5 có thể kiểm tra tuân thủ trên output của Kỹ sư 1/2'),
]
add_simple_table(doc,
    ['Dữ liệu/Dịch vụ', 'Nguồn', 'Đích', 'Điểm ghép'],
    cross_rows,
    col_widths=[3.5, 3.5, 3.5, 6.0])

set_heading(doc, '7.2 Rủi ro tích hợp', level=2)

risk_rows = [
    ('Cao', 'wot-analyzer.js không phải thuật toán Kỹ sư 4',
     'Hai bản cho điểm tin cậy khác nhau trên cùng dữ liệu',
     'Thay backend/wot-analyzer.js bằng phiên bản Kỹ sư 4'),
    ('Trung bình', 'Merkle chưa ghép với backend/store.js',
     'Nhật ký có thể bị sửa mà không phát hiện được',
     'Gọi MerkleEngine.append() trong JsonStore.logAudit()'),
    ('Thấp', 'Pipeline Kỹ sư 1 độc lập với Root CA Kỹ sư 2',
     'B2B message không qua quorum gate',
     'Tích hợp unsealCA() vào HybridPgpService'),
    ('Thấp', 'Mảnh khóa Shamir trên đĩa dạng plaintext',
     'Ai đọc được thư mục là đủ ngưỡng k để unseal',
     'Mã hóa mảnh bằng khóa riêng của từng người giữ'),
]
add_simple_table(doc,
    ['Mức', 'Rủi ro', 'Hậu quả', 'Khuyến nghị'],
    risk_rows,
    col_widths=[1.5, 4.5, 5.0, 5.5])

set_heading(doc, '7.3 Điểm mạnh tổng thể', level=2)

for item in [
    '291 assertion tự động PASS cho phân hệ Kỹ sư 2 — độ bao phủ cao nhất trong nhóm.',
    '33 ca kiểm thử Packet Inspector bao gồm tệp thực tế được GnuPG xác minh.',
    'Kỹ sư 3 đo thực tế 100k bản ghi với inclusion proof O(log N).',
    'Kỹ sư 4 cung cấp thuật toán Dijkstra chuẩn RFC 4880 với trọng số theo loại chứng thực.',
    'Kỹ sư 1/5 chứng minh xử lý tệp 2 GB với RSS < 50 MB — đủ cho môi trường doanh nghiệp.',
    'Mọi phân hệ đều có file README và bàn giao rõ ràng trước khi tích hợp.',
]:
    add_bullet(doc, item)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
# PHẦN VIII — KẾT LUẬN
# ═══════════════════════════════════════════════════════════════════════════════

set_heading(doc, 'VIII. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN', level=1)

set_heading(doc, '8.1 Kết luận', level=2)

add_para(doc,
    'Nhóm đã hoàn thành năm phân hệ độc lập tạo thành một hệ thống CA doanh nghiệp '
    'theo chuẩn OpenPGP với các tính năng bảo mật cốt lõi: '
    'Seal/Unseal quorum, pipeline mật mã lai, kiểm toán Merkle, '
    'phân tích Web of Trust, và bộ đọc gói tin byte-level. '
    'Tổng cộng 356 assertion kiểm thử tự động PASS, 0 FAIL.')

add_para(doc,
    'Phân hệ quan trọng nhất về bảo mật là Kỹ sư 2, '
    'với 7 lỗ hổng được xác định và vá bằng bằng chứng thực nghiệm. '
    'Phân hệ có benchmark thuyết phục nhất là Kỹ sư 1/5 với dữ liệu RAM O(1) trên 2 GB. '
    'Phân hệ cần ưu tiên tích hợp nhất là Kỹ sư 3 (Merkle) và '
    'thay thế thuật toán Kỹ sư 4 (WoT).')

set_heading(doc, '8.2 Hướng phát triển', level=2)

for item in [
    'Tích hợp MerkleEngine.append() vào JsonStore.logAudit() để có nhật ký chống sửa.',
    'Thay backend/wot-analyzer.js bằng phiên bản chuẩn RFC 4880 của Kỹ sư 4.',
    'Mã hóa mảnh Shamir bằng khóa riêng của từng người giữ (HSM hoặc GPG-encrypted).',
    'Tích hợp Pipeline Kỹ sư 1 với quorum gate Kỹ sư 2 cho B2B message thực tế.',
    'Xây dựng corpus và thực hiện kiểm thử vi sai Packet Inspector với các parser khác.',
    'Triển khai browser automation test cho UI Unseal/Seal/WoT.',
    'Chuyển sang HMAC (thay SHA-256 không có khóa) cho tag toàn vẹn trong Shamir envelope.',
]:
    add_bullet(doc, item)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
# PHẦN IX — TÀI LIỆU THAM KHẢO
# ═══════════════════════════════════════════════════════════════════════════════

set_heading(doc, 'IX. TÀI LIỆU THAM KHẢO', level=1)

refs = [
    '[1] Wouters et al. RFC 9580 — OpenPGP (Crypto-Refresh). IETF, July 2024. '
    'https://www.rfc-editor.org/rfc/rfc9580.html',
    '[2] Callas et al. RFC 4880 — OpenPGP Message Format. IETF, November 2007. '
    'https://www.rfc-editor.org/rfc/rfc4880.html',
    '[3] Josefsson & Liusvaara. RFC 8032 — Edwards-Curve Digital Signature Algorithm (EdDSA). '
    'IETF, January 2017.',
    '[4] Langley et al. RFC 7748 — Elliptic Curves for Security. IETF, January 2016.',
    '[5] Laurie, Langley, Kasper. RFC 6962 — Certificate Transparency, §2.1. IETF, June 2013.',
    '[6] Rundgren, Jordan, Erdtman. RFC 8785 — JSON Canonicalization Scheme (JCS), §3.2. IETF, 2020.',
    '[7] RFC Editor. Errata của RFC 9580, Errata 8454 (biểu diễn chữ ký native). '
    'https://www.rfc-editor.org/errata/rfc9580',
    '[8] OpenPGP.js. Tài liệu chính thức v6. https://docs.openpgpjs.org/',
    '[9] GnuPG. Operational GPG Commands. https://gnupg.org/documentation/manuals/gnupg/',
    '[10] Node.js. Buffer API & Crypto API. https://nodejs.org/api/buffer.html',
    '[11] OpenSSL / NIST. FIPS 180-4 Secure Hash Standard (SHA-256).',
    '[12] DAC_TA_PHAN_CONG_KY_THUAT_5_KY_SU_PGP.docx — Tài liệu phân công kỹ thuật nội bộ nhóm.',
]
for r in refs:
    add_bullet(doc, r)

add_separator(doc)
add_para(doc)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(f'Báo cáo được tạo tự động ngày {datetime.date.today().strftime("%d/%m/%Y")}.')
run.italic = True
run.font.size = Pt(10)

# ── save ──────────────────────────────────────────────────────────────────────

out = 'Bao_cao_tong_hop_ATTT.docx'
doc.save(out)
print(f'Saved: {out}')
