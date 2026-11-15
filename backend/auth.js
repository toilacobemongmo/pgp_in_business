/**
 * AUTH & AUTHORIZATION (server-side, tối thiểu)
 * ------------------------------------------------
 * Trước đây phân quyền chỉ là state `userRole` ở frontend (App.jsx), nghĩa là
 * mở DevTools đổi biến là thành admin. Module này đưa quyết định phân quyền về
 * phía server.
 *
 * Mô hình: mỗi role có một token cấu hình qua biến môi trường. Client gửi
 * `Authorization: Bearer <token>` hoặc header `X-API-Key: <token>`.
 *
 *   AUTH_TOKEN_ADMIN     (đọc/sửa toàn hệ thống, cấp/thu hồi, unseal/seal, shamir)
 *   AUTH_TOKEN_EMPLOYEE  (cán bộ nội bộ: ký/xác thực tài liệu, giải mã thư của mình)
 *   AUTH_TOKEN_PARTNER   (đối tác B2B: tra danh bạ, gửi/giải mã thư B2B)
 *   (public không cần token — chỉ verify công khai và đọc dữ liệu công khai)
 *
 * Nguyên tắc fail-closed:
 *  - KHÔNG có token mặc định nào hardcode trong mã nguồn hay bundle.
 *  - Nếu biến môi trường chưa được cấu hình thì các role đó coi như KHÔNG tồn tại
 *    (không ai có thể đăng nhập bằng token đoán được). Riêng khi
 *    `AUTH_DISABLED=true` (chỉ dùng cho dev/demo cục bộ) thì middleware bỏ qua.
 */

export const ROLES = Object.freeze(['admin', 'employee', 'partner', 'public']);

const ROLE_ENV_MAP = Object.freeze({
  admin: 'AUTH_TOKEN_ADMIN',
  employee: 'AUTH_TOKEN_EMPLOYEE',
  partner: 'AUTH_TOKEN_PARTNER'
});

// Token tối thiểu 16 ký tự để tránh cấu hình kiểu "123456".
const MIN_TOKEN_LEN = 16;

function httpError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Đọc bảng token → role từ biến môi trường tại thời điểm gọi (không cache),
 * để test có thể đổi env giữa các lần khởi động.
 */
export function loadTokenTable(env = process.env) {
  const table = [];
  const warnings = [];

  for (const [role, varName] of Object.entries(ROLE_ENV_MAP)) {
    const raw = env[varName];
    if (!raw || !raw.trim()) continue;

    const token = raw.trim();
    if (token.length < MIN_TOKEN_LEN) {
      // Không ném lỗi cứng để server vẫn khởi động, nhưng role này bị vô hiệu.
      warnings.push(`${varName} ngắn hơn ${MIN_TOKEN_LEN} ký tự nên đã bị bỏ qua.`);
      continue;
    }
    table.push({ token, role });
  }

  return { table, warnings };
}

export function isAuthDisabled(env = process.env) {
  return String(env.AUTH_DISABLED || '').toLowerCase() === 'true';
}

/**
 * Tách token từ request. Ưu tiên Authorization: Bearer, sau đó X-API-Key.
 */
function extractToken(req) {
  const authHeader = req.get('authorization');
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  const apiKey = req.get('x-api-key');
  if (apiKey) return apiKey.trim();
  return null;
}

/**
 * Middleware xác thực: gắn `req.auth = { role, authenticated }`.
 * KHÔNG chặn ở đây — việc chặn thuộc về authorize()/requireAuth().
 */
export function authenticate(req, _res, next) {
  req.auth = { role: 'public', authenticated: false };

  if (isAuthDisabled()) {
    req.auth = { role: 'admin', authenticated: true, disabled: true };
    return next();
  }

  const token = extractToken(req);
  if (!token) return next();

  const { table } = loadTokenTable();
  // So sánh bằng length + timingSafeEqual để không lộ token qua thời gian phản hồi.
  const match = table.find((entry) => timingSafeEqualStr(entry.token, token));
  if (match) {
    req.auth = { role: match.role, authenticated: true };
  }
  return next();
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Middleware factory: chỉ cho phép các role trong danh sách.
 * - Chưa xác thực  -> 401 AUTH_REQUIRED
 * - Sai role       -> 403 FORBIDDEN
 */
export function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, _res, next) {
    const auth = req.auth || { role: 'public', authenticated: false };

    if (!allowedRoles.includes(auth.role)) {
      if (!auth.authenticated) {
        return next(httpError(
          401,
          'AUTH_REQUIRED',
          'Yêu cầu xác thực. Gửi header Authorization: Bearer <token> hoặc X-API-Key.'
        ));
      }
      return next(httpError(
        403,
        'FORBIDDEN',
        `Role "${auth.role}" không có quyền gọi endpoint này (yêu cầu: ${allowedRoles.join(', ')}).`
      ));
    }
    return next();
  };
}

/**
 * Middleware yêu cầu bất kỳ danh tính đã xác thực (không phải public).
 */
export function requireAuth() {
  return function requireAuthMiddleware(req, _res, next) {
    const auth = req.auth || { authenticated: false };
    if (!auth.authenticated) {
      return next(httpError(
        401,
        'AUTH_REQUIRED',
        'Yêu cầu xác thực. Gửi header Authorization: Bearer <token> hoặc X-API-Key.'
      ));
    }
    return next();
  };
}

/**
 * Endpoint tra cứu role hiện tại của token — frontend dùng để hiển thị đúng
 * giao diện mà không nhúng secret vào bundle.
 * Trả null nếu không có token / token không hợp lệ.
 */
export function describeAuth(req) {
  const auth = req.auth || { role: 'public', authenticated: false, disabled: false };
  return {
    role: auth.role,
    authenticated: Boolean(auth.authenticated),
    authDisabled: Boolean(auth.disabled)
  };
}

export { httpError };
