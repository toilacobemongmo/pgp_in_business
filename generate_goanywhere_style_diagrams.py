import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, Polygon, Circle, Rectangle
import os

os.makedirs('diagrams', exist_ok=True)

def draw_document(ax, x, y, width=0.85, height=1.15, color='#718096', has_lines=True):
    """Vẽ icon tài liệu có góc gấp chuẩn như GoAnywhere MFT"""
    fold = 0.24
    pts = [
        [x - width/2, y - height/2],
        [x - width/2, y + height/2],
        [x + width/2 - fold, y + height/2],
        [x + width/2, y + height/2 - fold],
        [x + width/2, y - height/2]
    ]
    doc = Polygon(pts, closed=True, facecolor='white', edgecolor=color, linewidth=2.4, zorder=3)
    ax.add_patch(doc)
    # Góc gấp
    fold_pts = [
        [x + width/2 - fold, y + height/2],
        [x + width/2 - fold, y + height/2 - fold],
        [x + width/2, y + height/2 - fold]
    ]
    fold_poly = Polygon(fold_pts, closed=True, facecolor='#EDF2F7', edgecolor=color, linewidth=1.8, zorder=4)
    ax.add_patch(fold_poly)
    # Các dòng kẻ bên trong
    if has_lines:
        line_color = '#38A169'
        line_xs = [x - width/2 + 0.16, x + width/2 - 0.16]
        for i, ly in enumerate([y + 0.18, y - 0.05, y - 0.28]):
            ax.plot([line_xs[0], line_xs[1] - (0.16 if i==0 else 0)], [ly, ly], 
                    color=line_color, linewidth=2.2, zorder=4, solid_capstyle='round')

def draw_lock(ax, x, y, radius=0.25, color='#38A169'):
    """Vẽ icon ổ khóa bảo mật"""
    body = FancyBboxPatch((x - radius*0.8, y - radius*1.1), radius*1.6, radius*1.3,
                          boxstyle="round,pad=0.04,rounding_size=0.08",
                          facecolor='white', edgecolor=color, linewidth=2.4, zorder=5)
    ax.add_patch(body)
    shackle = patches.Arc((x, y + radius*0.2), radius*0.9, radius*1.1, angle=0, theta1=0, theta2=180,
                          color=color, linewidth=2.4, zorder=5)
    ax.add_patch(shackle)
    hole = Circle((x, y - radius*0.4), radius*0.18, facecolor=color, edgecolor='none', zorder=6)
    ax.add_patch(hole)

def draw_key(ax, x, y, color='#48BB78', label='Public Key', sublabel=''):
    """Vẽ icon chìa khóa nghiêng kèm nhãn phân biệt chủ sở hữu"""
    rad = 0.18
    ring = Circle((x - 0.25, y + 0.14), rad, facecolor='white', edgecolor=color, linewidth=2.4, zorder=5)
    ax.add_patch(ring)
    inner_ring = Circle((x - 0.25, y + 0.14), rad*0.45, facecolor='white', edgecolor=color, linewidth=1.6, zorder=6)
    ax.add_patch(inner_ring)
    # Shaft
    ax.plot([x - 0.1, x + 0.35], [y + 0.04, y - 0.24], color=color, linewidth=3.4, zorder=5, solid_capstyle='round')
    # Teeth
    ax.plot([x + 0.16, x + 0.24], [y - 0.09, y - 0.03], color=color, linewidth=2.6, zorder=5, solid_capstyle='round')
    ax.plot([x + 0.28, x + 0.36], [y - 0.18, y - 0.12], color=color, linewidth=2.6, zorder=5, solid_capstyle='round')
    
    # Text
    full_text = label
    if sublabel:
        full_text += f"\n{sublabel}"
    ax.text(x + 0.52, y + 0.04, full_text, fontsize=12, fontweight='bold', color='#1A202C',
            va='center', ha='left', zorder=6)

