const fs = require('node:fs'), assert = require('node:assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const source = fs.readFileSync('pages/account/profile.uvue', 'utf8');
let calls = [], resolveSave, response, notices = 0;
const payload = { username: '新昵称', email: 'new@example.com' };
const vm = loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], p => {
 if (p.includes('wallet.uts')) return {
  updateMyProfile: (...args) => { calls.push(args); return new Promise(resolve => { resolveSave = resolve; }); },
  walletPayload: r => r.ok ? r.data : null
 };
 if (p.includes('json.uts')) return { jsonString: (obj, key) => typeof obj[key] === 'string' ? obj[key] : null };
 if (p.includes('feedback.uts')) return { toastSuccess: () => notices++ };
 return {};
}).create();
(async () => {
 Object.assign(vm, { loading: false, username: '原昵称', email: 'old@example.com' });
 vm.startEdit(); assert.equal(vm.editing, true); assert.equal(vm.draftUsername, '原昵称');
 vm.draftUsername = 'x'; await vm.saveProfile(); assert.equal(calls.length, 0);
 vm.draftUsername = '新昵称'; vm.draftEmail = 'invalid'; await vm.saveProfile(); assert.equal(calls.length, 0);
 vm.draftEmail = ' NEW@Example.com '; await vm.saveProfile(); assert.equal(calls.length, 0);
 vm.loginPassword = 'correct'; const pending = vm.saveProfile();
 assert.equal(vm.profileSaving, true); assert.deepEqual(calls[0], ['新昵称', 'new@example.com', 'correct']);
 await vm.saveProfile(); vm.cancelEdit(); assert.equal(calls.length, 1); assert.equal(vm.editing, true);
 resolveSave({ ok: false, message: '邮箱已被使用' }); await pending;
 assert.equal(vm.profileSaving, false); assert.equal(vm.editing, true); assert.equal(vm.draftUsername, '新昵称');
 assert.equal(vm.username, '原昵称'); assert.equal(vm.loginPassword, ''); assert.equal(vm.profileError, '邮箱已被使用');
 vm.loginPassword = 'correct'; const success = vm.saveProfile(); resolveSave({ ok: true, data: payload }); await success;
 assert.equal(vm.email, 'new@example.com'); assert.equal(vm.username, '新昵称'); assert.equal(vm.editing, false); assert.equal(notices, 1);
 vm.startEdit(); vm.loginPassword = 'secret'; vm.$hooks.onPageHide(); assert.equal(vm.loginPassword, '');
 vm.cancelEdit(); assert.equal(vm.draftEmail, ''); assert.equal(vm.editing, false);
 vm.startEdit(); vm.draftUsername = '另一昵称'; const nickname = vm.saveProfile();
 assert.equal(calls.at(-1)[2], ''); resolveSave({ ok: true, data: { username: '另一昵称', email: 'new@example.com' } }); await nickname;
 assert.ok(source.includes('!editing && !profileSaving && !avatarPreviewVisible'));
 const api = fs.readFileSync('api/wallet.uts', 'utf8'); assert.ok(api.includes("httpPut('/users/me/profile', body, true)"));
 console.log('Profile edit checks passed: validation, email/password requirement, duplicate guard, failure recovery, save, cancel and password clearing.');
})().catch(e => { console.error(e); process.exitCode = 1; });
