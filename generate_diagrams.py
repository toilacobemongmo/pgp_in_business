import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Cấu hình font tiếng Việt và hiển thị
plt.rcParams['font.sans-serif'] = ['Segoe UI', 'Arial', 'Tahoma', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

def create_box(ax, x, y, w, h, title, subtitle="", bg_color="#1E293B", border_color="#38BDF8", text_color="#F8FAFC", title_size=11, sub_size=8.5, radius=0.03):
    box = patches.FancyBboxPatch(
        (x, y), w, h,
        boxstyle=f"round,pad=0.01,rounding_size={radius}",
        facecolor=bg_color,
        edgecolor=border_color,
        linewidth=1.5,
        zorder=2
    )
    ax.add_patch(box)
    
    if subtitle:
        ax.text(x + w/2, y + h*0.62, title, ha="center", va="center", color=text_color, fontsize=title_size, fontweight="bold", zorder=3)
        ax.text(x + w/2, y + h*0.30, subtitle, ha="center", va="center", color="#94A3B8", fontsize=sub_size, zorder=3)
    else:
        ax.text(x + w/2, y + h/2, title, ha="center", va="center", color=text_color, fontsize=title_size, fontweight="bold", zorder=3)
    return box

def draw_arrow(ax, x1, y1, x2, y2, label="", color="#38BDF8", style="->", rad=0.0, lw=1.6):
    ax.annotate(
        "", xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(arrowstyle=style, color=color, lw=lw, shrinkA=5, shrinkB=5, connectionstyle=f"arc3,rad={rad}"),
        zorder=4
    )
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ax.text(mx, my + 0.02, label, ha="center", va="center", color="#E2E8F0", fontsize=8, backgroundcolor="#0F172A", zorder=5)

# ==============================================================================
# BIỂU ĐỒ 1: KIẾN TRÚC TOÀN CẢNH HỆ THỐNG (SYSTEM ARCHITECTURE)
# ==============================================================================
def draw_architecture():
    fig, ax = plt.subplots(figsize=(15, 10), facecolor="#0B1120")
    ax.set_facecolor("#0B1120")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    # Header Title
    ax.text(0.5, 0.95, "KIEN TRUC HE THONG ENTERPRISE PGP TRUST CENTER", ha="center", va="center", color="#F8FAFC", fontsize=16, fontweight="bold")
    ax.text(0.5, 0.915, "Ha tang Chung thuc CA Doanh nghiep, Ky so Van ban & Cong Trao doi Mat B2B (RFC 4880)", ha="center", va="center", color="#38BDF8", fontsize=10)

    # 1. TẦNG TRẢI NGHIỆM ĐA VAI TRÒ (4 ROLES UI)
    bg_t1 = patches.FancyBboxPatch((0.03, 0.69), 0.94, 0.185, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#334155", linewidth=1.2)
    ax.add_patch(bg_t1)
    ax.text(0.05, 0.855, "TANG GIAO DIEN DA VAI TRO (REACT 19 + TAILWIND CSS)", color="#38BDF8", fontsize=9.5, fontweight="bold")

    create_box(ax, 0.05, 0.71, 0.20, 0.12, "Role 1: CA Administrator", "Bang dieu khien Root CA\nCap & Thu hoi Chung chi", bg_color="#1E293B", border_color="#0284C7")
    create_box(ax, 0.28, 0.71, 0.20, 0.12, "Role 2: Can bo Noi bo", "Employee Workspace\nKy to trinh, quan ly khoa", bg_color="#064E3B", border_color="#10B981")
    create_box(ax, 0.51, 0.71, 0.20, 0.12, "Role 3: Doi tac B2B", "Partner Gateway\nTai Root CA, gui tin mat", bg_color="#3B0764", border_color="#A855F7")
    create_box(ax, 0.74, 0.71, 0.21, 0.12, "Role 4: Tham tra Cong khai", "Public Verifier\nKeo tha giam dinh 1 cham", bg_color="#134E4A", border_color="#14B8A6")

    # Mũi tên từ UI xuống Backend Gateway
    draw_arrow(ax, 0.50, 0.69, 0.50, 0.61, "REST API (JSON / FormData / Vite Proxy)", color="#64748B", lw=2)

    # 2. TẦNG API GATEWAY (NODE.JS EXPRESS)
    bg_t2 = patches.FancyBboxPatch((0.03, 0.44), 0.94, 0.165, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#334155", linewidth=1.2)
    ax.add_patch(bg_t2)
    ax.text(0.05, 0.585, "TANG XU LY & DIEU PHOI DICH VU (EXPRESS.JS REST API SERVER)", color="#F59E0B", fontsize=9.5, fontweight="bold")

    create_box(ax, 0.05, 0.46, 0.20, 0.10, "/api/ca & /certificates", "Cap phat & Thu hoi khoa\nCorporate CA Certification", bg_color="#1E293B", border_color="#F59E0B")
    create_box(ax, 0.28, 0.46, 0.20, 0.10, "/api/directory", "Danh ba Public Key\nNoi bo & Doi tac B2B", bg_color="#1E293B", border_color="#F59E0B")
    create_box(ax, 0.51, 0.46, 0.20, 0.10, "/api/documents", "Ky so & Xac thuc van ban\nKiem tra chuoi tin cay", bg_color="#1E293B", border_color="#F59E0B")
    create_box(ax, 0.74, 0.46, 0.21, 0.10, "/api/messages & /audit", "B2B Message Broker\nNhat ky kiem toan an ninh", bg_color="#1E293B", border_color="#F59E0B")

    # Mũi tên xuống tầng Mật mã OpenPGP Core
    draw_arrow(ax, 0.50, 0.44, 0.50, 0.36, "Loi goi Mat ma hoc (OpenPGP.js Runtime)", color="#64748B", lw=2)

    # 3. TẦNG LÕI MẬT MÃ OPENPGP (RFC 4880 ENGINE)
    bg_t3 = patches.FancyBboxPatch((0.03, 0.20), 0.94, 0.155, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#334155", linewidth=1.2)
    ax.add_patch(bg_t3)
    ax.text(0.05, 0.335, "LOI MAT MA HOC OPENPGP CORE ENGINE (ED25519 & CURVE25519)", color="#10B981", fontsize=9.5, fontweight="bold")

    create_box(ax, 0.05, 0.22, 0.27, 0.095, "Root CA Master Key Engine", "ECC Ed25519 256-bit Keypair\nsignPrimaryUser (Certify)", bg_color="#064E3B", border_color="#10B981")
    create_box(ax, 0.36, 0.22, 0.28, 0.095, "Digital Signature Pipeline", "SHA-256 Digest Hashing\nClearsigned & Detached .asc", bg_color="#064E3B", border_color="#10B981")
    create_box(ax, 0.68, 0.22, 0.27, 0.095, "B2B E2E Crypto Pipeline", "Sign-then-Encrypt (Curve25519)\nDecryption & Verification", bg_color="#064E3B", border_color="#10B981")

    # Mũi tên xuống tầng Lưu trữ dữ liệu
    draw_arrow(ax, 0.50, 0.20, 0.50, 0.13, "Luu tru cau hinh & Ban ghi an ninh", color="#64748B", lw=2)

    # 4. TẦNG CƠ SỞ DỮ LIỆU & LƯU TRỮ
    bg_t4 = patches.FancyBboxPatch((0.03, 0.02), 0.94, 0.105, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#334155", linewidth=1.2)
    ax.add_patch(bg_t4)
    ax.text(0.05, 0.105, "TANG LUU TRU DU LIEU & NHAT KY (DATA & KEYRING STORAGE)", color="#CBD5E1", fontsize=9.5, fontweight="bold")

    create_box(ax, 0.05, 0.035, 0.20, 0.065, "Corporate CA Keyring", "Root CA & Passphrase", bg_color="#1E293B", border_color="#64748B", title_size=9.5, sub_size=7.5)
    create_box(ax, 0.28, 0.035, 0.20, 0.065, "Certificates Store", "Danh sach chung chi da cap", bg_color="#1E293B", border_color="#64748B", title_size=9.5, sub_size=7.5)
    create_box(ax, 0.51, 0.035, 0.20, 0.065, "B2B Key Directory", "Public Key noi bo & doi tac", bg_color="#1E293B", border_color="#64748B", title_size=9.5, sub_size=7.5)
    create_box(ax, 0.74, 0.035, 0.21, 0.065, "Immutable Audit Trail", "Log ky so & truy vet", bg_color="#1E293B", border_color="#64748B", title_size=9.5, sub_size=7.5)

    plt.tight_layout()
    plt.savefig("diagrams/system_architecture.png", dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("[SUCCESS] Created diagrams/system_architecture.png")

# ==============================================================================
# BIỂU ĐỒ 2: QUY TRÌNH CẤP CHỨNG CHỈ & KÝ SỐ VĂN BẢN (CA & SIGNING WORKFLOW)
# ==============================================================================
def draw_signing_workflow():
    fig, ax = plt.subplots(figsize=(14, 9), facecolor="#0B1120")
    ax.set_facecolor("#0B1120")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.5, 0.95, "QUY TRINH CAP CHUNG CHI & XAC THUC CHU KY SO TOAN VEN", ha="center", va="center", color="#F8FAFC", fontsize=15, fontweight="bold")
    ax.text(0.5, 0.915, "Mo hinh Corporate CA Certification va co che chong sua doi tai lieu (SHA-256 + Ed25519)", ha="center", va="center", color="#38BDF8", fontsize=9.5)

    # NHÁNH TRÁI: QUY TRÌNH CẤP CHỨNG CHỈ (ISSUANCE)
    box_l = patches.FancyBboxPatch((0.03, 0.05), 0.44, 0.82, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#0284C7", linewidth=1.5)
    ax.add_patch(box_l)
    ax.text(0.25, 0.84, "PHAN HE 1: CAP CHUNG CHI (CA CERTIFICATION)", ha="center", va="center", color="#38BDF8", fontsize=11, fontweight="bold")

    create_box(ax, 0.07, 0.70, 0.36, 0.09, "1. Dang ky Cap Khoa / CSR", "Nhan vien gui Ten, Email, Chuc vu\n(hoac tu nop Public Key ca nhan)", bg_color="#1E293B", border_color="#38BDF8")
    create_box(ax, 0.07, 0.54, 0.36, 0.09, "2. CA Kiem tra & Ky Chung thuc", "Root CA dung Private Key goc\nsignPrimaryUser len Public Key nhan vien", bg_color="#0C4A6E", border_color="#0284C7")
    create_box(ax, 0.07, 0.38, 0.36, 0.09, "3. Xuat Chung Chi & Cap Khoa", "- Public Key co chu ky CA (.asc)\n- Private Key bao mat ca nhan", bg_color="#1E293B", border_color="#10B981")
    create_box(ax, 0.07, 0.22, 0.36, 0.09, "4. Dong bo Danh Ba Doanh Nghiep", "Luu vao Enterprise Key Directory\ntrang thai: Corporate Certified", bg_color="#1E293B", border_color="#38BDF8")
    create_box(ax, 0.07, 0.08, 0.36, 0.08, "Thu hoi Chung chi (Revocation)", "Khi nhan vien thoi viec hoac lo khoa:\nChuyen trang thai REVOKED tuc thi", bg_color="#4C0519", border_color="#F43F5E", title_size=10, sub_size=8)

    draw_arrow(ax, 0.25, 0.70, 0.25, 0.63, color="#38BDF8")
    draw_arrow(ax, 0.25, 0.54, 0.25, 0.47, color="#38BDF8")
    draw_arrow(ax, 0.25, 0.38, 0.25, 0.31, color="#38BDF8")
    draw_arrow(ax, 0.25, 0.22, 0.25, 0.16, color="#F43F5E", style="->")

    # NHÁNH PHẢI: QUY TRÌNH KÝ SỐ & THẨM ĐỊNH (SIGN & VERIFY)
    box_r = patches.FancyBboxPatch((0.53, 0.05), 0.44, 0.82, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#10B981", linewidth=1.5)
    ax.add_patch(box_r)
    ax.text(0.75, 0.84, "PHAN HE 2: KY SO & XAC MINH TINH TOAN VEN", ha="center", va="center", color="#10B981", fontsize=11, fontweight="bold")

    create_box(ax, 0.57, 0.70, 0.36, 0.09, "A. Van Ban / Hop Dong Can Ky", "File PDF, DOCX hoac van ban hanh chinh\nBam SHA-256 tao Message Digest", bg_color="#1E293B", border_color="#10B981")
    create_box(ax, 0.57, 0.54, 0.36, 0.09, "B. Ky Bang Private Key Can Bo", "Ma hoa ban bam bang Private Key\nSinh chu ky PGP Clearsign / Detached .asc", bg_color="#064E3B", border_color="#10B981")
    create_box(ax, 0.57, 0.38, 0.36, 0.09, "C. Chuyen Giao Tai Lieu & Chu Ky", "Gui file kem chu ky so toi doi tac\n(khong ai co the chinh sua noi dung)", bg_color="#1E293B", border_color="#10B981")
    create_box(ax, 0.57, 0.22, 0.36, 0.09, "D. Tham Dinh Kep (2-Layer Verify)", "1. Kiem tra toan ven: Hash A == Hash B?\n2. Doi chieu chuoi CA: Khoa duoc CA ky?", bg_color="#064E3B", border_color="#10B981")
    create_box(ax, 0.57, 0.08, 0.36, 0.08, "Ket Qua Tham Dinh", "[HOP LE] Toan ven 100% + Co dau CA\n[CANH BAO] Du lieu bi sua hoac Khoa bi thu hoi", bg_color="#1E293B", border_color="#38BDF8", title_size=10, sub_size=8)

    draw_arrow(ax, 0.75, 0.70, 0.75, 0.63, color="#10B981")
    draw_arrow(ax, 0.75, 0.54, 0.75, 0.47, color="#10B981")
    draw_arrow(ax, 0.75, 0.38, 0.75, 0.31, color="#10B981")
    draw_arrow(ax, 0.75, 0.22, 0.75, 0.16, color="#10B981")

    # Mũi tên liên kết giữa Khóa nhân viên cấp và Bước Ký
    draw_arrow(ax, 0.43, 0.42, 0.57, 0.58, "Cung cap Khoa Ky", color="#F59E0B", rad=0.15)

    plt.tight_layout()
    plt.savefig("diagrams/ca_and_signing_flow.png", dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("[SUCCESS] Created diagrams/ca_and_signing_flow.png")

# ==============================================================================
# BIỂU ĐỒ 3: MÔ HÌNH TRAO ĐỔI THÔNG ĐIỆP MẬT B2B (SIGN-THEN-ENCRYPT)
# ==============================================================================
def draw_b2b_messaging():
    fig, ax = plt.subplots(figsize=(15, 8.5), facecolor="#0B1120")
    ax.set_facecolor("#0B1120")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.5, 0.95, "QUY TRINH TRAO DOI BAO MAT B2B (SIGN-THEN-ENCRYPT PIPELINE)", ha="center", va="center", color="#F8FAFC", fontsize=15, fontweight="bold")
    ax.text(0.5, 0.915, "Mo hinh trao doi bao gia & hop dong mat giua 2 Doanh nghiep: Chong nghe len & Chong mao danh", ha="center", va="center", color="#A855F7", fontsize=9.5)

    # KHỐI BÊN GỬI (DOANH NGHIỆP A - ENTERPRISE)
    bg_sender = patches.FancyBboxPatch((0.03, 0.10), 0.28, 0.76, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#0284C7", linewidth=1.5)
    ax.add_patch(bg_sender)
    ax.text(0.17, 0.82, "BEN GUI: DOANH NGHIEP CUA BAN", ha="center", va="center", color="#38BDF8", fontsize=10.5, fontweight="bold")

    create_box(ax, 0.05, 0.67, 0.24, 0.09, "1. Soan Thao Van Ban Mat", "Bao gia, STK ngan hang, Hop dong\nNoi dung dang Plaintext", bg_color="#1E293B", border_color="#38BDF8")
    create_box(ax, 0.05, 0.49, 0.24, 0.11, "2. Ky So (Sign)", "Dung Private Key Ben Gui\n- Xac thuc chinh danh tac gia\n- Chong choi bo trach nhiem", bg_color="#0C4A6E", border_color="#0284C7")
    create_box(ax, 0.05, 0.28, 0.24, 0.11, "3. Ma Hoa Khoa Kep (Encrypt)", "Dung Public Key Doi Tac B2B\n- Dong goi thanh PGP Envelope\n- Chi ben nhan moi mo khoa duoc", bg_color="#3B0764", border_color="#A855F7")
    create_box(ax, 0.05, 0.13, 0.24, 0.08, "Xuat Goi Tin PGP Encrypted", "-----BEGIN PGP MESSAGE-----", bg_color="#1E293B", border_color="#A855F7", title_size=9.5, sub_size=8)

    draw_arrow(ax, 0.17, 0.67, 0.17, 0.60, color="#38BDF8")
    draw_arrow(ax, 0.17, 0.49, 0.17, 0.39, color="#A855F7")
    draw_arrow(ax, 0.17, 0.28, 0.17, 0.21, color="#A855F7")

    # ĐƯỜNG TRUYỀN INTERNET CÔNG CỘNG (PUBLIC NETWORK)
    bg_net = patches.FancyBboxPatch((0.37, 0.25), 0.26, 0.48, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#1E1B4B", edgecolor="#6366F1", linewidth=1.5, linestyle="--")
    ax.add_patch(bg_net)
    ax.text(0.50, 0.68, "DUONG TRUYEN INTERNET CONG CONG", ha="center", va="center", color="#A5B4FC", fontsize=9.5, fontweight="bold")
    ax.text(0.50, 0.58, "Bao thu da duoc ma hoa PGP Armor\nh4sK...#@$89a!d*&1\n(Du lieu vo nghia doi voi Hacker)", ha="center", va="center", color="#CBD5E1", fontsize=8.5, fontfamily="monospace")
    ax.text(0.50, 0.38, "An toan Tuyet doi:\n- Hacker khong the giai ma (thieu PrivKey)\n- Hacker khong the sua (chu ky se hong)", ha="center", va="center", color="#10B981", fontsize=8.5)

    # Mũi tên từ Bên Gửi sang Internet
    draw_arrow(ax, 0.29, 0.17, 0.37, 0.35, "Chuyen phat ban tin", color="#A855F7", lw=2)

    # KHỐI BÊN NHẬN (DOANH NGHIỆP ĐỐI TÁC - FINCORP)
    bg_recv = patches.FancyBboxPatch((0.69, 0.10), 0.28, 0.76, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#A855F7", linewidth=1.5)
    ax.add_patch(bg_recv)
    ax.text(0.83, 0.82, "BEN NHAN: TAP DOAN FINCORP (B2B)", ha="center", va="center", color="#C084FC", fontsize=10.5, fontweight="bold")

    create_box(ax, 0.71, 0.67, 0.24, 0.09, "4. Tiep Nhan Bao Thu PGP", "Nhan ban tin ma hoa tu cong B2B\nChua doc duoc noi dung goc", bg_color="#1E293B", border_color="#A855F7")
    create_box(ax, 0.71, 0.49, 0.24, 0.11, "5. Mo Khoa Bang Private Key", "Dung Private Key cua FINCORP\n- Giai ma phong bi mat ma\n- Khoi phuc noi dung van ban", bg_color="#3B0764", border_color="#A855F7")
    create_box(ax, 0.71, 0.28, 0.24, 0.11, "6. Tham Dinh Chu Ky Nguoi Gui", "Dung Public Key Ben Gui (tu CA)\n- Xac nhan nguoi gui chinh xac\n- Noi dung nguyen ven 100%", bg_color="#064E3B", border_color="#10B981")
    create_box(ax, 0.71, 0.13, 0.24, 0.08, "Van Ban Hoan Chinh & Tem Xanh", "Giao dich B2B thanh cong!", bg_color="#1E293B", border_color="#10B981", title_size=9.5, sub_size=8)

    # Mũi tên từ Internet sang Bên Nhận
    draw_arrow(ax, 0.63, 0.55, 0.71, 0.71, "Nhan phong bi", color="#A855F7", lw=2)

    draw_arrow(ax, 0.83, 0.67, 0.83, 0.60, color="#A855F7")
    draw_arrow(ax, 0.83, 0.49, 0.83, 0.39, color="#10B981")
    draw_arrow(ax, 0.83, 0.28, 0.83, 0.21, color="#10B981")

    plt.tight_layout()
    plt.savefig("diagrams/b2b_e2e_messaging.png", dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("[SUCCESS] Created diagrams/b2b_e2e_messaging.png")

if __name__ == "__main__":
    os.makedirs("diagrams", exist_ok=True)
    draw_architecture()
    draw_signing_workflow()
    draw_b2b_messaging()
    print("[COMPLETED] All 3 architecture diagrams generated successfully!")
