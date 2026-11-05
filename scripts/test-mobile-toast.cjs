const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {loadSetup}=require('./setup-harness.cjs');
const root=path.resolve(__dirname,'..'),messages=[],storage=new Map();let requests=0;
global.uni={setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),getStorageSync:k=>storage.get(k),getWindowInfo:()=>({statusBarHeight:0})};
let response={ok:false,statusCode:400,message:'余额不足',data:null};
const json={jsonObject:(v,k)=>v[k]??null,jsonString:(v,k)=>typeof v[k]==='string'?v[k]:null,jsonNumber:(v,k)=>typeof v[k]==='number'?v[k]:null};
function page(name){const source=fs.readFileSync(path.join(root,'pages',name+'.uvue'),'utf8');return loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('common/feedback'))return{toast:m=>messages.push(m)};
 if(p.includes('common/json'))return json;
 if(p.includes('api/wallet'))return{walletPayload:r=>r.ok?r.data:null,rechargeBalance:async()=>{requests++;return response;},setPayPassword:async()=>{requests++;return response;}};
 if(p.includes('api/payment'))return{payOrder:async()=>{requests++;return response;}};
 if(p.includes('api/order'))return{payOrder:async()=>{requests++;return response;},orderPayload:r=>r.ok?r.data:null};
 if(p.includes('common/account'))return{newRechargeKey:()=> 'key',pendingRechargeKey:()=> 'pending'};
 if(p.includes('common/checkout'))return{paymentPendingKey:()=> 'payment-pending'};
 if(p.includes('store/notifications'))return{stopNotificationSession(){}};
 return {};
}).create();}
const flush=()=>new Promise(r=>setImmediate(r));
function notice(vm,action,text){const before=messages.length;vm[action]();assert.equal(messages.length,before+1,action+' must toast exactly once');assert.match(messages.at(-1),text);assert.equal(vm.errorText??'','');}
(async()=>{
 const payment=page('order/detail');Object.assign(payment,{paymentExpanded:true,balanceReady:true,paymentReady:true,payPasswordSet:true,orderId:11,userUuid:'u',order:{status:'待支付'},paymentExpired:false});
 notice(payment,'pay',/请输入支付密码/);payment.refresh=()=>Promise.resolve();payment.payPassword='secret';payment.pay();await flush();assert.equal(messages.at(-1),'余额不足');assert.equal(payment.errorText,'');assert.equal(payment.paymentUncertain,false);assert.equal(payment.payPassword,'');
 response={ok:false,statusCode:0,message:'网络连接失败',data:null};payment.payPassword='secret';payment.pay();await flush();assert.equal(messages.at(-1),'网络连接失败');assert.equal(payment.paymentUncertain,true);assert.equal(payment.errorText,'网络连接失败','uncertain money result must remain visible');
 const recharge=page('wallet/recharge');recharge.balanceReady=true;recharge.amountText='abc';notice(recharge,'submit',/请输入正确金额/);recharge.amountText='10';notice(recharge,'submit',/支付密码/);recharge.payPassword='secret';response={ok:false,statusCode:400,message:'支付密码错误',data:null};recharge.submit();await flush();assert.equal(messages.at(-1),'支付密码错误');assert.equal(recharge.errorText,'');assert.equal(recharge.pending,false);
 const password=page('account/pay-password');password.ready=true;notice(password,'save',/请输入登录密码/);
 const email=page('account/email-verification');await email.sendCode();assert.match(messages.at(-1),/有效的邮箱/);assert.equal(email.errorText,'');
 const recover=page('account/password-recovery');recover.email='invalid';await recover.sendCode();assert.match(messages.at(-1),/绑定邮箱/);assert.equal(recover.errorText,'');
 const payRecover=page('account/pay-password-recovery');await payRecover.authorize();assert.match(messages.at(-1),/请输入登录密码/);
 const change=page('account/email-change');change.verifyCaptcha();assert.match(messages.at(-1),/新邮箱/);
 const profile=page('account/profile');profile.editing=true;profile.draftUsername='x';const before=requests;await profile.saveProfile();assert.equal(requests,before,'invalid nickname must not save');assert.match(messages.at(-1),/昵称长度/);
 const review=page('review/create');review.ready=true;await review.submit();assert.match(messages.at(-1),/请选择/);assert.equal(review.errorText,'');
 console.log('Mobile Toast checks passed across 9 student pages: immediate single feedback, no inline action errors, invalid-input guards, cleared passwords, and persistent uncertain-payment state.');
})().catch(e=>{console.error(e);process.exitCode=1});
