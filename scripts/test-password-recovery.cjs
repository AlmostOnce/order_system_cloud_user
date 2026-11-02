const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const {loadSetup}=require('./setup-harness.cjs');
const root=path.resolve(__dirname,'..');const calls=[];let clearCount=0,stops=0,verifyResult,confirmResult;
const ok=data=>({ok:true,statusCode:200,message:'',data:{data}});
const payload=()=>ok({resetToken:'a'.repeat(64),expiresIn:300});
const api={fetchCaptcha:async()=>ok({captchaId:'image-1',imageBase64:'data:image/png;base64,abc'}),
 sendPasswordResetCode:async(...args)=>{calls.push(['send',...args]);return ok(null)},
 verifyPasswordResetCode:async(...args)=>{calls.push(['verify',...args]);return verifyResult?await verifyResult:payload()},
 confirmPasswordReset:async(...args)=>{calls.push(['confirm',...args]);return confirmResult??ok(null)}};
const json={jsonObject:(r,k)=>r[k]??null,jsonString:(r,k)=>typeof r[k]==='string'?r[k]:null,jsonNumber:(r,k)=>typeof r[k]==='number'?r[k]:null};
global.uni={getWindowInfo:()=>({statusBarHeight:0}),reLaunch(){},setStorageSync(){throw Error('recovery credentials must not be persisted')}};
const source=fs.readFileSync(path.join(root,'pages/account/password-recovery.uvue'),'utf8');
const factory=loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('api/auth'))return api;if(p.includes('common/json'))return json;
 if(p.includes('common/storage'))return {clearTokens:()=>{clearCount++}};
 if(p.includes('store/notifications'))return {stopNotificationSession:()=>{stops++}};return {};
});
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const vm=factory.create();vm.$hooks.onLoad();await tick();
 vm.email='bad';await vm.sendCode();assert.equal(calls.length,0);
 vm.email=' USER@EXAMPLE.COM ';vm.captchaCode='abcd';await vm.sendCode();
 assert.deepEqual(calls[0],['send','user@example.com','image-1','abcd']);assert.equal(vm.codeSent,true);assert.equal(vm.step,1);
 vm.emailCode='123';await vm.verifyCode();assert.equal(calls.length,1);
 vm.emailCode='012345';await vm.verifyCode();assert.equal(vm.step,2);assert.equal(vm.emailCode,'');
 vm.password='new-password';vm.confirmation='different';await vm.resetPassword();assert.equal(calls.filter(x=>x[0]==='confirm').length,0);
 vm.confirmation='new-password';confirmResult={ok:false,statusCode:400,message:'新密码不能与旧密码相同，请设置其他密码',data:null};await vm.resetPassword();assert.equal(vm.step,2);assert.match(vm.errorText,/新密码不能与旧密码相同/);assert.equal(vm.password,'');
 confirmResult=null;vm.password='different-password';vm.confirmation='different-password';await vm.resetPassword();assert.equal(vm.step,3);assert.equal(vm.password,'');assert.equal(vm.confirmation,'');assert.equal(clearCount,1);assert.equal(stops,1);
 assert.deepEqual(calls.at(-1),['confirm','a'.repeat(64),'different-password']);await vm.resetPassword();assert.equal(calls.filter(x=>x[0]==='confirm').length,2);
 const late=factory.create();late.$hooks.onLoad();await tick();late.email='user@example.com';late.captchaCode='abcd';await late.sendCode();late.emailCode='012345';
 let finish;verifyResult=new Promise(r=>{finish=r});const pending=late.verifyCode();late.$hooks.onPageHide();finish(payload());await pending;assert.equal(late.step,1,'late identity proof cannot restore a hidden page');assert.equal(late.codeSent,false);late.$hooks.onUnload();vm.$hooks.onUnload();
 const authSource=fs.readFileSync(path.join(root,'api/auth.uts'),'utf8'),mod={exports:{}};
 new Function('require','module','exports',ts.transpileModule(authSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>({httpPost:async(...args)=>{calls.push(args);return ok(null)}}),mod,mod.exports);
 await mod.exports.sendPasswordResetCode('a@b.com','id','abcd');assert.deepEqual(calls.at(-1),['/auth/password-reset/code',{email:'a@b.com',captchaId:'id',captchaCode:'abcd'},false]);
 await mod.exports.verifyPasswordResetCode('a@b.com','012345');assert.equal(calls.at(-1)[2],false);assert.equal(calls.at(-1)[1].code,'012345');
 await mod.exports.confirmPasswordReset('a'.repeat(64),'new-password');assert.equal(calls.at(-1)[2],false);
 console.log('Password recovery checks passed: staged proof, anonymous request bodies, normalized email, leading zero, password matching, success lock, secret cleanup and stale response rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
