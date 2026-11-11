export function createCloudSave(api, accountId, practiceSave, onStatus, debounceMs = 600) {
  let revision = practiceSave.revision;
  let synced = practiceSave.snapshot === null ? null : JSON.stringify(practiceSave.snapshot);
  let desired = synced;
  let timer;
  let inFlight;
  let blocked = false;
  let failure;

  function dirty() {
    return Boolean(inFlight) || desired !== synced;
  }

  function cancelTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  async function drain(keepalive) {
    onStatus('saving');
    try {
      while (desired !== synced) {
        const snapshot = desired;
        const result = await api.save(accountId, revision, snapshot, keepalive);
        synced = snapshot;
        revision = result.revision;
      }
      failure = undefined;
      onStatus('saved');
      return true;
    } catch (error) {
      failure = error;
      blocked = true;
      onStatus('error', error);
      return false;
    }
  }

  function flush({ keepalive = false } = {}) {
    cancelTimer();
    if (inFlight) return inFlight;
    if (blocked) return Promise.resolve(false);
    if (!dirty()) return Promise.resolve(true);
    inFlight = drain(keepalive).finally(() => { inFlight = undefined; });
    return inFlight;
  }

  return {
    stage(save) {
      const snapshot = JSON.stringify(save);
      if (snapshot === desired) return;
      desired = snapshot;
      if (inFlight || blocked) return;
      cancelTimer();
      if (!dirty()) {
        onStatus('saved');
        return;
      }
      onStatus('pending');
      timer = setTimeout(flush, debounceMs);
    },
    flush,
    dirty,
    retry({ reauthenticated = false } = {}) {
      if (failure?.code === 'save_conflict' || (failure?.status === 401 && !reauthenticated)) {
        return Promise.resolve(false);
      }
      blocked = false;
      return flush();
    },
  };
}
