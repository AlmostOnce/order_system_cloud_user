const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const {loadSetup}=require('./setup-harness.cjs');
const root=path.resolve(__dirname,'..'),cache=new Map(),storage=new Map(),calls=[],navigations=[];
const ok=data=>({ok:true,statusCode:200,message:'',data:{data}});
let pendingVerify=null,role='CUSTOMER';
global.uni={getStorageSync:k=>storage.get(k)??'',setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),getWindowInfo:()=>({statusBarHeight:0}),redirectTo:r=>navigations.push(r.url),reLaunch:r=>navigations.push(r.url),showToast(){}};
function load(file){
 file=path.resolve(root,file);
 if(file===path.join(root,'store/notifications.uts'))return {startNotificationSession(){throw Error('unverified user must not open socket')},stopNotificationSession(){}};
 if(file===path.join(root,'common/http.uts'))return {
  httpGet:async(...args)=>{calls.push(args);return ok({captchaId:'image-1',imageBase64:'data:image/png;base64,a'})},
  httpPost:async(...args)=>{
   calls.push(args);const url=args[0];
   if(url==='/auth/login')return ok({emailVerificationRequired:true,emailVerificationToken:'a'.repeat(64),emailVerificationExpiresIn:600,roleCode:role});
   if(url==='/auth/registration/verify')return pendingVerify?await pendingVerify:ok({verificationToken:'b'.repeat(64),expiresIn:300});
   return ok(null);
  }
 };
 if(cache.has(file))return cache.get(file);
 const source=fs.readFileSync(file,'utf8'),resolve=p=>load(path.resolve(path.dirname(file),p));
 if(file.endsWith('.uvue'))return loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],resolve);
 const m={exports:{}};cache.set(file,m.exports);
 new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(resolve,m,m.exports);return m.exports;
}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const auth=load('store/auth.uts'),session=load('common/email-ownership-session.uts');
 const result=await auth.login('1234567890','correct-password','captcha','abcd',false);
 assert.equal(result.emailVerificationRequired,true);assert.equal(result.ok,false);assert.equal(storage.has('auth_access_token'),false);assert.equal(storage.has('auth_refresh_token'),false);
 const page=load('pages/account/email-verification.uvue').create();page.$hooks.onLoad({mode:'enrollment'});await tick();
 page.email=' USER@Example.com ';await page.sendCode();assert.equal(calls.at(-1)[0],'/auth/captcha','missing captcha cannot send email');
 page.captchaCode='abcd';await page.sendCode();assert.equal(calls.at(-1)[0],'/auth/email-enrollment/code');assert.equal(calls.at(-1)[1].authorizationToken,'a'.repeat(64));assert.equal(calls.at(-1)[1].email,'user@example.com');assert.equal(calls.at(-1)[2],false);
 page.emailCode='012345';const beforeHide=calls.length;
 page.$hooks.onPageHide?.();page.$hooks.onPageShow();await tick();
 assert.equal(page.codeSent,true,'checking mail must keep the code entry step');assert.equal(page.emailCode,'012345');assert.equal(calls.length,beforeHide,'returning from mail must not fetch another image');
 const realNow=Date.now;Date.now=()=>realNow()+61000;try{page.$hooks.onPageShow();assert.equal(page.countdown,0,'background time counts toward resend delay')}finally{Date.now=realNow}
 await page.verifyCode();assert.equal(page.done,true);assert.equal(calls.at(-1)[1].code,'012345');assert.equal(storage.has('auth_access_token'),false);page.$hooks.onUnload();
 role='STALL_MANAGER';const other=await auth.login('u','p','captcha','abcd',false);assert.equal(other.emailVerificationRequired,false);assert.match(other.message,/管理端/);assert.equal(session.takeEnrollmentAuthorization(),null);
 const registration=load('pages/account/email-verification.uvue').create();registration.$hooks.onLoad({mode:'registration'});await tick();registration.email='new@example.com';registration.captchaCode='abcd';await registration.sendCode();registration.emailCode='012345';await registration.verifyCode();assert.equal(navigations.at(-1),'/pages/register/register');
 const grant=session.takeRegistrationGrant();assert.equal(grant.email,'new@example.com');assert.equal(grant.token,'b'.repeat(64));assert.equal(session.takeRegistrationGrant(),null,'handoff token is one read only');registration.$hooks.onUnload();
 const late=load('pages/account/email-verification.uvue').create();late.$hooks.onLoad({mode:'registration'});await tick();late.email='new@example.com';late.captchaCode='abcd';await late.sendCode();late.emailCode='012345';
 let finish;pendingVerify=new Promise(r=>finish=r);const pending=late.verifyCode();late.$hooks.onUnload();finish(ok({verificationToken:'c'.repeat(64),expiresIn:300}));await pending;
 assert.equal(session.takeRegistrationGrant(),null,'unloaded page cannot restore proof');assert.equal(late.emailCode,'');late.$hooks.onUnload();
 assert.ok(calls.filter(c=>c[0].includes('/registration/')||c[0].includes('/email-enrollment/')).every(c=>c[2]===false));
 console.log('Email ownership UI passed: no tokens/sockets before verification, student role boundary, captcha prerequisite, normalized email, leading-zero OTP, anonymous calls, one-read grant and late-response cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
