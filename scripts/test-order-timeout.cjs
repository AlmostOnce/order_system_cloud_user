const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {loadSetup}=require('./setup-harness.cjs');
const root=path.resolve(__dirname,'..');
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const countdownModule={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'common/order-countdown.uts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(require,countdownModule,countdownModule.exports);
const source=fs.readFileSync(path.join(root,'pages/order/detail.uvue'),'utf8');
const factory=loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>p.includes('order-countdown')?countdownModule.exports:{});
const vm=factory.create();const original=Date.now;Date.now=()=>1000000;
try {
 vm.startPaymentClock({status:'待支付',createdAt:'1970-01-01T08:16:40',paymentExpiresAt:0,serverTime:1000000});
 assert.equal(vm.paymentExpired,false);assert.equal(vm.remainingPaymentText,'15:00');
 vm.startPaymentClock({status:'待支付',createdAt:'1970-01-01T08:01:40',paymentExpiresAt:9999999,serverTime:1000000});
 assert.equal(vm.paymentExpired,true);assert.equal(vm.remainingPaymentText,'00:00');
 vm.startPaymentClock({status:'待支付',createdAt:'',paymentExpiresAt:0,serverTime:0});assert.equal(vm.paymentExpired,true,'missing server deadline must not enable payment');
 vm.startPaymentClock({status:'已支付',paymentExpiresAt:1000000,serverTime:1000000});assert.equal(vm.paymentExpired,false);
} finally {Date.now=original;vm.stopPaymentClock();}
const mod={exports:{}};
const json={jsonNumber:(r,k)=>typeof r[k]==='number'?r[k]:null,jsonString:(r,k)=>typeof r[k]==='string'?r[k]:null,jsonArray:(r,k)=>Array.isArray(r[k])?r[k]:null};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'api/order.uts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(p=>p.includes('json')?json:{},mod,mod.exports);
const parsed=mod.exports.parseOrder({orderId:1,windowId:2,totalAmount:10,status:'待支付',paymentExpiresAt:1900000,serverTime:1000000});
assert.equal(parsed.paymentExpiresAt,1900000);assert.equal(parsed.serverTime,1000000);
console.log('Order timeout UI passed: creation-based countdown with server clock, expiry and missing-deadline guards, terminal state, API timestamp parsing.');

const listSource=fs.readFileSync(path.join(root,'pages/order/list.uvue'),'utf8');
let now=1000000,callback=null,clears=0;
const originalNow=Date.now,originalInterval=global.setInterval,originalClear=global.clearInterval;
Date.now=()=>now;global.setInterval=fn=>{callback=fn;return 1};global.clearInterval=()=>{clears++};
global.uni={getWindowInfo:()=>({statusBarHeight:0})};
const pending={orderId:1,windowId:2,windowName:'食堂',status:'待支付',createdAt:'1970-01-01T08:16:40'};
const listFactory=loadSetup(listSource.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('order-countdown'))return countdownModule.exports;
 if(p.includes('api/order'))return {fetchOrders:async()=>({ok:true,data:{items:[{...pending,serverTime:now}],hasMore:false,nextCursor:''}}),parseOrderPage:r=>r.data};
 if(p.includes('common/json'))return {jsonArray:(r,k)=>r[k]};
 if(p.includes('store/auth'))return {currentUser:()=>({roleCode:'CUSTOMER',userUuid:'test'})};
 if (p.includes('common/order-live')) return {startOrderLiveRefresh:()=>()=>{}};
  if(p.includes('checkout'))return {readCheckout:()=>null};return {};
});
(async()=>{
 try {
  const list=listFactory.create();list.$hooks.onPageShow();await new Promise(r=>setImmediate(r));
  assert.equal(list.paymentTime(list.orders[0]),'15:00');assert.equal(typeof callback,'function');
  now+=120000;callback();assert.equal(list.paymentTime(list.orders[0]),'13:00');
  await list.load();assert.equal(list.paymentTime(list.orders[0]),'13:00','refresh must not restart fifteen minutes');
  now+=780000;callback();assert.match(list.paymentTime(list.orders[0]),/已超时/);
  assert.equal(list.orders[0].status,'待支付','timer must not fabricate cancellation');
  const before=clears;list.$hooks.onPageHide();assert.ok(clears>before,'hidden list stops ticking');list.$hooks.onUnload();
  console.log('Pending list passed: per-order creation deadline, one shared clock, ticking, refresh continuity, expiry text and lifecycle cleanup.');
 } finally {Date.now=originalNow;global.setInterval=originalInterval;global.clearInterval=originalClear}
})().catch(e=>{console.error(e);process.exitCode=1});
