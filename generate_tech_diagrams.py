import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

plt.rcParams['font.sans-serif'] = ['Segoe UI', 'Arial', 'Tahoma', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

def create_tech_box(ax, x, y, w, h, header, items, bg_color="#0F172A", border_color="#38BDF8", header_color="#38BDF8"):
    box = patches.FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.01,rounding_size=0.015",
        facecolor=bg_color,
        edgecolor=border_color,
        linewidth=1.4,
        zorder=2
    )
    ax.add_patch(box)
    
    # Header bar
    header_box = patches.FancyBboxPatch(
        (x, y + h - 0.04), w, 0.04,
        boxstyle="round,pad=0.005,rounding_size=0.01",
        facecolor=border_color,
        edgecolor=border_color,
        zorder=3
    )
    ax.add_patch(header_box)
    ax.text(x + w/2, y + h - 0.02, header, ha="center", va="center", color="#0F172A", fontsize=9.5, fontweight="bold", zorder=4)
    
    # Items
    start_y = y + h - 0.065
    line_spacing = (h - 0.055) / max(len(items), 1)
    for i, item in enumerate(items):
        ax.text(x + 0.015, start_y - i * line_spacing, item, ha="left", va="center", color="#E2E8F0", fontsize=8, fontfamily="monospace", zorder=4)

def draw_arrow(ax, x1, y1, x2, y2, label="", color="#38BDF8", lw=1.5, style="->"):
    ax.annotate(
        "", xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(arrowstyle=style, color=color, lw=lw, shrinkA=3, shrinkB=3),
        zorder=5
    )
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ax.text(mx, my, label, ha="center", va="center", color="#F8FAFC", fontsize=7.5, fontfamily="monospace", backgroundcolor="#020617", zorder=6)

