const toastMessages=[];
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {loadSetup}=require('./setup-harness.cjs');
const source=fs.readFileSync(path.join(__dirname,'../pages/account/pay-password.uvue'),'utf8');
let result={ok:true,message:''},back=0,redirects=[];
global.uni={getWindowInfo:()=>({statusBarHeight:0}),redirectTo:o=>redirects.push(o.url)};
const setup=loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('common/feedback'))return{toast:message=>toastMessages.push(message)};
 if(p.includes('api/wallet'))return{setPayPassword:async()=>await result};
 if(p.includes('common/account'))return{backToAccount:()=>back++};
 return {};
});
assert.ok(fs.readFileSync(path.join(__dirname,'../pages/order/detail.uvue'),'utf8').includes("url: '/pages/account/pay-password?next=order'"),'order entry must carry return context');
const flush=()=>new Promise(r=>setImmediate(r));
function page(next){const vm=setup.create();vm.$hooks.onLoad({next});Object.assign(vm,{ready:true,pageVisible:true,credential:'login-pass',newPassword:'payment-pass',confirmPassword:'payment-pass'});return vm;}
(async()=>{
 const order=page('order');order.save();await flush();assert.equal(back,1,'successful setup must return to original order');assert.equal(order.newPassword,'');assert.equal(order.credential,'');
 const ordinary=page('');ordinary.save();await flush();assert.equal(back,1,'account settings must stay on settings page');
 const recharge=page('recharge');recharge.save();await flush();assert.deepEqual(redirects,['/pages/wallet/recharge']);
 result={ok:false,message:'密码校验失败'};const failed=page('order');failed.save();await flush();assert.equal(back,1);assert.equal(toastMessages.at(-1),'密码校验失败');assert.equal(failed.errorText,'');
 let finish;result=new Promise(r=>finish=r);const closed=page('order');closed.save();closed.$hooks.onUnload();finish({ok:true,message:''});await flush();assert.equal(back,1,'unloaded page cannot navigate');
 console.log('Pay password return passed: original order return, account/recharge behavior, failed-save stay, secret cleanup and unloaded-response guard.');
})().catch(e=>{console.error(e);process.exitCode=1});
