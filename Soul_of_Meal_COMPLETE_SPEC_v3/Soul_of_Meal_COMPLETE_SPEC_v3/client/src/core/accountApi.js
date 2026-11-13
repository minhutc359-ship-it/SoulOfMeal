export class AccountError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const messages = {
  invalid_registration: 'Tên tài khoản gồm 3–24 chữ, số hoặc dấu gạch dưới. Mật khẩu cần 12–128 ký tự.',
  invalid_login: 'Tên tài khoản hoặc mật khẩu không đúng.',
  username_taken: 'Tên tài khoản đã được sử dụng.',
  session_active: 'Trình duyệt đang có một phiên đăng nhập. Hãy tiếp tục hoặc đăng xuất phiên đó.',
  session_expired: 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.',
  rate_limited: 'Bạn đã thử quá nhiều lần. Hãy chờ một phút rồi thử lại.',
  save_conflict: 'Một thiết bị khác đã lưu tiến trình mới hơn.',
  save_too_large: 'Bản lưu đã vượt dung lượng cho phép.',
  invalid_practice_save: 'Dữ liệu bản chơi thử không hợp lệ.',
  csrf: 'Không xác minh được yêu cầu. Hãy thử lại.',
  invalid_profile: 'Tên Người Kết Vị chưa hợp lệ.',
  profile_exists: 'Hồ sơ đã được tạo trên thiết bị khác. Hãy mở lại tài khoản.',
  profile_required: 'Hãy tạo hồ sơ trước khi triệu hồi.',
  invalid_draw: 'Yêu cầu triệu hồi không hợp lệ.',
  idempotency_conflict: 'Mã giao dịch đã được dùng cho lượt triệu hồi khác.',
  insufficient_funds: 'Không đủ vé hoặc Tinh Thạch.',
  banner_limit: 'Đã hết lượt của giao ước này.',
  network: 'Không kết nối được máy chủ. Hãy thử lại.',
};

export function accountErrorMessage(error) {
  return messages[error?.code] ?? 'Máy chủ chưa xử lý được yêu cầu. Hãy thử lại.';
}

export function createAccountApi(fetchRequest = globalThis.fetch) {
  let token;

  async function request(path, options) {
    let response;
    try {
      response = await fetchRequest('/api/v1' + path, {
        credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000), ...options,
      });
    } catch {
      throw new AccountError('network', 0);
    }
    if (response.ok) return response;
    const data = await response.json().catch(() => null);
    const code = data?.code ?? ({ 401: 'session_expired', 429: 'rate_limited' })[response.status];
    throw new AccountError(code, response.status);
  }

  async function mutate(path, method, body, keepalive = false, extraHeaders = {}) {
    async function send() {
      token ??= (await (await request('/auth/csrf')).json()).token;
      return request(path, {
        method, body, keepalive,
        headers: { 'Content-Type': 'application/json', 'X-Soul-CSRF': token, ...extraHeaders },
      });
    }

    try {
      return await send();
    } catch (error) {
      if (error.code !== 'csrf') throw error;
      token = undefined;
      return send();
    }
  }

  async function bootstrap() {
    return (await request('/me/bootstrap')).json();
  }

  return {
    bootstrap,
    async providers() {
      return (await request('/auth/providers')).json();
    },
    async guest() {
      await mutate('/auth/guest', 'POST');
      token = undefined;
      return bootstrap();
    },
    async createPlayer(accountId, name) {
      return (await mutate('/player/create', 'POST', JSON.stringify({ name }), false, { 'X-Soul-Account': accountId })).json();
    },
    async draw(accountId, request) {
      return (await mutate('/gacha/draw', 'POST', JSON.stringify(request), false, { 'X-Soul-Account': accountId })).json();
    },
    async authenticate(action, credentials) {
      await mutate('/auth/' + action, 'POST', JSON.stringify(credentials));
      token = undefined;
      return bootstrap();
    },
    async logout(accountId) {
      const headers = accountId ? { 'X-Soul-Account': accountId } : {};
      await mutate('/auth/logout', 'POST', undefined, false, headers);
      token = undefined;
    },
    async save(accountId, expectedRevision, snapshotJson, keepalive) {
      const body = `{"accountId":${JSON.stringify(accountId)},"expectedRevision":${expectedRevision},"snapshot":${snapshotJson}}`;
      const useKeepalive = keepalive && new TextEncoder().encode(body).length < 60000;
      return (await mutate('/me/practice-save', 'PUT', body, useKeepalive)).json();
    },
  };
}
