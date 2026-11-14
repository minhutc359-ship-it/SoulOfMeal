import { CHAPTER_DIALOGUES, FIRST_CHAPTER, chapterForScene } from '../modes/adventureStory.js';
import { actorArt } from '../render/spriteAssets.js';

export function openStoryDialog(host, scene) {
  const { chapter = FIRST_CHAPTER, title, lines } = CHAPTER_DIALOGUES[scene];
  const chapterNumber = chapterForScene(scene)?.number;
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'story-dialog';
  dialog.setAttribute('aria-labelledby', 'story-title');
  dialog.innerHTML = `
    <header class="story-heading">
      <div><small data-story-chapter></small><h2 id="story-title"></h2></div>
      <button class="button light compact" type="button" data-story-close aria-label="Đóng đối thoại">×</button>
    </header>
    <div class="story-line">
      <img data-story-portrait alt="">
      <div aria-live="polite"><strong data-story-speaker></strong><p data-story-text></p></div>
    </div>
    <footer class="story-actions">
      <button class="button light" type="button" data-story-back>Trở lại</button>
      <span data-story-progress aria-label="Trang đối thoại"></span>
      <button class="button" type="button" data-story-next autofocus>Tiếp</button>
    </footer>`;

  dialog.querySelector('[data-story-chapter]').textContent = chapterNumber ? `Chương ${chapterNumber} · ${chapter}` : chapter;
  dialog.querySelector('#story-title').textContent = title;
  const back = dialog.querySelector('[data-story-back]');
  const next = dialog.querySelector('[data-story-next]');
  let index = 0;

  function showLine() {
    const { speaker, art, text } = lines[index];
    dialog.querySelector('[data-story-portrait]').src = actorArt(art);
    dialog.querySelector('[data-story-speaker]').textContent = speaker;
    dialog.querySelector('[data-story-text]').textContent = text;
    dialog.querySelector('[data-story-progress]').textContent = `${index + 1} / ${lines.length}`;
    if (index && host.dataset.motion !== 'reduced') {
      dialog.querySelector('[data-story-text]').animate?.([{ opacity: .55 }, { opacity: 1 }], { duration: 180 });
    }
    back.disabled = index === 0;
    next.textContent = index === lines.length - 1 ? 'Kết thúc' : 'Tiếp';
  }

  dialog.querySelector('[data-story-close]').addEventListener('click', () => dialog.close());
  back.addEventListener('click', () => {
    if (index > 0) {
      index -= 1;
      showLine();
      if (back.disabled) next.focus();
    }
  });
  next.addEventListener('click', () => {
    if (index === lines.length - 1) dialog.close();
    else {
      index += 1;
      showLine();
    }
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    const returnFocus = host.contains(previousFocus) ? previousFocus : host.querySelector('main h1');
    returnFocus?.focus({ preventScroll: true });
  });

  host.append(dialog);
  showLine();
  dialog.showModal();
}
