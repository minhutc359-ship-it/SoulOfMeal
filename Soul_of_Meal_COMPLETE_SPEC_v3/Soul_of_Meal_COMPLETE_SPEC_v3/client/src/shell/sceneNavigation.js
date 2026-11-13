// One history entry per game scene. Native modal dialogs get first refusal on Back.
export function bindSceneNavigation({ current, show, closeOverlay, confirmExit }) {
  const run = crypto.randomUUID();
  const initial = { run, page: current(), depth: 0 };
  let entry = initial;
  let allowedPop = false;
  history.replaceState({ ...history.state, game: entry }, '');

  function go(page, { replace = false } = {}) {
    if (page === current()) return;
    entry = { run, page, depth: entry.depth + Number(!replace) };
    if (replace) history.replaceState({ game: entry }, '');
    else history.pushState({ game: entry }, '');
    show(page);
  }

  window.addEventListener('popstate', event => {
    const next = event.state?.game;
    if (next?.run !== run) return;
    if (!allowedPop && closeOverlay()) {
      history.pushState({ game: entry }, '');
      return;
    }
    if (!allowedPop && next.page !== entry.page && confirmExit(next.page, () => {
      allowedPop = true;
      history.back();
    })) {
      history.pushState({ game: entry }, '');
      return;
    }
    allowedPop = false;
    entry = next;
    show(entry.page);
  });

  return { go, back(fallback) {
    if (entry.depth > 0) history.back();
    else go(fallback);
  } };
}
