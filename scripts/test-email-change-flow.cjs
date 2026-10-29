const fs = require('node:fs'), assert = require('node:assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const source = fs.readFileSync('pages/account/email-change.uvue', 'utf8');
const calls = [];
global.uni = { getWindowInfo: () => ({ statusBarHeight: 24 }), navigateBack: () => {}, showToast: () => {} };
const vm = loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], p => {
 if (p.includes('wallet.uts')) return {
  verifyEmailCaptcha: (...args) => { calls.push(['verify', ...args]); return Promise.resolve({ ok: true, data: { captchaVerificationToken: 'b'.repeat(64) } }); },
  sendEmailCode: (...args) => { calls.push(['send', ...args]); return Promise.resolve({ ok: true }); },
  changeMyEmail: (...args) => { calls.push(['change', ...args]); return Promise.resolve({ ok: true }); },
  walletPayload: result => result.ok ? result.data : null
 };
 if (p.includes('auth.uts')) return { fetchCaptcha: () => Promise.resolve({ ok: true, data: { captchaId: 'captcha-id', imageBase64: 'data:image/png;base64,abc' } }) };
 if (p.includes('email-change-session.uts')) return { getEmailChangeAuthorization: () => 'a'.repeat(64), clearEmailChangeAuthorization: () => { global.authorizationCleared = true; } };
 if (p.includes('json.uts')) return { jsonString: (obj, key) => typeof obj[key] === 'string' ? obj[key] : null };
 if (p.includes('feedback.uts')) return { toastSuccess: () => {} };
 return {};
}).create();

(async () => {
 vm.$hooks.onLoad(); await new Promise(resolve => setImmediate(resolve));
 assert.equal(vm.captchaId, 'captcha-id'); assert.equal(vm.captchaImage, 'data:image/png;base64,abc');
 vm.email = ' New@Example.com '; vm.captchaCode = 'ABCD'; vm.verifyCaptcha();
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(vm.captchaVerified, true); assert.equal(vm.captchaImage, '');
 assert.deepEqual(calls[0], ['verify', 'new@example.com', 'a'.repeat(64), 'captcha-id', 'ABCD']);
 vm.sendCode(); await new Promise(resolve => setImmediate(resolve));
 assert.deepEqual(calls[1], ['send', 'new@example.com', 'a'.repeat(64), 'b'.repeat(64)]);
 assert.equal(vm.codeSent, true); assert.equal(vm.captchaVerified, false);
 vm.emailCode = '123456'; vm.confirmChange(); await new Promise(resolve => setImmediate(resolve));
 assert.deepEqual(calls[2], ['change', 'new@example.com', 'a'.repeat(64), '123456']);
 assert.equal(global.authorizationCleared, true);
 assert.ok(source.indexOf('verifyCaptcha(emailValue') < source.indexOf('sendEmailCode(emailValue'));
 assert.ok(source.includes('v-if="captchaVerified && !codeSent"'));
 assert.ok(source.includes('if (!state.captchaVerified || state.sending || state.codeSent) return'));
 vm.$hooks.onUnload();
 console.log('Email-change flow checks passed: captcha verification precedes email send, authorization stays in memory, email confirmation is separate.');
})().catch(error => { console.error(error); process.exitCode = 1; });
