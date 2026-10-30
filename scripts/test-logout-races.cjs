const fs = require('node:fs'), assert = require('node:assert/strict');
const ts = require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function create() {
 let version = 0, access = 'old-access', refresh = 'old-refresh', saves = 0, navigations = 0;
 const requests = [], moduleData = { exports: {} };
 global.uni = { request: options => requests.push(options), reLaunch: () => navigations++ };
 const storage = { isSessionClosing: () => false, getSessionVersion: () => version, getAccessToken: () => access, getRefreshToken: () => refresh,
  clearTokens: () => { version++; access = ''; refresh = ''; }, saveTokens: (a, r) => { saves++; access = a; refresh = r; } };
 const source = fs.readFileSync('common/http.uts', 'utf8');
 global.UTSJSONObject = function(value) { return value; };
 new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(path => {
  if (path.includes('storage')) return storage;
  if (path.includes('config')) return { API_BASE_URL: '/api', API_TIMEOUT: 1000, SUCCESS_CODE: 'OK' };
  if (path.includes('json')) return { jsonObject: (o, k) => o[k] ?? null, jsonString: (o, k) => o[k] ?? null, parseJsonObject: JSON.parse };
  return {};
 }, moduleData, moduleData.exports);
 return { api: moduleData.exports, requests, storage, get saves() { return saves; }, get navigations() { return navigations; } };
}
function respond(request, status, data = null) { request.success({ statusCode: status, data: { code: status === 200 ? 'OK' : 'ERROR', message: 'expired', data } }); }
(async () => {
 let h = create(), pending = h.api.httpGet('/users/me/profile', true);
 respond(h.requests[0], 401); await tick(); assert.ok(h.requests[1].url.endsWith('/auth/refresh'));
 h.storage.clearTokens(); respond(h.requests[1], 200, { accessToken: 'late-access', refreshToken: 'late-refresh' });
 await pending; assert.equal(h.saves, 0); assert.equal(h.storage.getAccessToken(), ''); assert.equal(h.navigations, 0);

 h = create(); h.storage.isSessionClosing = () => true;
 assert.equal((await h.api.httpGet('/users/me/profile', true)).ok, false); assert.equal(h.requests.length, 0);
 pending = h.api.httpLogout(); respond(h.requests[0], 401); await tick();
 respond(h.requests[1], 200, { accessToken: 'new-access', refreshToken: 'new-refresh' }); await tick();
 assert.equal(h.requests[2].data.refreshToken, 'new-refresh'); assert.equal(h.requests[2].header.Authorization, 'Bearer new-access');
 respond(h.requests[2], 200); await pending;
 // Network failure must still finish the local logout exactly once.
 const moduleData = { exports: {} }; let cleared = 0, stopped = 0, emailCleared = 0, rejectLogout;
 new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('store/auth.uts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(path => {
  if (path.includes('api/auth')) return { logout: () => new Promise((_resolve, reject) => { rejectLogout = reject; }) };
  if (path.includes('notifications')) return { stopNotificationSession: () => stopped++ };
  if (path.includes('email-change-session')) return { clearEmailChangeAuthorization: () => emailCleared++ };
  if (path.includes('storage')) return { getSessionVersion: () => 0, beginSessionClose() {}, getRefreshToken: () => 'refresh', clearTokens: () => cleared++ };
  return {};
 }, moduleData, moduleData.exports);
 const first = moduleData.exports.logout(), second = moduleData.exports.logout();
 assert.equal(first, second); await first;
 // Local logout resolves even while the network request has not settled.
 assert.equal(cleared, 1); assert.equal(stopped, 1); assert.equal(emailCleared, 1);
 rejectLogout(new Error('offline')); await tick(); assert.equal(cleared, 1);
 console.log('Logout race checks passed: late refresh cannot restore cleared tokens; logout retries revoke the rotated refresh token.');
})().catch(error => { console.error(error); process.exitCode = 1; });
