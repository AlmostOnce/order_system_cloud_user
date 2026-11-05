const toastMessages=[];
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {loadSetup}=require('./setup-harness.cjs');
const root=path.resolve(__dirname,'..'),calls=[];
const ok=data=>({ok:true,statusCode:200,message:'',data:{data}});
let confirmResult=ok(null),authorizeResult=ok({authorizationToken:'a'.repeat(64),maskedEmail:'u***@example.com'}),verifyResult;
const api={authorizePayPasswordRecovery:async(...a)=>{calls.push(['authorize',...a]);return await authorizeResult},
 sendPayPasswordRecoveryCode:async(...a)=>{calls.push(['send',...a]);return ok(null)},
 verifyPayPasswordRecoveryCode:async(...a)=>{calls.push(['verify',...a]);return verifyResult??ok({resetToken:'b'.repeat(64),expiresIn:300})},
 confirmPayPasswordRecovery:async(...a)=>{calls.push(['confirm',...a]);return confirmResult}};
const json={jsonObject:(r,k)=>r[k]??null,jsonString:(r,k)=>typeof r[k]==='string'?r[k]:null,jsonNumber:(r,k)=>typeof r[k]==='number'?r[k]:null};
global.uni={getWindowInfo:()=>({statusBarHeight:0}),reLaunch(){},switchTab(){},setStorageSync(){throw Error('secrets must not be persisted')}};
const source=fs.readFileSync(path.join(root,'pages/account/pay-password-recovery.uvue'),'utf8');
const factory=loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('common/feedback'))return{toast:message=>toastMessages.push(message)};
 if(p.includes('api/wallet'))return api;if(p.includes('api/auth'))return {fetchCaptcha:async()=>ok({captchaId:'image-1',imageBase64:'data:image/png;base64,abc'})};
 if(p.includes('common/json'))return json;if(p.includes('store/auth'))return {isLoggedIn:()=>true,currentUser:()=>({roleCode:'CUSTOMER'})};return {};
});
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const vm=factory.create();vm.$hooks.onLoad();vm.$hooks.onPageShow();
 await vm.sendCode();assert.equal(calls.length,0);await vm.authorize();assert.equal(calls.length,0);
 vm.loginPassword='login-pass';await vm.authorize();await tick();assert.equal(vm.step,1);assert.equal(vm.loginPassword,'');assert.equal(vm.email,'u***@example.com');
 vm.captchaCode='abcd';await vm.sendCode();assert.deepEqual(calls.at(-1),['send','a'.repeat(64),'image-1','abcd']);assert.equal(vm.codeSent,true);vm.emailCode='012345';vm.$hooks.onPageHide();vm.$hooks.onPageShow();assert.equal(vm.step,1);assert.equal(vm.codeSent,true);assert.equal(vm.emailCode,'012345');
 vm.emailCode='123';await vm.verifyCode();assert.equal(calls.at(-1)[0],'send');
 vm.emailCode='012345';await vm.verifyCode();assert.deepEqual(calls.at(-1),['verify','a'.repeat(64),'012345']);assert.equal(vm.step,2);
 vm.password='new-password';vm.confirmation='different';await vm.resetPassword();assert.equal(calls.at(-1)[0],'verify');
 confirmResult={ok:false,statusCode:400,message:'新支付密码不得与原支付密码相同',data:null};vm.confirmation=vm.password;await vm.resetPassword();assert.equal(vm.step,2);assert.match(toastMessages.at(-1),/原支付密码/);assert.equal(vm.password,'');
 confirmResult=ok(null);vm.password='different-password';vm.confirmation=vm.password;await vm.resetPassword();assert.equal(vm.step,3);assert.equal(vm.password,'');assert.deepEqual(calls.at(-1),['confirm','b'.repeat(64),'different-password']);
 const count=calls.length;await vm.resetPassword();assert.equal(calls.length,count);
 let finish;authorizeResult=new Promise(r=>finish=r);const late=factory.create();late.$hooks.onLoad();late.loginPassword='login-pass';const pending=late.authorize();late.$hooks.onUnload();finish(ok({authorizationToken:'c'.repeat(64),maskedEmail:'u***@example.com'}));await pending;assert.equal(late.step,0);assert.equal(late.loginPassword,'');
 vm.$hooks.onUnload();late.$hooks.onUnload();
 const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
 const mod={exports:{}},requests=[];
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'api/wallet.uts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>({httpPost:async(...args)=>{requests.push(args);return ok(null)}}),mod,mod.exports);
 await mod.exports.authorizePayPasswordRecovery('login-pass');await mod.exports.sendPayPasswordRecoveryCode('a'.repeat(64),'image-1','abcd');await mod.exports.verifyPayPasswordRecoveryCode('a'.repeat(64),'012345');await mod.exports.confirmPayPasswordRecovery('b'.repeat(64),'new-pass');
 assert.ok(requests.every(r=>r[2]===true),'all recovery calls require a session');assert.ok(requests.every(r=>!('email' in r[1])&&!('userId' in r[1])));assert.equal(requests[2][1].code,'012345');assert.equal(requests[3][1].newPayPassword,'new-pass');
 console.log('Pay password recovery passed: identity gate, masked email, staged captcha/mail proof, leading zero, mismatch retry, success lock, secret cleanup and late-response rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
