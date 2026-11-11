export function renderEntry(app, enter) {
  app.innerHTML = `
    <main class="entry">
      <div class="entry-copy">
        <div class="title-lockup" aria-hidden="true">SOUL <em>OF</em> MEAL</div>
        <h1>Hành Trình<br>Vị Linh</h1>
        <button class="entry-action" type="button" data-enter><span>Bắt đầu</span><b aria-hidden="true">›</b></button>
        <p class="entry-note">Chơi khách · Tiến trình lưu trên thiết bị này</p>
        <div class="entry-loading" hidden>
          <progress value="0" max="100" aria-label="Tiến độ tải game"></progress>
          <p role="status"></p>
        </div>
      </div>
    </main>`;
  const button = app.querySelector('[data-enter]');
  const label = button.querySelector('span');
  const loading = app.querySelector('.entry-loading');
  const progress = loading.querySelector('progress');
  const status = loading.querySelector('[role="status"]');

  button.addEventListener('click', async () => {
    button.disabled = true;
    label.textContent = 'Đang mở game';
    loading.hidden = false;
    progress.hidden = false;
    let waiting = true;
    try {
      await enter((value, message) => {
        if (!waiting) return;
        progress.value = value;
        status.textContent = message;
      });
    } catch (error) {
      progress.hidden = true;
      status.textContent = error instanceof Error ? error.message : 'Không thể mở game.';
      label.textContent = 'Thử lại';
      button.disabled = false;
      button.focus();
    } finally {
      waiting = false;
    }
  });
}
