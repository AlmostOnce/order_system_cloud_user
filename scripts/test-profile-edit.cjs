const fs = require('node:fs'), assert = require('node:assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const source = fs.readFileSync('pages/account/profile.uvue', 'utf8');
let profileCalls = [], authorizationCalls = [], notices = 0, navigation = [];
global.uni = { navigateTo: options => navigation.push(options), showToast: () => {} };
const vm = loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], p => {
 if (p.includes('wallet.uts')) return {
  updateMyProfile: (...args) => { profileCalls.push(args); return Promise.resolve({ ok: true, data: { username: '新昵称' } }); },
  authorizeEmailChange: (...args) => { authorizationCalls.push(args); return Promise.resolve({ ok: true, data: { authorizationToken: 'a'.repeat(64) } }); },
  fetchMyProfile: () => Promise.resolve({ ok: true, data: {} }), walletPayload: r => r.ok ? r.data : null
 };
 if (p.includes('email-change-session.uts')) return { setEmailChangeAuthorization: token => { global.savedAuthorization = token; }, clearEmailChangeAuthorization: () => { global.savedAuthorization = ''; } };
 if (p.includes('feedback.uts')) return { toastSuccess: () => notices++ };
 if (p.includes('http.uts')) return {};
 if (p.includes('json.uts')) return { jsonString: (obj, key) => typeof obj[key] === 'string' ? obj[key] : null, jsonNumber: () => null };
 if (p.includes('files.uts')) return { uploadImage: () => Promise.resolve({}), saveAvatar: () => Promise.resolve({}) };
 if (p.includes('images.uts')) return { imageSource: () => '', defaultImage: () => '' };
 if (p.includes('image-picker.uts')) return { chooseLocalImage: () => Promise.resolve({ path: '', error: '' }) };
 if (p.includes('auth.uts')) return { isLoggedIn: () => true };
 if (p.includes('account.uts')) return { accountRoleLabel: () => '', accountDate: () => '', backToAccount: () => {} };
 if (p.includes('refresh.uts')) return { finishPullRefresh: () => {}, refreshTimeLabel: () => '' };
 return {};
}).create();

(async () => {
 Object.assign(vm, { loading: false, username: '原昵称', email: 'old@example.com' });
 vm.startEdit(); assert.equal(vm.editing, true); vm.draftUsername = '新昵称'; await vm.saveProfile();
 assert.deepEqual(profileCalls, [['新昵称']]); assert.equal(vm.username, '新昵称');
 assert.equal(vm.email, 'old@example.com'); assert.equal(notices, 1);

 vm.openEmailAuthorization(); assert.equal(vm.emailAuthorizationVisible, true);
 vm.emailAuthorizationPassword = 'correct-password';
 await vm.authorizeAndEditEmail();
 assert.deepEqual(authorizationCalls, [['correct-password']]);
 assert.equal(global.savedAuthorization, 'a'.repeat(64));
 assert.deepEqual(navigation, [{ url: '/pages/account/email-change' }]);
 assert.equal(vm.emailAuthorizationPassword, '');
 assert.ok(source.includes('class="email-edit-trigger"'));
 assert.ok(source.includes('role="dialog" aria-modal="true" aria-label="验证登录密码"'));
 assert.ok(!source.includes('startEmailChange'));

 const api = fs.readFileSync('api/wallet.uts', 'utf8');
 assert.ok(api.includes("httpPut('/users/me/profile', body, true)"));
 assert.ok(api.includes("httpPost('/users/me/email/authorization', body, true)"));
 assert.ok(api.includes("httpPost('/users/me/email/captcha', body, true)"));
 assert.ok(api.includes("httpPost('/users/me/email/verification-code', body, true)"));
 assert.ok(api.includes("httpPut('/users/me/email', body, true)"));
 console.log('Profile checks passed: nickname-only API, password authorization modal, in-memory token and separate email-change route.');
})().catch(error => { console.error(error); process.exitCode = 1; });