# ==============================================================================
# BIỂU ĐỒ 1: SƠ ĐỒ KỸ THUẬT FUNCTION & DATA FLOW (CODE LEVEL ARCHITECTURE)
# ==============================================================================
def draw_technical_code_architecture():
    fig, ax = plt.subplots(figsize=(16, 10), facecolor="#020617")
    ax.set_facecolor("#020617")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.5, 0.965, "SO DO KI THUAT CHI TIET: COMPONENT, API ROUTE & OPENPGP.JS PIPELINE", ha="center", va="center", color="#F8FAFC", fontsize=14, fontweight="bold")
    ax.text(0.5, 0.935, "Luong du lieu ma nguon thuc te: Frontend React -> Express Controllers -> PgpService -> OpenPGP Engine", ha="center", va="center", color="#38BDF8", fontsize=9)

    # 4 CỘT KỸ THUẬT:
    # CỘT 1: FRONTEND REACT COMPONENTS (x: 0.03 - 0.23)
    # CỘT 2: EXPRESS API ROUTES (x: 0.28 - 0.48)
    # CỘT 3: PGP SERVICE LAYER (x: 0.53 - 0.73)
    # CỘT 4: OPENPGP.JS CORE CRYPTO (x: 0.77 - 0.97)

    # Cột 1: Frontend
    ax.text(0.13, 0.90, "1. FRONTEND REACT COMPONENTS", ha="center", va="center", color="#38BDF8", fontsize=10, fontweight="bold")
    create_tech_box(ax, 0.03, 0.69, 0.20, 0.18, "IssueCertModal.jsx", [
        "- state: name, email, role",
        "- state: mode (ca_gen | csr)",
        "- payload: customPublicKeyArmored",
        "- calls: CA_API.issueCertificate()"
    ], border_color="#38BDF8", header_color="#38BDF8")

    create_tech_box(ax, 0.03, 0.46, 0.20, 0.19, "DocumentSigningView.jsx", [
        "- sign: FormData(file | text)",
        "- signerPrivateKeyArmored",
        "- verify: FormData(file, sig)",
        "- signerPublicKeyArmored",
        "- calls: CA_API.signDocument()",
        "- calls: CA_API.verifyDocument()"
    ], border_color="#10B981", header_color="#10B981")

    create_tech_box(ax, 0.03, 0.24, 0.20, 0.18, "B2BMessagingView.jsx", [
        "- senderPrivateKeyArmored",
        "- recipientPublicKeyArmored",
        "- payload: { subject, content }",
        "- decrypt: encryptedPayloadArmored",
        "- calls: CA_API.sendB2BMessage()",
        "- calls: CA_API.decryptB2BMessage()"
    ], border_color="#A855F7", header_color="#A855F7")

    create_tech_box(ax, 0.03, 0.04, 0.20, 0.16, "KeyDirectoryView.jsx", [
        "- state: directory (internal & B2B)",
        "- import: { org, email, pubKey }",
        "- calls: CA_API.importExternalKey()",
        "- calls: CA_API.deleteDirectoryKey()"
    ], border_color="#F59E0B", header_color="#F59E0B")

    # Cột 2: Express Routes (backend/server.js)
    ax.text(0.38, 0.90, "2. EXPRESS REST API ROUTES", ha="center", va="center", color="#F59E0B", fontsize=10, fontweight="bold")
    create_tech_box(ax, 0.27, 0.69, 0.21, 0.18, "POST /api/certificates/issue", [
        "- validate: name, email, validity",
        "- route: PgpService.issueCertificate()",
        "- params: { customPublicKeyArmored }",
        "- returns: { certRecord, armoredKey }"
    ], border_color="#38BDF8", header_color="#38BDF8")

    create_tech_box(ax, 0.27, 0.46, 0.21, 0.19, "POST /api/documents/sign & verify", [
        "- multer: memoryStorage (buffer)",
        "- req.file.buffer || textContent",
        "- route: PgpService.signDocument()",
        "- route: PgpService.verifyDocument()",
        "- returns: { isValid, isCertifiedByCA }"
    ], border_color="#10B981", header_color="#10B981")

    create_tech_box(ax, 0.27, 0.24, 0.21, 0.18, "POST /api/messages/send & decrypt", [
        "- req.body: senderPrivKey, recipPubKey",
        "- route: PgpService.sendB2BMessage()",
        "- route: PgpService.decryptB2BMessage()",
        "- returns: { decryptedContent, valid }"
    ], border_color="#A855F7", header_color="#A855F7")

    create_tech_box(ax, 0.27, 0.04, 0.21, 0.16, "POST /api/directory/import", [
        "- validate OpenPGP armored format",
        "- parse fingerprint & keyID",
        "- store.write(key_directory)",
        "- store.logAudit('IMPORT_KEY')"
    ], border_color="#F59E0B", header_color="#F59E0B")

    # Cột 3: Service Layer (backend/pgp-service.js)
    ax.text(0.63, 0.90, "3. PGP SERVICE LAYER", ha="center", va="center", color="#10B981", fontsize=10, fontweight="bold")
    create_tech_box(ax, 0.52, 0.69, 0.21, 0.18, "PgpService.issueCertificate()", [
        "- decrypt CA private key w/ pass",
        "- if !csr: openpgp.generateKey()",
        "- userPubKey.signPrimaryUser([caPriv])",
        "- certifiedPubKey.armor()",
        "- store.write(certificates)"
    ], border_color="#38BDF8", header_color="#38BDF8")

    create_tech_box(ax, 0.52, 0.46, 0.21, 0.19, "PgpService.sign & verify()", [
        "- hash: crypto.createHash('sha256')",
        "- clearsign: openpgp.createCleartext()",
        "- detached: openpgp.createMessage(bin)",
        "- verify: openpgp.verify()",
        "- check: userKey.verifyPrimaryUser(ca)"
    ], border_color="#10B981", header_color="#10B981")

    create_tech_box(ax, 0.52, 0.24, 0.21, 0.18, "PgpService.send & decryptB2B()", [
        "- encrypt: openpgp.encrypt({",
        "    message, encryptionKeys, signingKeys",
        "  })",
        "- decrypt: openpgp.decrypt({",
        "    message, decryptionKeys, verifyKeys",
        "  }) -> verify signatures[0]"
    ], border_color="#A855F7", header_color="#A855F7")

    create_tech_box(ax, 0.52, 0.04, 0.21, 0.16, "JsonStore & Audit Logger", [
        "- file: backend/data/db.json",
        "- read() & atomic write()",
        "- logAudit(action, actor, details)",
        "- FIFO cap: 500 security events"
    ], border_color="#F59E0B", header_color="#F59E0B")

    # Cột 4: OpenPGP.js Runtime & RFC 4880 Primitives
    ax.text(0.87, 0.90, "4. OPENPGP.JS CORE ENGINE", ha="center", va="center", color="#C084FC", fontsize=10, fontweight="bold")
    create_tech_box(ax, 0.76, 0.69, 0.21, 0.18, "Key & Certification Engine", [
        "- generateKey({ type: 'ecc' })",
        "- Curve: Ed25519 (RFC 4880bis)",
        "- readPrivateKey({ armoredKey })",
        "- readKey({ armoredKey })",
        "- signPrimaryUser([signingKey])"
    ], border_color="#38BDF8", header_color="#38BDF8")

    create_tech_box(ax, 0.76, 0.46, 0.21, 0.19, "Signature & Verification", [
        "- createCleartextMessage({ text })",
        "- createMessage({ binary: Uint8Array })",
        "- sign({ message, signingKeys, det })",
        "- readSignature({ armoredSignature })",
        "- verify({ message, verificationKeys })"
    ], border_color="#10B981", header_color="#10B981")

    create_tech_box(ax, 0.76, 0.24, 0.21, 0.18, "E2E Hybrid Cipher Engine", [
        "- encrypt({ encryptionKeys, signKeys })",
        "- Session Key: AES-256 (CFB mode)",
        "- Asymmetric: Curve25519 (ECDH)",
        "- Integrity: SEIPD (Tag 18)",
        "- decrypt() -> plaintext & verify"
    ], border_color="#A855F7", header_color="#A855F7")

    create_tech_box(ax, 0.76, 0.04, 0.21, 0.16, "Armoring & Revocation", [
        "- enums.reasonForRevocation",
        "- revokeKey({ key, reason })",
        "- armor() -> ASCII Armor block",
        "- unarmor() -> binary packets"
    ], border_color="#F59E0B", header_color="#F59E0B")

    # Mũi tên kết nối liên tầng
    # Row 1 (Issue)
    draw_arrow(ax, 0.23, 0.78, 0.27, 0.78, "HTTP POST")
    draw_arrow(ax, 0.48, 0.78, 0.52, 0.78, "call")
    draw_arrow(ax, 0.73, 0.78, 0.76, 0.78, "invoke")

    # Row 2 (Sign & Verify)
    draw_arrow(ax, 0.23, 0.55, 0.27, 0.55, "HTTP POST")
    draw_arrow(ax, 0.48, 0.55, 0.52, 0.55, "call")
    draw_arrow(ax, 0.73, 0.55, 0.76, 0.55, "invoke")

    # Row 3 (B2B)
    draw_arrow(ax, 0.23, 0.33, 0.27, 0.33, "HTTP POST")
    draw_arrow(ax, 0.48, 0.33, 0.52, 0.33, "call")
    draw_arrow(ax, 0.73, 0.33, 0.76, 0.33, "invoke")

    # Row 4 (Directory & Store)
    draw_arrow(ax, 0.23, 0.12, 0.27, 0.12, "HTTP POST")
    draw_arrow(ax, 0.48, 0.12, 0.52, 0.12, "persist")
    draw_arrow(ax, 0.73, 0.12, 0.76, 0.12, "parse")

    plt.tight_layout()
    plt.savefig("diagrams/technical_code_architecture.png", dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("[SUCCESS] Created diagrams/technical_code_architecture.png")

# ==============================================================================
# BIỂU ĐỒ 2: CẤU TRÚC GÓI TIN OPENPGP RFC 4880 PACKETS & KEYRING SPEC
# ==============================================================================
def draw_rfc4880_packets():
    fig, ax = plt.subplots(figsize=(15, 9.5), facecolor="#020617")
    ax.set_facecolor("#020617")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.5, 0.965, "CAU TRUC PACKET OPENPGP RFC 4880: CHUNG CHI CA & BAN TIN MA HOA B2B", ha="center", va="center", color="#F8FAFC", fontsize=14, fontweight="bold")
    ax.text(0.5, 0.935, "Giai phau chi tiet cac goi tin mat ma nhi phan duoc dong goi ben duoi chuoi ASCII Armor", ha="center", va="center", color="#10B981", fontsize=9)

    # KHỐI TRÁI: CẤU TRÚC 1 PUBLIC KEY DA DUOC CA CHUNG THUC (RFC 4880 KEY STRUCTURE)
    bg_l = patches.FancyBboxPatch((0.03, 0.04), 0.44, 0.86, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#0284C7", linewidth=1.5)
    ax.add_patch(bg_l)
    ax.text(0.25, 0.87, "CAU TRUC PUBLIC KEY NHAN VIEN DUOC CA KY", ha="center", va="center", color="#38BDF8", fontsize=10.5, fontweight="bold")
    ax.text(0.25, 0.84, "(Ket qua sau khi goi: userPubKey.signPrimaryUser([caPrivKey]))", ha="center", va="center", color="#94A3B8", fontsize=8)

    create_tech_box(ax, 0.05, 0.69, 0.40, 0.13, "Packet 1: Public Key Packet (Tag 6)", [
        "- Version: 4 (RFC 4880) | Algorithm: Ed25519 (OID)",
        "- Creation Time: 32-bit Unix Timestamp",
        "- Public Key Material: 32-byte Ed25519 public point",
        "- Key ID (Lower 64-bit) & Fingerprint (160-bit/SHA-1)"
    ], border_color="#38BDF8", header_color="#38BDF8")

    create_tech_box(ax, 0.05, 0.54, 0.40, 0.12, "Packet 2: User ID Packet (Tag 13)", [
        "- UTF-8 String dinh danh chu the hop phap:",
        "  'Nguyen Van An <an.nguyen@enterprise.internal>'",
        "- Chua thong tin Chuc vu, Phong ban duoc xac minh"
    ], border_color="#10B981", header_color="#10B981")

    create_tech_box(ax, 0.05, 0.36, 0.40, 0.15, "Packet 3: Primary Self-Signature (Tag 2)", [
        "- Signature Type: 0x13 (Positive Certification of User ID)",
        "- Public-Key Algorithm: Ed25519 | Hash Algorithm: SHA-256",
        "- Subpackets: Key Flags (Sign, Certify), Key Expiration",
        "- Ky boi: Private Key cua chinh nhan vien do (Self-Signed)"
    ], border_color="#F59E0B", header_color="#F59E0B")

    create_tech_box(ax, 0.05, 0.17, 0.40, 0.16, "Packet 4: CA Certification Signature (Tag 2 - CORPO CA)", [
        "- Signature Type: 0x10 / 0x13 (Certification Signature)",
        "- Issuer Key ID: KeyID cua Corporate Root CA",
        "- Subpackets: Trust Level, Corporate Issuer Fingerprint",
        "- Ky boi: PRIVATE KEY CUA CORPORATE ROOT CA",
        "- >> DAY LA CON DAU PHAP LY XAC NHAN NHAN VIEN HOP PHAP <<"
    ], border_color="#A855F7", header_color="#A855F7")

    create_tech_box(ax, 0.05, 0.055, 0.40, 0.09, "Packet 5: Public Subkey Packet (Tag 14)", [
        "- Subkey Type: Curve25519 (ECDH - Dung cho Ma hoa du lieu)",
        "- Kem theo Subkey Binding Signature (Tag 2)"
    ], border_color="#64748B", header_color="#64748B")

    # KHỐI PHẢI: CẤU TRÚC GÓI TIN B2B ENCRYPTED MESSAGE (RFC 4880 CIPHERTEXT)
    bg_r = patches.FancyBboxPatch((0.53, 0.04), 0.44, 0.86, boxstyle="round,pad=0.01,rounding_size=0.02", facecolor="#0F172A", edgecolor="#A855F7", linewidth=1.5)
    ax.add_patch(bg_r)
    ax.text(0.75, 0.87, "CAU TRUC BAN TIN MA HOA & KY SO B2B", ha="center", va="center", color="#C084FC", fontsize=10.5, fontweight="bold")
    ax.text(0.75, 0.84, "(Ket qua sau khi goi: openpgp.encrypt({ encryptionKeys, signingKeys }))", ha="center", va="center", color="#94A3B8", fontsize=8)

    create_tech_box(ax, 0.55, 0.69, 0.40, 0.13, "Packet A: PKESK Packet (Tag 1)", [
        "- Public-Key Encrypted Session Key Packet",
        "- Recipient Key ID: KeyID cua Doi tac FINCORP",
        "- Encrypted Session Key: Ma hoa khoa doi xung (AES-256)",
        "- bang Public Key ECDH (Curve25519) cua Ben Nhan"
    ], border_color="#A855F7", header_color="#A855F7")

    create_tech_box(ax, 0.55, 0.50, 0.40, 0.16, "Packet B: SEIPD Packet (Tag 18 - Lop Ma hoa Doi xung)", [
        "- Sym. Encrypted and Integrity Protected Data Packet",
        "- Thuat toan doi xung: AES-256 CFB mode",
        "- Kem theo ma bao ve toan ven SHA-1 Modification Detection (MDC)",
        "- Tat ca cac Packet C, D, E ben duoi duoc ma hoa nam ben trong!"
    ], border_color="#F43F5E", header_color="#F43F5E")

    create_tech_box(ax, 0.55, 0.35, 0.40, 0.12, "Packet C: One-Pass Signature Packet (Tag 4)", [
        "- Cho phep he thong xac thuc chu ky trong 1 luong (Streaming)",
        "- Signer Key ID: KeyID cua Doanh nghiep Gui",
        "- Hash Algorithm: SHA-256 | Signature Type: Binary/Text (0x00/0x01)"
    ], border_color="#10B981", header_color="#10B981")

    create_tech_box(ax, 0.55, 0.20, 0.40, 0.12, "Packet D: Literal Data Packet (Tag 11 - Noi dung goc)", [
        "- Data Format: UTF-8 Text / JSON",
        "- Filename: 'b2b_contract_quote.json'",
        "- Noi dung Plaintext bao gia / thoa thuan kinh te"
    ], border_color="#38BDF8", header_color="#38BDF8")

    create_tech_box(ax, 0.55, 0.055, 0.40, 0.12, "Packet E: Signature Packet (Tag 2 - Chu ky Nguoi gui)", [
        "- Gia tri chu ky so Ed25519 (r, s)",
        "- Hash: SHA-256 cua Literal Data + OnePass Header",
        "- Xac thuc tac gia khong the choi bo & du lieu khong the sua"
    ], border_color="#10B981", header_color="#10B981")

    plt.tight_layout()
    plt.savefig("diagrams/rfc4880_packets.png", dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("[SUCCESS] Created diagrams/rfc4880_packets.png")

if __name__ == "__main__":
    draw_technical_code_architecture()
    draw_rfc4880_packets()
    print("[COMPLETED] Generated 2 technical RFC 4880 deep-dive diagrams!")