def draw_network_mail(ax, x, y, color='#48BB78'):
    """Vẽ icon Server/Email truyền nhận dữ liệu"""
    srv = FancyBboxPatch((x - 0.35, y - 0.45), 0.7, 0.95,
                         boxstyle="round,pad=0.04,rounding_size=0.1",
                         facecolor='white', edgecolor=color, linewidth=2.4, zorder=4)
    ax.add_patch(srv)
    ax.plot([x - 0.22, x + 0.22], [y + 0.32, y + 0.32], color=color, linewidth=2.0, zorder=5)
    ax.plot([x - 0.22, x + 0.22], [y + 0.12, y + 0.12], color=color, linewidth=2.0, zorder=5)
    ax.plot([x - 0.22, x + 0.22], [y - 0.12, y - 0.12], color=color, linewidth=2.0, zorder=5)
    
    # Envelope
    env_w = 0.62
    env_h = 0.4
    env_pts = [
        [x - env_w/2, y - 0.15 - env_h/2],
        [x - env_w/2, y - 0.15 + env_h/2],
        [x + env_w/2, y - 0.15 + env_h/2],
        [x + env_w/2, y - 0.15 - env_h/2]
    ]
    env = Polygon(env_pts, closed=True, facecolor='white', edgecolor='#4A5568', linewidth=2.0, zorder=6)
    ax.add_patch(env)
    ax.plot([x - env_w/2, x, x + env_w/2], [y - 0.15 + env_h/2, y - 0.15, y - 0.15 + env_h/2],
            color='#4A5568', linewidth=1.8, zorder=7)
    arc1 = patches.Arc((x + 0.3, y - 0.28), 0.4, 0.4, angle=30, theta1=0, theta2=230, color=color, linewidth=2.4, zorder=8)
    ax.add_patch(arc1)

def draw_arrow(ax, x1, y1, x2, y2, color='#48BB78', lw=2.8):
    """Mũi tên luồng dữ liệu chuẩn"""
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="-|>", color=color, lw=lw, mutation_scale=20),
                zorder=4)

