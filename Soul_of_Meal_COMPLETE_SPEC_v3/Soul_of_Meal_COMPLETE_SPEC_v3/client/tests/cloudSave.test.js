import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudSave } from '../src/core/cloudSave.js';
import { AccountError, createAccountApi } from '../src/core/accountApi.js';

test('cloud saves serialize concurrent changes and include the account id and current revision', async () => {
  const calls = [];
  let release;
  const api = {
    async save(account, revision, json) {
      calls.push([account, revision, JSON.parse(json)]);
      if (calls.length === 1) await new Promise(resolve => { release = resolve; });
      return { revision: revision + 1 };
    },
  };
  const cloud = createCloudSave(api, 'first-account', { revision: 5, snapshot: { gold: 12 } }, () => {});
  cloud.stage({ gold: 24 });
  const saving = cloud.flush();
  cloud.stage({ gold: 32 });
  assert.equal(cloud.flush(), saving);
  release();
  assert.equal(await saving, true);
  assert.deepEqual(calls, [
    ['first-account', 5, { gold: 24 }],
    ['first-account', 6, { gold: 32 }],
  ]);
  assert.equal(cloud.dirty(), false);
});

test('cloud saves retain dirty state on failures and never overwrite a revision conflict', async () => {
  let error = new AccountError('network', 0);
  let calls = 0;
  const api = { async save() { calls++; throw error; } };
  const cloud = createCloudSave(api, 'account', { revision: 0, snapshot: null }, () => {});
  cloud.stage({ quest: 'accepted' });
  assert.equal(await cloud.flush(), false);
  assert.equal(cloud.dirty(), true);
  assert.equal(await cloud.flush(), false);
  assert.equal(calls, 1);
  error = new AccountError('save_conflict', 409);
  assert.equal(await cloud.retry(), false);
  assert.equal(calls, 2);
  assert.equal(await cloud.retry(), false);
  assert.equal(calls, 2);
});

test('session loss keeps pending state until the same account signs in again', async () => {
  let loggedIn = false;
  const api = { async save(account, revision, snapshot) {
    if (!loggedIn) throw new AccountError('session_expired', 401);
    assert.equal(account, 'account');
    assert.equal(revision, 4);
    assert.deepEqual(JSON.parse(snapshot), { progress: 8 });
    return { revision: 5 };
  } };
  const cloud = createCloudSave(api, 'account', { revision: 4, snapshot: { progress: 7 } }, () => {});
  cloud.stage({ progress: 8 });
  assert.equal(await cloud.flush(), false);
  loggedIn = true;
  assert.equal(await cloud.retry(), false);
  assert.equal(await cloud.retry({ reauthenticated: true }), true);
  assert.equal(cloud.dirty(), false);
});

test('the API refreshes an expired CSRF token and preserves account and snapshot', async () => {
  const requests = [];
  const api = createAccountApi(async (path, options) => {
    requests.push({ path, options });
    if (path.endsWith('/auth/csrf')) return Response.json({ token: 'token-' + requests.length });
    if (requests.length === 2) return Response.json({ code: 'csrf' }, { status: 403 });
    return Response.json({ revision: 3 });
  });
  assert.deepEqual(await api.save('account', 2, '{"progress":8}', true), { revision: 3 });
  assert.equal(requests[3].options.headers['X-Soul-CSRF'], 'token-3');
  assert.equal(requests[3].options.keepalive, true);
  assert.deepEqual(JSON.parse(requests[3].options.body), { accountId: 'account', expectedRevision: 2, snapshot: { progress: 8 } });
});
