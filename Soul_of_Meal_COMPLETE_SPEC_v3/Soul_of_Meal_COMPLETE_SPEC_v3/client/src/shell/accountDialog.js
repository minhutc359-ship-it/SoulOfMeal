import { AccountError, accountErrorMessage } from '../core/accountApi.js';

export function openAccountDialog(host, api, accept, expectedAccount) {
  if (host.querySelector('.account-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'account-dialog';
  dialog.setAttribute('aria-labelledby', 'account-title');
  dialog.innerHTML = `
    <div class="account-heading"><h2 id="account-title">Tài khoản Soul of Meal</h2><button type="button" class="button light compact" data-close aria-label="Đóng">×</button></div>
    <form data-account-form>
      <label>Tên tài khoản<input name="username" required autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}"></label>
      <label>Mật khẩu<input name="password" type="password" required autocomplete="current-password" maxlength="128"></label>
      <div class="action-row">
        <button class="button" type="submit" value="login">Đăng nhập</button>
        ${expectedAccount ? '' : '<button class="button light" type="submit" value="register">Tạo tài khoản</button>'}
      </div>
      ${expectedAccount ? '' : '<p class="account-help">Tài khoản mới bắt đầu hành trình riêng. Tên gồm 3–24 chữ Latin, số hoặc _. Mật khẩu từ 12 ký tự.</p>'}
    </form>
    ${expectedAccount ? '' : `<div class="action-row" data-account-providers>
      <button class="button light" type="button" data-google hidden>Tiếp tục bằng Google</button>
      <button class="button light" type="button" data-cloud-guest>Chơi thử với lưu máy chủ</button></div>
      <p class="account-help" data-guest-note>Phiên khách máy chủ gắn với trình duyệt này. Hãy chọn tài khoản nếu cần đăng nhập trên thiết bị khác.</p>`}
    <div class="account-session" hidden>
      <p data-session-label></p>
      <div class="action-row"><button class="button" type="button" data-resume>Tiếp tục</button><button class="button light" type="button" data-clear-session>Đăng xuất</button></div>
    </div>
    <p class="account-status" role="status"></p>`;

  const form = dialog.querySelector('form');
  const status = dialog.querySelector('.account-status');
  const session = dialog.querySelector('.account-session');
  const resume = dialog.querySelector('[data-resume]');
  const close = dialog.querySelector('[data-close]');
  const providers = dialog.querySelector('[data-account-providers]');
  const guestNote = dialog.querySelector('[data-guest-note]');
  const google = dialog.querySelector('[data-google]');
  if (expectedAccount) {
    form.elements.username.value = expectedAccount.username;
    form.elements.username.readOnly = true;
  }
  let busy = false;

  function showSession(bootstrap) {
    const matches = !expectedAccount || expectedAccount.id === bootstrap.account.id;
    form.hidden = true;
    session.hidden = false;
    if (providers) providers.hidden = true;
    if (guestNote) guestNote.hidden = true;
    resume.hidden = !matches;
    session.querySelector('[data-session-label]').textContent = matches
      ? 'Phiên đăng nhập của ' + bootstrap.account.username
      : 'Hãy đăng xuất phiên hiện tại để quay lại tài khoản đang chơi.';
  }

  async function run(action) {
    if (busy) return;
    busy = true;
    dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
    status.textContent = 'Đang kết nối…';
    try {
      await action();
      status.textContent = '';
    } catch (error) {
      status.textContent = accountErrorMessage(error);
    } finally {
      dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
      busy = false;
    }
  }

  async function openGame(bootstrap) {
    showSession(bootstrap);
    if (expectedAccount && expectedAccount.id !== bootstrap.account.id) throw new AccountError('session_active', 409);
    await accept(bootstrap, (_, message) => { status.textContent = message; });
    dialog.close();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const action = event.submitter?.getAttribute('value') ?? 'login';
    run(async () => {
      try {
        const bootstrap = await api.authenticate(action, {
          username: form.elements.username.value.trim(),
          password: form.elements.password.value,
        });
        form.elements.password.value = '';
        await openGame(bootstrap);
      } catch (error) {
        if (error.code !== 'session_active') throw error;
        showSession(await api.bootstrap());
      }
    });
  });

  resume.addEventListener('click', () => run(async () => openGame(await api.bootstrap())));
  dialog.querySelector('[data-clear-session]').addEventListener('click', () => run(async () => {
    try {
      await api.logout();
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    session.hidden = true;
    if (providers) providers.hidden = false;
    if (guestNote) guestNote.hidden = false;
    form.hidden = false;
    form.elements.username.focus();
  }));
  google?.addEventListener('click', () => { location.assign('/api/v1/auth/providers/google/start'); });
  dialog.querySelector('[data-cloud-guest]')?.addEventListener('click', () => run(async () => openGame(await api.guest())));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => dialog.remove());

  host.append(dialog);
  dialog.showModal();
  if (google) void api.providers().then(result => { google.hidden = !result.google; }).catch(() => {});
  run(async () => {
    try {
      showSession(await api.bootstrap());
    } catch (error) {
      if (error.status !== 401) throw error;
    }
  });
}