# ==============================================================================
# SƠ ĐỒ 1: QUY TRÌNH MÃ HÓA & GIẢI MÃ PGP (ENCRYPTION & DECRYPTION FLOW)
# ==============================================================================
def create_encryption_decryption_diagram():
    fig, ax = plt.subplots(figsize=(14.2, 10.8), dpi=300)
    ax.set_xlim(0, 14.2)
    ax.set_ylim(0, 10.8)
    ax.axis('off')

    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')

    # ------------------ TOP: ENCRYPTION PROCESS ------------------
    banner_enc = Rectangle((0.5, 9.6), 13.2, 0.75, facecolor='#0066B2', edgecolor='none', zorder=2)
    ax.add_patch(banner_enc)
    ax.text(7.1, 9.97, "Encryption Process (Mã hóa B2B gửi Đối tác)", fontsize=18, fontweight='bold',
            color='white', ha='center', va='center', zorder=3)

    # 1. Raw File (x=1.7)
    draw_document(ax, 1.7, 7.9)
    ax.text(1.7, 6.8, "Raw File\n(Văn bản / Hợp đồng)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    draw_arrow(ax, 2.5, 7.9, 3.7, 7.9)

    # Key trên hộp Encrypt (x=5.5)
    draw_key(ax, 4.3, 8.9, color='#48BB78', label="Recipient's Public Key", sublabel="(Khóa công khai của Đối tác B - Lấy từ CA)")
    draw_arrow(ax, 5.5, 8.6, 5.5, 8.25, color='#48BB78', lw=2.6)

    # 2. Hộp Encrypt File
    box_enc = FancyBboxPatch((3.8, 7.45), 3.4, 0.9, boxstyle="round,pad=0.08,rounding_size=0.18",
                             facecolor='white', edgecolor='#0066B2', linewidth=2.2, zorder=3)
    ax.add_patch(box_enc)
    ax.text(5.5, 7.9, "Encrypt File with Public Key\n(Mã hóa lai: AES-256 + RSA/ECC)", fontsize=11.5, fontweight='bold',
            color='#0066B2', ha='center', va='center', zorder=4)

    draw_arrow(ax, 7.3, 7.9, 8.5, 7.9)

    # 3. Encrypted File (x=9.3)
    draw_document(ax, 9.3, 7.9)
    draw_lock(ax, 9.7, 7.6, radius=0.25, color='#48BB78')
    ax.text(9.3, 6.8, "Encrypted File\n(File PGP mã hóa)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    draw_arrow(ax, 10.2, 7.9, 11.4, 7.9)

    # 4. Email / B2B Portal (x=12.4)
    draw_network_mail(ax, 12.4, 7.9, color='#48BB78')
    ax.text(12.4, 6.8, "Email / B2B Portal\n(Kênh truyền Internet)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    # ------------------ BOTTOM: DECRYPTION PROCESS ------------------
    banner_dec = Rectangle((0.5, 4.8), 13.2, 0.75, facecolor='#387C2B', edgecolor='none', zorder=2)
    ax.add_patch(banner_dec)
    ax.text(7.1, 5.17, "Decryption Process (Giải mã tại Đối tác tiếp nhận)", fontsize=18, fontweight='bold',
            color='white', ha='center', va='center', zorder=3)

    # 1. Kênh truyền (x=1.7)
    draw_network_mail(ax, 1.7, 3.1, color='#48BB78')
    ax.text(1.7, 2.0, "Email / B2B Portal\n(Nhận file từ đối tác)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    draw_arrow(ax, 2.5, 3.1, 3.7, 3.1)

    # 2. Encrypted File (x=4.6)
    draw_document(ax, 4.6, 3.1)
    draw_lock(ax, 5.0, 2.8, radius=0.25, color='#48BB78')
    ax.text(4.6, 2.0, "Encrypted File\n(Tệp tin PGP bị khóa)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    draw_arrow(ax, 5.5, 3.1, 6.7, 3.1)

    # Key trên hộp Decrypt (x=8.4)
    draw_key(ax, 7.1, 4.1, color='#718096', label="Recipient's Private Key", sublabel="(Khóa bí mật của Đối tác B - Giữ an toàn)")
    draw_arrow(ax, 8.4, 3.8, 8.4, 3.45, color='#48BB78', lw=2.6)

    # 3. Hộp Decrypt File
    box_dec = FancyBboxPatch((6.8, 2.65), 3.4, 0.9, boxstyle="round,pad=0.08,rounding_size=0.18",
                             facecolor='white', edgecolor='#0066B2', linewidth=2.2, zorder=3)
    ax.add_patch(box_dec)
    ax.text(8.5, 3.1, "Decrypt File with Private Key\n(Giải mã phiên AES bằng Private Key)", fontsize=11.5, fontweight='bold',
            color='#0066B2', ha='center', va='center', zorder=4)

    draw_arrow(ax, 10.3, 3.1, 11.5, 3.1)

    # 4. Raw File (x=12.4)
    draw_document(ax, 12.4, 3.1)
    ax.text(12.4, 2.0, "Raw File\n(Văn bản gốc ban đầu)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    # Footer Box ghi chú
    footer_box = FancyBboxPatch((0.6, 0.25), 13.0, 1.05, boxstyle="round,pad=0.05,rounding_size=0.1",
                                facecolor='#F7FAFC', edgecolor='#CBD5E0', linewidth=1.2, zorder=2)
    ax.add_patch(footer_box)
    note_txt = (
        "NGUYEN TAC KHOA TRONG HE THONG DOANH NGHIEP (RFC 4880 HYBRID ENCRYPTION):\n"
        "[1] Ben gui dung RECIPIENT'S PUBLIC KEY de ma hoa -> Khong bat ky ai doc duoc ngoai tru nguoi giu Private Key tuong ung.\n"
        "[2] Chi nguoi nhan so huu RECIPIENT'S PRIVATE KEY moi co the giai ma duoc khoa phien AES va doc noi dung goc.\n"
        "[3] Public Key duoc quan ly va xac thuc boi Corporate CA, tranh tuyet doi rui ro bi doi khoa gia mao tren duong truyen."
    )
    ax.text(0.9, 0.77, note_txt, fontsize=10.5, color='#2D3748', va='center', ha='left', zorder=3, family='monospace', fontweight='bold')

    plt.tight_layout()
    output_path = 'diagrams/pgp_encryption_decryption_flow.png'
    plt.savefig(output_path, bbox_inches='tight', dpi=300)
    plt.close()
    print("Regenerated:", output_path)

# ==============================================================================
# SƠ ĐỒ 2: QUY TRÌNH KÝ SỐ VÀ BẢO LÃNH CA (SIGNING & CA TRUST FLOW)
# ==============================================================================
def create_signing_verification_diagram():
    fig, ax = plt.subplots(figsize=(14.2, 10.8), dpi=300)
    ax.set_xlim(0, 14.2)
    ax.set_ylim(0, 10.8)
    ax.axis('off')

    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')

    # ------------------ TOP: SIGNING PROCESS ------------------
    banner_sign = Rectangle((0.5, 9.6), 13.2, 0.75, facecolor='#553C9A', edgecolor='none', zorder=2)
    ax.add_patch(banner_sign)
    ax.text(7.1, 9.97, "Digital Signing Process (Cán bộ Nội bộ Ký số Văn bản)", fontsize=18, fontweight='bold',
            color='white', ha='center', va='center', zorder=3)

    # 1. Raw Document (x=1.7)
    draw_document(ax, 1.7, 7.9)
    ax.text(1.7, 6.8, "Raw Document\n(Quyết định / Hợp đồng)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    draw_arrow(ax, 2.5, 7.9, 3.7, 7.9, color='#805AD5')

    # Key trên hộp Sign
    draw_key(ax, 4.3, 8.9, color='#E53E3E', label="Signer's Private Key", sublabel="(Khóa bí mật Cán bộ - Doanh nghiệp cấp)")
    draw_arrow(ax, 5.5, 8.6, 5.5, 8.25, color='#805AD5', lw=2.6)

    # 2. Hộp Sign with Private Key
    box_sign = FancyBboxPatch((3.8, 7.45), 3.4, 0.9, boxstyle="round,pad=0.08,rounding_size=0.18",
                              facecolor='white', edgecolor='#553C9A', linewidth=2.2, zorder=3)
    ax.add_patch(box_sign)
    ax.text(5.5, 7.9, "Sign with Private Key\n(Băm SHA-256 + Ký Ed25519)", fontsize=12, fontweight='bold',
            color='#553C9A', ha='center', va='center', zorder=4)

    draw_arrow(ax, 7.3, 7.9, 8.5, 7.9, color='#805AD5')

    # 3. Signed Document (x=9.3)
    draw_document(ax, 9.3, 7.9)
    stamp = Circle((9.7, 7.6), 0.24, facecolor='#ED8936', edgecolor='white', linewidth=1.6, zorder=5)
    ax.add_patch(stamp)
    ax.text(9.7, 7.6, "SIG", fontsize=8.5, fontweight='bold', color='white', ha='center', va='center', zorder=6)
    ax.text(9.3, 6.8, "Signed Document\n(Văn bản kèm chữ ký PGP)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    draw_arrow(ax, 10.2, 7.9, 11.4, 7.9, color='#805AD5')

    # 4. Distribution (x=12.4)
    draw_network_mail(ax, 12.4, 7.9, color='#805AD5')
    ax.text(12.4, 6.8, "Distribution\n(Ban hành nội bộ / B2B)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    # ------------------ BOTTOM: VERIFICATION & CA TRUST ------------------
    banner_ver = Rectangle((0.5, 4.8), 13.2, 0.75, facecolor='#2B6CB0', edgecolor='none', zorder=2)
    ax.add_patch(banner_ver)
    ax.text(7.1, 5.17, "Verification & Corporate CA Trust (Thẩm định Chữ ký & Bảo lãnh CA)", fontsize=18, fontweight='bold',
            color='white', ha='center', va='center', zorder=3)

    # 1. Signed Document tiếp nhận (x=1.6)
    draw_document(ax, 1.6, 3.1)
    stamp2 = Circle((2.0, 2.8), 0.24, facecolor='#ED8936', edgecolor='white', linewidth=1.6, zorder=5)
    ax.add_patch(stamp2)
    ax.text(2.0, 2.8, "SIG", fontsize=8.5, fontweight='bold', color='white', ha='center', va='center', zorder=6)
    ax.text(1.6, 2.0, "Signed Document\n(Tiếp nhận thẩm tra)", fontsize=13, fontweight='bold', ha='center', va='top', color='#1A202C')

    draw_arrow(ax, 2.3, 3.1, 3.3, 3.1, color='#2B6CB0')

    # Key trên hộp Bước 1
    draw_key(ax, 3.5, 4.1, color='#3182CE', label="Signer's Public Key", sublabel="(Khóa công khai Người ký)")
    draw_arrow(ax, 4.7, 3.8, 4.7, 3.45, color='#2B6CB0', lw=2.6)

    # 2. Hộp Bước 1: Verify Signature
    box_ver1 = FancyBboxPatch((3.4, 2.65), 2.9, 0.9, boxstyle="round,pad=0.08,rounding_size=0.18",
                              facecolor='white', edgecolor='#2B6CB0', linewidth=2.2, zorder=3)
    ax.add_patch(box_ver1)
    ax.text(4.85, 3.1, "1. Verify Signature\n(Kiểm tra toàn vẹn tài liệu)", fontsize=11.5, fontweight='bold',
            color='#2B6CB0', ha='center', va='center', zorder=4)

    draw_arrow(ax, 6.4, 3.1, 7.4, 3.1, color='#2B6CB0')

    # Key trên hộp Bước 2
    draw_key(ax, 7.7, 4.1, color='#D69E2E', label="Corporate CA Root Key", sublabel="(Khóa gốc Chứng thực CA)")
    draw_arrow(ax, 8.9, 3.8, 8.9, 3.45, color='#2B6CB0', lw=2.6)

    # 3. Hộp Bước 2: Verify CA Trust
    box_ver2 = FancyBboxPatch((7.5, 2.65), 3.0, 0.9, boxstyle="round,pad=0.08,rounding_size=0.18",
                              facecolor='white', edgecolor='#D69E2E', linewidth=2.2, zorder=3)
    ax.add_patch(box_ver2)
    ax.text(9.0, 3.1, "2. Verify CA Trust\n(Kiểm tra bảo lãnh nhân viên)", fontsize=11.5, fontweight='bold',
            color='#B7791F', ha='center', va='center', zorder=4)

    draw_arrow(ax, 10.6, 3.1, 11.6, 3.1, color='#2B6CB0')

    # 4. Verified Badge (x=12.6)
    badge = Circle((12.6, 3.1), 0.6, facecolor='#48BB78', edgecolor='#2F855A', linewidth=2.6, zorder=4)
    ax.add_patch(badge)
    ax.text(12.6, 3.1, "VALID\nCERTIFIED", fontsize=10.5, fontweight='bold', color='white', ha='center', va='center', zorder=5)
    ax.text(12.6, 2.0, "Legally Binding\n(Toàn vẹn & Hợp pháp)", fontsize=13, fontweight='bold', ha='center', va='top', color='#2F855A')

    # Footer Box ghi chú
    footer_box = FancyBboxPatch((0.6, 0.25), 13.0, 1.05, boxstyle="round,pad=0.05,rounding_size=0.1",
                                facecolor='#F7FAFC', edgecolor='#CBD5E0', linewidth=1.2, zorder=2)
    ax.add_patch(footer_box)
    note_txt = (
        "NGUYEN TAC KY SO VA BAO LANH CA DOANH NGHIEP:\n"
        "[1] Chi nguoi so huu SIGNER'S PRIVATE KEY moi tao duoc chu ky hop le (Chong choi bo - Non-repudiation).\n"
        "[2] Ai cung co the dung SIGNER'S PUBLIC KEY de xac minh tinh toan ven (Khong the sua doi du chi 1 ky tu).\n"
        "[3] DIEM KHAC BIET: Public Key duoc Corporate Root CA ky bao lanh danh tinh (verifyPrimaryUser == true),\n"
        "    ngan chan ke xau tu tao cap khoa mao danh Giam doc hay Ke toan truong."
    )
    ax.text(0.9, 0.77, note_txt, fontsize=10.5, color='#2D3748', va='center', ha='left', zorder=3, family='monospace', fontweight='bold')

    plt.tight_layout()
    output_path = 'diagrams/pgp_digital_signing_verification_flow.png'
    plt.savefig(output_path, bbox_inches='tight', dpi=300)
    plt.close()
    print("Regenerated:", output_path)

if __name__ == '__main__':
    create_encryption_decryption_diagram()
    create_signing_verification_diagram()
