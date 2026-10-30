const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const ts = require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const { loadSetup } = require('./setup-harness.cjs');
const root = path.resolve(__dirname, '..'), cache = new Map(), storage = new Map(), calls = [];
let result = { ok: true, data: { data: { userNo: '1234567890' } } };
let navigations = 0;
global.uni = {
 getStorageSync: key => storage.get(key) ?? '', setStorageSync: (key, value) => storage.set(key, value),
 removeStorageSync: key => storage.delete(key), navigateBack: () => navigations++, showToast() {},
 setClipboardData() {}, getWindowInfo: () => ({ statusBarHeight: 24 })
};
function load(file) {
 file = path.resolve(root, file);
 if (file === path.join(root, 'store/notifications.uts')) return { startNotificationSession() {}, stopNotificationSession() {} };
 if (file === path.join(root, 'common/http.uts')) return {
  httpPost: async (...args) => { calls.push(args); return result; }, httpGet: async () => result
 };
 if (cache.has(file)) return cache.get(file);
 const source = fs.readFileSync(file, 'utf8');
 const resolve = p => load(path.resolve(path.dirname(file), p));
 if (file.endsWith('.uvue')) return loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], resolve);
 const mod = { exports: {} }; cache.set(file, mod.exports);
 const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
 new Function('require', 'module', 'exports', js)(resolve, mod, mod.exports);
 return mod.exports;
}
(async () => {
 const api = load('api/auth.uts');
 await api.login('1234567890', 'password', 'captcha', '1234');
 assert.deepEqual(calls.at(-1)[1], { account: '1234567890', password: 'password', captchaId: 'captcha', captchaCode: '1234' });
 await api.login('user@example.com', 'password', 'captcha', '1234');
 assert.equal(calls.at(-1)[1].account, 'user@example.com');
 const auth = load('store/auth.uts');
 const registered = await auth.register('校园用户', ' USER@Example.com ', 'password');
 assert.equal(registered.userNo, '1234567890');
 assert.deepEqual(calls.at(-1)[1], { username: '校园用户', email: 'user@example.com', password: 'password' });
 assert.equal(storage.get('auth_remembered_account'), '1234567890');
 const vm = load('pages/register/register.uvue').create();
 assert.notEqual(vm.validateEmail('13800138000'), '');
 assert.notEqual(vm.validateEmail('invalid@'), '');
 assert.equal(vm.validateEmail('user@example.com'), '');
 Object.assign(vm, { username: '新用户', email: 'new@example.com', password: 'password', confirmPassword: 'password' });
 vm.submit(); await new Promise(resolve => setImmediate(resolve));
 assert.equal(vm.registered, true); assert.equal(vm.registeredUserNo, '1234567890');
 assert.equal(vm.password, ''); assert.equal(vm.confirmPassword, ''); assert.equal(navigations, 0);
 const profile = fs.readFileSync(path.join(root, 'pages/account/profile.uvue'), 'utf8');
 assert.ok(profile.includes('{{ userNo }}')); assert.ok(!profile.includes('手机号'));
 console.log('Account login checks passed: user number/email payloads, normalized registration email, no phone, remembered number, email validation, registration receipt and password clearing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
