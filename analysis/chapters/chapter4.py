"""
Chương 4: Hiện thực hóa mã nguồn các phân hệ
"""
import os
from docx.shared import Pt, Cm
from report_helpers import (
    add_para, add_bullet, add_h1, add_h2, add_h3,
    add_table_caption, add_styled_table, add_figure, add_code_block
)

def build_chapter_4(doc):
    add_h1(doc, 'CHƯƠNG 4: HIỆN THỰC HÓA MÃ NGUỒN CÁC PHÂN HỆ', center=True)

    # 4.1 Shamir Envelope v2
    add_h2(doc, '4.1 Hiện thực Shamir Secret Sharing v2 chống rò rỉ độ dài (backend/shamir-service.js)')
    add_para(doc,
        'Trong quá trình rà quét mã nguồn ban đầu của dự án, Kỹ sư 2 đã phát hiện một loạt lỗ hổng bảo mật nghiêm trọng trong module phân chia bí mật Shamir cũ: (1) Độ dài chuỗi hex của từng mảnh tỷ lệ thuận chính xác 1:1 với độ dài chuỗi mật khẩu gốc, làm rò rỉ siêu dữ liệu độ dài (Length Leakage); (2) Các mảnh khóa không mang mã phiên, dẫn đến việc kẻ tấn công có thể trộn lẫn các mảnh sinh ra từ hai lần split khác nhau mà thuật toán combine vẫn âm thầm tính toán ra giá trị rác; (3) Khi giải mã thất bại, hàm unenvelope cũ âm thầm trả về chuỗi byte thô thay vì ném lỗi kiểm soát.'
    )
    add_para(doc,
        'Để khắc phục các điểm yếu trên, hệ thống đã chuẩn hóa và xây dựng đặc tả Shamir Envelope v2 với cấu trúc đóng gói khối byte bảo vệ như thể hiện trong Bảng 4.1.'
    )

    add_table_caption(doc, 'Bảng 4.1: Đặc tả chi tiết cấu trúc byte của gói tin Shamir Envelope v2')
    env_headers = ['Trường dữ liệu', 'Độ dài (Byte)', 'Kiểu dữ liệu', 'Mục đích & Ý nghĩa an ninh']
    env_data = [
        ['version', '1 Byte', '0x02', 'Định danh phiên bản phong bì v2; từ chối cứng mọi định dạng v1 cũ.'],
        ['sessionTag', '8 Byte', 'Random Bytes', 'Mã ngẫu nhiên 64-bit sinh bằng CSPRNG, chống trộn lẫn mảnh giữa các phiên.'],
        ['lenField', '4 Byte', 'Big-Endian UInt32', 'Ghi độ dài thực tế của bí mật ban đầu trước khi thêm padding.'],
        ['secretBytes', 'N Byte', 'Raw Binary / UTF-8', 'Nội dung dữ liệu bí mật cần bảo vệ (cụm mật khẩu Root CA).'],
        ['padding', 'P Byte (0..15)', '0x00 Bytes', 'Đệm các byte 0x00 cho đến khi tổng độ dài đạt bội số của Block Size 16 byte.'],
        ['tag', '16 Byte', 'SHA-256 Truncated', 'Mã kiểm tra toàn vẹn = SHA-256(payload_without_tag)[0..15] so sánh timingSafeEqual.']
    ]
    add_styled_table(doc, env_headers, env_data, col_widths=[2.8, 2.8, 3.2, 7.2])

    add_para(doc, 'Trích đoạn mã nguồn đóng gói phong bì Envelope v2 trong `backend/shamir-service.js`:')
    add_code_block(doc,
        'function envelopeSecret(secretBytes, options = {}) {\n'
        '    const blockSize = options.blockSize || DEFAULT_BLOCK_SIZE; // 16 bytes\n'
        '    const sessionTag = options.sessionTag || crypto.randomBytes(SESSION_TAG_BYTES); // 8 bytes\n'
        '    const rawLen = secretBytes.length;\n'
        '    const headerLen = 1 + SESSION_TAG_BYTES + 4; // 13 bytes\n'
        '    const totalLen = Math.ceil((headerLen + rawLen) / blockSize) * blockSize;\n'
        '    const padLen = totalLen - (headerLen + rawLen);\n'
        '\n'
        '    const bufWithoutTag = Buffer.alloc(totalLen);\n'
        '    bufWithoutTag[0] = ENVELOPE_VERSION; // 0x02\n'
        '    sessionTag.copy(bufWithoutTag, 1, 0, SESSION_TAG_BYTES);\n'
        '    bufWithoutTag.writeUInt32BE(rawLen, 1 + SESSION_TAG_BYTES);\n'
        '    secretBytes.copy(bufWithoutTag, headerLen);\n'
        '    bufWithoutTag.fill(0, headerLen + rawLen, totalLen);\n'
        '\n'
        '    const tag = crypto.createHash(\'sha256\').update(bufWithoutTag).digest().subarray(0, TAG_BYTES);\n'
        '    return { payload: Buffer.concat([bufWithoutTag, tag]), sessionTag };\n'
        '}',
        caption='Đoạn mã 4.1: Hàm envelopeSecret() đóng gói dữ liệu và đệm khối 16 byte'
    )

    add_para(doc, 'Hàm giải mã và kiểm tra toàn vẹn nghiêm ngặt trong `backend/shamir-service.js`:')
    add_code_block(doc,
        'function unenvelopeSecret(payload, expectedSessionTag = null) {\n'
        '    if (payload.length < 1 + SESSION_TAG_BYTES + 4 + TAG_BYTES) {\n'
        '        throw new Error(\'Payload qua ngan so voi envelope v2\');\n'
        '    }\n'
        '    const bufWithoutTag = payload.subarray(0, payload.length - TAG_BYTES);\n'
        '    const actualTag = payload.subarray(payload.length - TAG_BYTES);\n'
        '    const expectedTag = crypto.createHash(\'sha256\').update(bufWithoutTag).digest().subarray(0, TAG_BYTES);\n'
        '    if (!crypto.timingSafeEqual(actualTag, expectedTag)) {\n'
        '        throw new Error(\'Tag toan ven khong khop - manh bi sua doi hoac khong hop le\');\n'
        '    }\n'
        '    if (bufWithoutTag[0] !== ENVELOPE_VERSION) {\n'
        '        throw new Error(`Phien ban envelope khong hop le: ${bufWithoutTag[0]}`);\n'
        '    }\n'
        '    // Kiem tra sessionTag trung khop de chong tron manh\n'
        '    const parsedTag = bufWithoutTag.subarray(1, 1 + SESSION_TAG_BYTES);\n'
        '    if (expectedSessionTag && !crypto.timingSafeEqual(parsedTag, expectedSessionTag)) {\n'
        '        throw new Error(\'sessionTag trong envelope khong khop metadata cac manh\');\n'
        '    }\n'
        '    const rawLen = bufWithoutTag.readUInt32BE(1 + SESSION_TAG_BYTES);\n'
        '    return bufWithoutTag.subarray(1 + SESSION_TAG_BYTES + 4, 1 + SESSION_TAG_BYTES + 4 + rawLen);\n'
        '}',
        caption='Đoạn mã 4.2: Hàm unenvelopeSecret() thẩm tra chữ ký toàn vẹn và ném lỗi fail-closed'
    )

    # 4.2 Máy trạng thái Root CA & Thu hồi
    add_h2(doc, '4.2 Hiện thực máy trạng thái Root CA và xử lý thu hồi (backend/pgp-service.js)')
    add_para(doc,
        'Trong `backend/pgp-service.js`, đối tượng quản trị phiên Root CA (`caSession`) được lưu trữ trong bộ nhớ RAM ở phạm vi module, không ghi khóa đã giải mã xuống đĩa:'
    )
    add_code_block(doc,
        '// Trang thai phien lam viec cua Root CA (Luu trong RAM, khong bao gio luu xuong dia)\n'
        'const caSession = {\n'
        '    isSealed: true,\n'
        '    caPrivateKey: null,       // OpenPGP Private Key Object sau khi giai ma\n'
        '    unsealedAt: null,\n'
        '    expiresAt: null,\n'
        '    autoSealTimer: null,\n'
        '    ttlMs: Number(process.env.CA_UNSEAL_TTL_MS) || 5 * 60 * 1000, // 5 phut\n'
        '};\n'
        '\n'
        'function requireUnsealed() {\n'
        '    if (caSession.isSealed || !caSession.caPrivateKey) {\n'
        '        const err = new Error(\'Root CA dang bi NIEM PHONG (SEALED). Yeu cau Quorum unseal.\');\n'
        '        err.statusCode = 423;\n'
        '        err.code = \'CA_SEALED\';\n'
        '        throw err;\n'
        '    }\n'
        '    return caSession.caPrivateKey;\n'
        '}',
        caption='Đoạn mã 4.3: Cơ chế bảo vệ requireUnsealed() ném mã lỗi HTTP 423 Locked'
    )

    add_para(doc, 'Hàm `unsealCA` và cơ chế kích hoạt bộ đếm tự động niêm phong (`_armAutoSeal`):')
    add_code_block(doc,
        'async function unsealCA(shareKeys = []) {\n'
        '    const db = store.getDb();\n'
        '    // 1. Phuc hoi passphrase tu k manh Shamir\n'
        '    const passphrase = shamirService.combine(shareKeys);\n'
        '    // 2. Giai ma khoa rieng Root CA tu chuoi armored trong db.json\n'
        '    const caKeyObj = await openpgp.readPrivateKey({ armoredKey: db.ca_config.privateKeyArmored });\n'
        '    const decryptedCaKey = await openpgp.decryptKey({ privateKey: caKeyObj, passphrase });\n'
        '\n'
        '    caSession.isSealed = false;\n'
        '    caSession.caPrivateKey = decryptedCaKey;\n'
        '    caSession.unsealedAt = new Date().toISOString();\n'
        '    caSession.expiresAt = new Date(Date.now() + caSession.ttlMs).toISOString();\n'
        '    _armAutoSeal(); // Kich hoat timer tu dong niem phong\n'
        '\n'
        '    store.logAudit({\n'
        '        action: \'CA_UNSEAL\',\n'
        '        actor: \'Multi-Admin Quorum\',\n'
        '        details: `Root CA mo niem phong thanh cong bang ${shareKeys.length} manh quorum. TTL: ${caSession.ttlMs / 1000}s`,\n'
        '    });\n'
        '    return { success: true, expiresAt: caSession.expiresAt };\n'
        '}',
        caption='Đoạn mã 4.4: Quy trình Unseal Root CA từ các mảnh Quorum và ghi nhật ký Merkle'
    )

    # 4.3 Phân quyền RBAC & server.js
    add_h2(doc, '4.3 Hiện thực phân quyền RBAC và kiểm soát truy cập Endpoint (backend/auth.js, server.js)')
    add_para(doc,
        'Mô hình xác thực trong `backend/auth.js` sử dụng chuỗi Token được cấu hình qua biến môi trường hệ thống (`AUTH_TOKEN_ADMIN`, `AUTH_TOKEN_EMPLOYEE`, `AUTH_TOKEN_PARTNER`). Hệ thống áp dụng thuật toán so sánh chuỗi đẳng thời gian `timingSafeEqualStr` nhằm giảm thiểu nguy cơ tấn công dò tìm theo thời gian (Timing Attacks).'
    )

    add_table_caption(doc, 'Bảng 4.2: Bảng quy chuẩn ánh xạ mã lỗi HTTP bảo mật và ngữ nghĩa hệ thống')
    http_headers = ['Mã HTTP', 'Mã lỗi hệ thống', 'Ý nghĩa & Bối cảnh kích hoạt', 'Hành vi phản ứng của hệ thống']
    http_data = [
        ['401 Unauthorized', 'AUTH_REQUIRED', 'Yêu cầu không kèm Header Authorization hoặc Token rác.', 'Từ chối truy cập ngay tại middleware authenticate.'],
        ['403 Forbidden', 'FORBIDDEN', 'Token hợp lệ nhưng vai trò không đủ thẩm quyền (vd: Partner gọi issueCert).', 'Chặn truy cập tại middleware authorize(...roles).'],
        ['423 Locked', 'CA_SEALED', 'Đã xác thực thành công nhưng Root CA đang bị niêm phong (Sealed).', 'Chặn tại hàm requireUnsealed(); yêu cầu Quorum Unseal.'],
        ['400 Bad Request', 'INVALID_PARAM', 'Tham số đầu vào thiếu, định dạng mảnh sai, hoặc số mảnh < k.', 'Từ chối xử lý và trả về thông điệp hướng dẫn sửa lỗi.'],
        ['404 Not Found', 'NOT_FOUND', 'Không tìm thấy chứng chỉ, tài liệu hoặc nút trong đồ thị.', 'Trả về thông báo tài nguyên không tồn tại.'],
        ['500 Internal Error', 'CA_INIT_FAILED', 'Lỗi khởi tạo hệ thống (ví dụ thiếu cấu hình mật khẩu).', 'Ghi log chi tiết và dừng tiến trình an toàn.']
    ]
    add_styled_table(doc, http_headers, http_data, col_widths=[2.8, 3.2, 5.0, 5.0])

    add_para(doc, 'Trích đoạn mã nguồn Middleware `authenticate` và `authorize` trong `backend/auth.js`:')
    add_code_block(doc,
        'export function authenticate(req, _res, next) {\n'
        '    req.auth = { role: \'public\', authenticated: false };\n'
        '    const token = extractToken(req);\n'
        '    if (!token) return next();\n'
        '    const tokenTable = loadTokenTable();\n'
        '    const match = tokenTable.find(row => timingSafeEqualStr(row.token, token));\n'
        '    if (match) {\n'
        '        req.auth = { role: match.role, authenticated: true };\n'
        '    }\n'
        '    next();\n'
        '}\n'
        '\n'
        'export function authorize(...allowedRoles) {\n'
        '    return function authorizeMiddleware(req, _res, next) {\n'
        '        const auth = req.auth || { role: \'public\', authenticated: false };\n'
        '        if (!auth.authenticated) {\n'
        '            return next(httpError(401, \'AUTH_REQUIRED\', \'Yeu cau Token xac thuc.\'));\n'
        '        }\n'
        '        if (!allowedRoles.includes(auth.role)) {\n'
        '            return next(httpError(403, \'FORBIDDEN\', `Yeu cau vai tro: ${allowedRoles.join(\' hoac \')}`));\n'
        '        }\n'
        '        next();\n'
        '    };\n'
        '}',
        caption='Đoạn mã 4.5: Middleware xác thực và phân quyền RBAC'
    )

    # 4.4 Shard Store & Demo Gate
    add_h2(doc, '4.4 Hiện thực cô lập mảnh Quorum (file 0600) và cổng khóa Demo (quorum-shard-store.js, demo-mode.js)')
    add_para(doc,
        'Trước đây, khi sinh Root CA, các mảnh Shamir chỉ được in ra console hoặc để trôi nổi. Kỹ sư 2 xây dựng module `backend/quorum-shard-store.js` để tự động hóa việc xuất 5 mảnh khóa thành 5 tệp tin độc lập trong thư mục `backend/data/quorum-shards/` với phân quyền bảo mật POSIX `0600` (chỉ người dùng sở hữu tiến trình mới có quyền đọc/ghi).'
    )
    add_code_block(doc,
        'export function writeShards(shares = []) {\n'
        '    fs.mkdirSync(QUORUM_SHARD_DIR, { recursive: true, mode: 0o700 });\n'
        '    for (const [index, share] of shares.entries()) {\n'
        '        const holderRole = HOLDER_HINTS[index + 1] || `holder_${index + 1}`;\n'
        '        const fileName = toFileName(index, holderRole);\n'
        '        const filePath = path.join(QUORUM_SHARD_DIR, fileName);\n'
        '        // Chống tấn công Path Traversal\n'
        '        if (!filePath.startsWith(QUORUM_SHARD_DIR)) throw new Error(\'Invalid path traversal\');\n'
        '        const body = [\n'
        '            `# Shamir Secret Sharing - Manh Quorum ${index + 1}/${shares.length}`,\n'
        '            `# Nguoi giu: ${holderRole}`,\n'
        '            `# Canh bao: Ban giao xong phai xoa thu muc khoi server!`,\n'
        '            share.shareKey\n'
        '        ].join(\'\\n\');\n'
        '        fs.writeFileSync(filePath, body, { mode: 0o600, encoding: \'utf8\' });\n'
        '        try { fs.chmodSync(filePath, 0o600); } catch (_) {}\n'
        '    }\n'
        '}',
        caption='Đoạn mã 4.6: Ghi mảnh Quorum ra từng file riêng biệt với mode 0600'
    )

    add_para(doc,
        'Đồng thời, module `backend/demo-mode.js` quản lý cờ môi trường `DEMO_PLAINTEXT_KEYS`. Khi cờ này tắt (mặc định), hệ thống không trả về trường `demoPrivateKeyArmored` hoặc lưu khóa riêng dạng plaintext vào cơ sở dữ liệu `db.json`.'
    )

    # 4.5 Packet Inspector & Merkle & WoT
    add_h2(doc, '4.5 Hiện thực công cụ bóc tách gói tin, cây Merkle và đồ thị Web of Trust')
    add_para(doc,
        'Phân hệ `backend/pgp-packet-inspector.js` thực hiện giải mã từng byte của chuỗi nhị phân OpenPGP, nhận diện cấu trúc tiêu đề gói tin (Header Format: Old Format 2-bit tag hoặc New Format 6-bit tag) và phân tích các trường chi tiết.'
    )
    add_para(doc,
        'Phân hệ `backend/merkle-engine.js` hiện thực cấu trúc cây Merkle động với các hàm cốt lõi `append(entry)`, `getRoot()`, và `getProof(leafIndex)`. Mỗi khối dữ liệu trước khi ghép cây đều được băm tiền tố để triệt tiêu nguy cơ tấn công Second Preimage:'
    )
    add_code_block(doc,
        'hashLeaf(data) {\n'
        '    return crypto.createHash(\'sha256\').update(Buffer.concat([Buffer.from([0x00]), Buffer.from(data)])).digest(\'hex\');\n'
        '}\n'
        'hashInternal(left, right) {\n'
        '    return crypto.createHash(\'sha256\').update(Buffer.concat([\n'
        '        Buffer.from([0x01]), Buffer.from(left, \'hex\'), Buffer.from(right, \'hex\')\n'
        '    ])).digest(\'hex\');\n'
        '}',
        caption='Đoạn mã 4.7: Thuật toán băm nút lá và nút nội bộ cây Merkle chuẩn RFC 6962'
    )

    doc.add_page_break()
    print("Chapter 4 generated successfully.")
