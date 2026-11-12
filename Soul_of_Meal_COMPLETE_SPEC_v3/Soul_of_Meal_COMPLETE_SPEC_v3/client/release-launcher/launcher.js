import { activeContentRelease } from './contentRelease.js';

const status = document.querySelector('[role="status"]');
const retry = document.querySelector('button');
const root = new URL('../', location.href);

async function enter() {
  retry.hidden = true;
  status.textContent = 'Đang mở Hành Trình Vị Linh…';
  try {
    const release = await activeContentRelease(root);
    location.replace(release.entry);
  } catch {
    status.textContent = 'Chưa tải được bản phát hành. Kiểm tra kết nối rồi thử lại.';
    retry.hidden = false;
    retry.focus();
  }
}

retry.addEventListener('click', enter);
void enter();
