"""
Chương 2: Cơ sở lý thuyết và nền tảng mật mã học
"""
import os
from docx.shared import Pt, Cm
from report_helpers import (
    add_para, add_bullet, add_h1, add_h2, add_h3,
    add_table_caption, add_styled_table, add_figure, add_code_block
)

def build_chapter_2(doc):
    add_h1(doc, 'CHƯƠNG 2: CƠ SỞ LÝ THUYẾT VÀ NỀN TẢNG MẬT MÃ HỌC', center=True)

    # 2.1 RFC 4880
    add_h2(doc, '2.1 Chuẩn OpenPGP (RFC 4880) và kiến trúc phân tầng gói tin (Packet Architecture)')
    add_para(doc,
        'Chuẩn OpenPGP được định nghĩa chính thức trong tài liệu RFC 4880 của Internet Engineering Task Force (IETF). Đây là một trong những tiêu chuẩn mật mã khóa công khai thành công và được kiểm chứng lâu đời nhất trong lịch sử điện toán. Khác với các định dạng nhị phân nguyên khối (monolithic), OpenPGP tổ chức toàn bộ dữ liệu (khóa công khai, khóa bí mật, chữ ký số, thông điệp mã hóa, văn bản nén) dưới dạng một chuỗi liên tiếp các "Gói tin" (Packets).'
    )
    add_para(doc,
        'Mỗi gói tin OpenPGP bắt đầu bằng một Tiêu đề gói (Packet Header) chứa thông tin định danh: Định dạng tiêu đề (Cũ - Old Format hoặc Mới - New Format), Thẻ định danh loại gói (Packet Tag), và Độ dài phần thân dữ liệu (Packet Length). Các thẻ gói tin quan trọng bao gồm:'
    )
    add_bullet(doc, ' Thẻ 6 (Public-Key Packet) và Thẻ 14 (Public-Subkey Packet): Chứa thông số toán học của khóa công khai chính và khóa phụ, thuật toán mật mã (RSA, Ed25519, Curve25519) và thời điểm tạo lập.', bold_prefix='• Gói tin Khóa:')
    add_bullet(doc, ' Thẻ 5 (Secret-Key Packet) và Thẻ 7 (Secret-Subkey Packet): Chứa các tham số bí mật của khóa riêng. Để đảm bảo an toàn, các tham số này luôn được mã hóa đối xứng (Symmetric Encryption) bằng hàm dẫn xuất khóa từ chuỗi mật khẩu (S2K - String-to-Key Specifier).', bold_prefix='• Gói tin Khóa Bí Mật:')
    add_bullet(doc, ' Thẻ 13 (User ID Packet): Chứa chuỗi văn bản UTF-8 xác định danh tính chủ sở hữu khóa, thông thường theo định dạng chuẩn "Tên đầy đủ <email@domain.com>".', bold_prefix='• Gói tin Định danh Người dùng:')
    add_bullet(doc, ' Thẻ 2 (Signature Packet): Gói tin trung tâm thực thi chữ ký số. Thẻ 2 chứa loại chữ ký (Signature Type), thuật toán băm (SHA-256, SHA-512), các gói con băm (Hashed Subpackets) chứa thời gian hết hạn, mục đích sử dụng khóa, và 2 byte đầu tiên của mã băm (hash prefix) để đối chiếu nhanh.', bold_prefix='• Gói tin Chữ ký Số:')
    add_bullet(doc, ' Thẻ 1 (Public-Key Encrypted Session Key), Thẻ 9 (Symmetrically Encrypted Data), và Thẻ 18 (Sym. Encrypted and Integrity Protected Data Packet - SEIPD): Dùng trong cơ chế mã hóa lai (Hybrid Encryption) để bảo vệ thông điệp.', bold_prefix='• Gói tin Dữ liệu Mật:')

    add_figure(doc, 'diagrams/rfc4880_packets.png',
        'Hình 2.1: Cấu trúc phân lớp gói tin OpenPGP theo tiêu chuẩn RFC 4880'
    )

    add_para(doc,
        'Trong cơ chế phân loại chữ ký (Signature Types), RFC 4880 định nghĩa các loại chữ ký then chốt được hệ thống lựa chọn áp dụng:'
    )
    add_bullet(doc, ' Chữ ký loại 0x10 (Generic), 0x11 (Persona), 0x12 (Casual), và 0x13 (Positive): Dùng để chứng thực mối liên kết giữa User ID và Khóa công khai. Khi Corporate Root CA chứng thực nhân viên, nó tạo một chữ ký loại 0x13 trên cặp khóa của nhân viên đó.', bold_prefix='- Chữ ký chứng thực danh tính (Certification Signatures):')
    add_bullet(doc, ' Chữ ký loại 0x00 (Signature of a binary document) và 0x01 (Signature of a canonical text document): Dùng để ký số phê duyệt hợp đồng và tài liệu văn phòng.', bold_prefix='- Chữ ký dữ liệu (Document Signatures):')
    add_bullet(doc, ' Chữ ký loại 0x20 (Key revocation signature) và 0x28 (Subkey revocation signature): Dùng để hủy bỏ hiệu lực của khóa khi khóa bị lộ hoặc nhân viên thôi việc. Chữ ký này chứa mã lý do thu hồi (Revocation Reason Code: 0x01 - Khóa bị lộ, 0x02 - Khóa được thay thế, 0x03 - Không còn sử dụng).', bold_prefix='- Chữ ký thu hồi (Revocation Signatures):')

    # 2.2 ECC Curve25519 & Ed25519
    add_h2(doc, '2.2 Mật mã học bất đối xứng đường cong Elliptic (Curve25519 & Ed25519)')
    add_para(doc,
        'Trong các hệ thống PGP truyền thống, thuật toán RSA với kích thước khóa 2048-bit hoặc 4096-bit chiếm ưu thế chủ đạo. Tuy nhiên, RSA đòi hỏi tài nguyên tính toán tương đối lớn, kích thước chữ ký cồng kềnh và tốc độ sinh khóa chậm hơn. Trong dự án này, chúng tôi lựa chọn tiêu chuẩn mật mã học đường cong Elliptic hiện đại (RFC 4880bis / RFC 6637 / RFC 8032):'
    )
    add_bullet(doc, ' Là sơ đồ chữ ký số EdDSA (Edwards-curve Digital Signature Algorithm) được phát triển bởi nhà mật mã học Daniel J. Bernstein và cộng sự. Ed25519 hoạt động trên đường cong Edwards xoắn (Twisted Edwards Curve) dạng $-x^2 + y^2 = 1 - (121665/121666)x^2y^2$ trên trường hữu hạn $2^{255}-19$. Ed25519 cung cấp mức an toàn cao với khóa công khai chỉ dài 32 byte và chữ ký chỉ dài 64 byte, đồng thời có khả năng kháng các cuộc tấn công kênh kề (Side-channel Attacks) tốt hơn nhờ thiết kế thời gian thực thi hằng số.', bold_prefix='1. Thuật toán ký số Ed25519:')
    add_bullet(doc, ' Là hàm trao đổi khóa Diffie-Hellman trên đường cong Montgomery (ECDH), cũng do Bernstein phát triển. Curve25519 được thiết kế để hạn chế các hình thức tấn công dựa trên thời gian thực thi (Constant-time execution), cung cấp tốc độ tính toán khóa phiên nhanh cho các phiên trao đổi thông điệp B2B mật.', bold_prefix='2. Thuật toán trao đổi khóa Curve25519:')

    add_figure(doc, 'diagrams/pgp_encryption_decryption_flow.png',
        'Hình 2.2: Sơ đồ luồng mã hóa và giải mã đối xứng - bất đối xứng lai trong OpenPGP'
    )

    # 2.3 WoT vs CA
    add_h2(doc, '2.3 Mô hình thẩm định danh tính: Web of Trust (WoT) và Phân cấp CA doanh nghiệp')
    add_para(doc,
        'Mô hình thẩm định niềm tin (Trust Metrics) trong OpenPGP xác định mức độ tin cậy của một khóa công khai dựa trên đường dẫn tin cậy từ "Neo tin cậy" (Trust Anchor) đến khóa đích. Trong mạng lưới WoT chuẩn, mỗi nút duy trì hai giá trị riêng biệt:'
    )
    add_bullet(doc, ' Mức độ xác thực rằng khóa này thực sự thuộc về người mang User ID tương ứng (None, Marginal, Fully, Ultimate).', bold_prefix='• Độ hợp lệ của khóa (Key Validity):')
    add_bullet(doc, ' Mức độ tin tưởng rằng người sở hữu khóa này có khả năng thẩm định và ký chứng thực chính xác cho người khác (Unknown, Untrusted, Marginal, Fully, Ultimate).', bold_prefix='• Mức tín nhiệm chủ thể (Owner Trust):')
    add_para(doc,
        'Thuật toán tính toán đường tin cậy chuẩn quy định rằng: Một khóa đích $K$ được xem là hợp lệ hoàn toàn (Fully Valid) nếu thỏa mãn một trong hai điều kiện: (1) Được ký trực tiếp bởi ít nhất 1 khóa có Ultimate Trust (ví dụ chính Root CA); hoặc (2) Được ký bởi ít nhất 1 khóa Fully Trusted, hoặc được ký bởi ít nhất $m$ khóa Marginally Trusted (thông thường $m=3$).'
    )
    add_para(doc,
        'Hệ thống của chúng tôi tận dụng cơ chế này: Bằng cách gán cho Corporate Root CA mức tín nhiệm cao nhất (`Ultimate Trust` theo chuẩn OpenPGP), mọi chứng chỉ nhân viên được Root CA ký mộc trực tiếp đều mặc định đạt trạng thái `Fully Valid` trong toàn doanh nghiệp, giải quyết hiệu quả bài toán khởi tạo danh tính ban đầu của WoT thuần.'
    )

    # 2.4 Shamir Secret Sharing trên GF(256)
    add_h2(doc, '2.4 Giao thức chia sẻ bí mật Shamir trên trường hữu hạn GF(256)')
    add_para(doc,
        'Lược đồ chia sẻ bí mật ngưỡng $(k, n)$ do Adi Shamir phát minh năm 1979 dựa trên nguyên lý hình học: Qua $k$ điểm phân biệt trên mặt phẳng tọa độ, tồn tại duy nhất một đa thức bậc tối đa $k-1$ đi qua tất cả các điểm đó. Nếu biết ít hơn $k$ điểm, về mặt lý thuyết thông tin (Information-theoretic Security), kẻ tấn công không thể suy diễn được giá trị bí mật gốc nếu không đủ số lượng mảnh theo ngưỡng (mọi giá trị bí mật đều có xác suất xuất hiện như nhau).'
    )
    add_para(doc,
        'Để áp dụng trên máy tính và xử lý dữ liệu nhị phân không bị tràn số học, các phép toán đại số không thực hiện trên trường số thực mà được chuyển đổi sang Trường hữu hạn Galois Field $GF(2^8) = GF(256)$. Trường $GF(256)$ được xây dựng bằng đa thức bất khả quy tiêu chuẩn của chuẩn mã hóa AES / Rijndael: $P(x) = x^8 + x^4 + x^3 + x + 1$ (tương ứng với giá trị nhị phân `0x11B`).'
    )
    add_para(doc,
        r'Trong $GF(256)$, phép cộng và phép trừ tương đương với phép toán XOR bit ($\oplus$). Phép nhân và phép chia được thực hiện nhanh chóng thông qua Bảng logarit (Log Table) và Bảng hàm mũ (Exp Table): $a \cdot b = \exp((\log(a) + \log(b)) \pmod{255})$.'
    )
    add_para(doc,
        r'Quy trình chia sẻ bí mật ngưỡng $(k, n)$ diễn ra như sau: Giả sử bí mật là một byte $S \in GF(256)$.'
    )
    add_bullet(doc, r' Thiết lập đa thức ngẫu nhiên bậc $k-1$: $f(x) = a_0 + a_1 x + a_2 x^2 + \dots + a_{k-1} x^{k-1} \pmod{P(x)}$, trong đó hệ số tự do $a_0 = S$, và các hệ số $a_1, \dots, a_{k-1}$ được sinh ngẫu nhiên từ bộ sinh số ngẫu nhiên mật mã (CSPRNG).', bold_prefix='1. Bước phân chia (Split):')
    add_bullet(doc, r' Tính toán $n$ điểm tọa độ $(x_i, y_i)$ với $x_i \in \{1, 2, \dots, n\}$ và $y_i = f(x_i)$. Mỗi điểm $(x_i, y_i)$ là một mảnh bí mật (Share) giao cho một người giữ.', bold_prefix='2. Tạo mảnh (Shares):')
    add_bullet(doc, r' Khi tập hợp đủ tập con $k$ mảnh bất kỳ $\{(x_1, y_1), (x_2, y_2), \dots, (x_k, y_k)\}$, bí mật $S = f(0)$ được khôi phục chính xác bằng công thức nội suy Lagrange:', bold_prefix='3. Phục hồi (Combine):')

    add_code_block(doc,
        'f(0) = \u2211 [j=1..k] y_j \u22C5 \u2113_j(0)\n'
        'Trong đó đa thức cơ sở Lagrange:\n'
        '\u2113_j(0) = \u220F [m \u2260 j] (0 - x_m) / (x_j - x_m) = \u220F [m \u2260 j] x_m / (x_m \u2295 x_j)  (trong GF(256))',
        caption='Công thức 2.1: Phép nội suy Lagrange khôi phục bí mật f(0) trên trường hữu hạn GF(256)'
    )

    # 2.5 Cây Merkle RFC 6962
    add_h2(doc, '2.5 Cây Merkle (RFC 6962) và cấu trúc dữ liệu chứng minh kiểm toán bất biến')
    add_para(doc,
        'Nhật ký kiểm toán (Audit Log) trong một hệ thống CA doanh nghiệp là thành phần dữ liệu cốt lõi ghi lại các hành động cấp phát, thu hồi chứng chỉ và ký số tài liệu. Nếu nhật ký chỉ được lưu vào bảng cơ sở dữ liệu quan hệ thông thường mà không có cơ chế bảo vệ tính toàn vẹn, các bản ghi có thể bị sửa đổi hoặc xóa bỏ nhằm che giấu hành vi bất thường.'
    )
    add_para(doc,
        'Để giải quyết bài toán chống giả mạo nhật ký, đồ án áp dụng cấu trúc Cây băm Merkle tuân thủ tiêu chuẩn RFC 6962 (Certificate Transparency). Cây Merkle là cây nhị phân cân bằng, trong đó các nút lá chứa mã băm mật mã của từng bản ghi nhật ký, còn các nút nội bộ chứa mã băm kết hợp của hai nút con:'
    )
    add_bullet(doc, r' $LeafHash = \text{SHA-256}(0x00 \ || \ EntryData)$: tiền tố 0x00 ngăn ngừa tấn công va chạm nút lá.', bold_prefix='- Băm nút lá (Leaf Hash):')
    add_bullet(doc, r' $NodeHash = \text{SHA-256}(0x01 \ || \ LeftChildHash \ || \ RightChildHash)$: tiền tố 0x01 ngăn ngừa tấn công độ dài mở rộng và va chạm cây.', bold_prefix='- Băm nút nội bộ (Internal Hash):')
    add_bullet(doc, ' Nút gốc của cây (Merkle Root) đại diện cho toàn bộ trạng thái của sổ cái tại một thời điểm nhất định. Bằng việc định kỳ công bố hoặc ký số Merkle Root, toàn bộ lịch sử hệ thống được "đóng băng" bất biến.', bold_prefix='- Gốc cây Merkle (Root Hash / Checkpoint):')
    add_para(doc,
        r'Đặc tính ưu việt nhất của Cây Merkle là Bằng chứng kiểm toán (Audit Proof / Inclusion Proof): Để chứng minh một bản ghi thứ $i$ nằm trong cây có $N$ lá, hệ thống chỉ cần cung cấp một đường dẫn băm (Audit Path) gồm đúng $\lceil \log_2 N \rceil$ nút anh em (Sibling Hashes). Người thẩm định bên ngoài có thể tự tính toán lại Merkle Root chỉ trong vài phép băm mà không cần tải về toàn bộ cơ sở dữ liệu nhật ký.'
    )

    add_figure(doc, 'diagrams/technical_code_architecture.png',
        'Hình 2.3: Kiến trúc mô-đun kỹ thuật và sơ đồ cấu trúc dữ liệu Merkle'
    )

    doc.add_page_break()
    print("Chapter 2 generated successfully.")
