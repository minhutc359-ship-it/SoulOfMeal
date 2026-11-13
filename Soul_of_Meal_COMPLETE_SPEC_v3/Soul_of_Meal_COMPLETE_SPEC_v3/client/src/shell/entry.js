export function renderEntry(app, enter, openAccount, continueAccount) {
  app.innerHTML = `
    <main class="entry">
      <div class="entry-copy">
        <div class="title-lockup" aria-hidden="true">SOUL <em>OF</em> MEAL</div>
        <h1>Hành Trình<br>Vị Linh</h1>
        <button class="entry-action" type="button" data-enter><span>Bắt đầu</span><b aria-hidden="true">›</b></button>
        <p class="entry-note">Chơi khách · Tiến trình lưu trên thiết bị này</p>
        ${continueAccount ? '<button class="entry-account" type="button" data-resume-account hidden>Tiếp tục tài khoản</button>' : ''}
        ${openAccount ? '<button class="entry-account" type="button" data-open-account>Tài khoản</button>' : ''}
        <div class="entry-loading" hidden>
          <progress value="0" max="100" aria-label="Tiến độ tải game"></progress>
          <p role="status"></p>
        </div>
      </div>
    </main>`;
  const button = app.querySelector('[data-enter]');
  const label = button.querySelector('span');
  const account = app.querySelector('[data-open-account]');
  const resume = app.querySelector('[data-resume-account]');
  const buttons = [button, account, resume].filter(Boolean);
  const loading = app.querySelector('.entry-loading');
  const progress = loading.querySelector('progress');
  const status = loading.querySelector('[role="status"]');

  function run(action, activeButton) {
    return async () => {
      for (const control of buttons) control.disabled = true;
      if (activeButton === button) label.textContent = 'Đang mở game';
      loading.hidden = false;
      progress.hidden = false;
      let waiting = true;
      try {
        await action((value, message) => {
          if (!waiting) return;
          progress.value = value;
          status.textContent = message;
        });
      } catch (error) {
        progress.hidden = true;
        status.textContent = error instanceof Error ? error.message : 'Không thể mở game.';
        if (activeButton === button) label.textContent = 'Thử lại';
        for (const control of buttons) control.disabled = false;
        activeButton.focus();
      } finally {
        waiting = false;
      }
    };
  }

  button.addEventListener('click', run(enter, button));
  account?.addEventListener('click', openAccount);
  resume?.addEventListener('click', run(continueAccount, resume));
  return resume;
}
