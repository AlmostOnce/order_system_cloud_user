// 运行真实退款API解析及页面逻辑；不以Node检查代替真机或资金联调。
const fs=require('fs'),assert=require('assert/strict');
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
let calls=[];
const mod={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('api/refunds.uts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(p=>p.includes('http')?{
 httpPost:(url,body,auth,key)=>{calls.push({url,body,auth,key});return Promise.resolve({})},httpGet:(url,auth)=>{calls.push({url,auth});return Promise.resolve({})}
}:{jsonObject:(o,k)=>o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])?o[k]:null,jsonArray:(o,k)=>Array.isArray(o[k])?o[k]:null,jsonString:(o,k)=>typeof o[k]==='string'?o[k]:null,jsonNumber:(o,k)=>typeof o[k]==='number'?o[k]:null,jsonBoolean:(o,k)=>typeof o[k]==='boolean'?o[k]:null},mod,mod.exports);
const api=mod.exports;
api.applyRefund(9,12,2,'少一份','same-request');
assert.deepEqual(calls[0],{url:'/orders/9/refunds',body:{itemId:12,quantity:2,reason:'少一份'},auth:true,key:'same-request'});
assert.ok(!('amount' in calls[0].body),'client must never choose refund amount');
api.fetchRefunds(9,'5');assert.ok(calls[1].url.includes('cursor=5'));
const row={refundId:5,refundNo:'a'.repeat(32),itemId:12,productName:'鸡肉饭',quantity:1,amount:12.5,status:'PENDING',reason:'少一份',decisionReason:'',createdAt:'2026-11-06T10:00:00',dueAt:'2026-11-09T10:00:00'};
assert.equal(api.parseRefund(row).amount,12.5);
assert.equal(api.parseRefund({...row,amount:-1}),null);
assert.equal(api.parseRefund({...row,status:'UNKNOWN'}),null);
assert.equal(api.parseRefund({...row,quantity:1.5}),null);
const page=fs.readFileSync('pages/order/refunds.uvue','utf8');
assert.ok(page.includes('confirm-dialog')&&page.includes('startOrderLiveRefresh'),'confirm submission and reuse one socket');
assert.ok(page.includes('@scrolltolower="loadMore"'),'refund history must be bounded');
assert.ok(!page.includes('hasRole')&&!page.includes('approveRefund'),'student page must not expose merchant approval');
console.log('Refund UI contract passed: authenticated quantity-only request, stable key, bounded history, strict parser, confirmation and student boundary.');
const {loadSetup}=require('./setup-harness.cjs');
const ok=data=>({ok:true,data:{data},message:'',statusCode:200});
let owner='student-a',apiCalls=[],nextResult={ok:false,data:null,statusCode:503,message:'超时'},history={items:[],hasMore:false,nextCursor:null},delayed=null,moreCount=0;
const storage=new Map(),notices=[];
global.uni={getStorageSync:k=>storage.get(k)??'',setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),getWindowInfo:()=>({statusBarHeight:24}),reLaunch(){},navigateBack(){}};
const order={orderId:9,status:'已支付',windowName:'鸡肉饭',items:[{itemId:12,productName:'鸡肉饭',quantity:3,refundableQuantity:3,refundedQuantity:0}]};
const factory=loadSetup(page.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('api/refunds'))return {...api,applyRefund:async(...args)=>{apiCalls.push(args);return delayed?await delayed:nextResult},fetchRefunds:async(id,cursor)=>{if(cursor)moreCount++;return ok(history)}};
 if(p.includes('api/order'))return {fetchOrder:async()=>ok(order),orderPayload:r=>r.ok?r.data.data:null,parseOrder:x=>x};
 if(p.includes('store/auth'))return {currentUser:()=>({userUuid:owner,roleCode:'CUSTOMER'})};
 if(p.includes('common/json'))return {parseJsonObject:JSON.parse,jsonString:(o,k)=>typeof o[k]==='string'?o[k]:null,jsonNumber:(o,k)=>typeof o[k]==='number'?o[k]:null};
 if(p.includes('feedback'))return {toast:s=>notices.push(s)};
 if(p.includes('account'))return {accountDate:x=>x};
 if(p.includes('order-live'))return {startOrderLiveRefresh:()=>()=>{}};
 if(p.includes('refresh'))return {refreshTimeLabel:()=>'',finishPullRefresh:(a,b,done)=>done('')};
 return {};
});
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const vm=factory.create();vm.$hooks.onLoad({orderId:'9'});vm.$hooks.onPageShow();await tick();
 vm.selectItem(order.items[0]);vm.reason='少一份';vm.askApply();await vm.confirmAction();
 assert.equal(vm.pending,true,'uncertain response keeps draft');assert.equal(storage.size,1);
 const firstKey=apiCalls[0][4];nextResult={ok:false,data:null,statusCode:408,message:'请求超时'};vm.askApply();await vm.confirmAction();assert.equal(apiCalls[1][4],firstKey,'retry reuses key and body');assert.equal(vm.pending,true,'HTTP 408 remains uncertain');
 vm.$hooks.onPageHide();const restored=factory.create();restored.$hooks.onLoad({orderId:'9'});restored.$hooks.onPageShow();await tick();
 assert.equal(restored.pending,true,'leaving page cannot discard uncertain request');restored.askApply();
 let resolve;delayed=new Promise(r=>resolve=r);const sending=restored.confirmAction();restored.confirmAction();await tick();assert.equal(apiCalls.length,3,'double tap sends only once');
 resolve(ok({...row,requestKey:firstKey,status:'APPROVED'}));await sending;delayed=null;assert.equal(restored.pending,false);assert.equal(storage.size,0);
 history={items:[{...row,refundId:30}],hasMore:true,nextCursor:'30'};await restored.load();history={items:[{...row,refundId:29}],hasMore:false,nextCursor:null};
 await Promise.all([restored.loadMore(),restored.loadMore()]);assert.equal(moreCount,1);assert.deepEqual(restored.records.map(r=>r.refundId),[30,29]);
 restored.selectItem(order.items[0]);restored.reason='漏餐';restored.askApply();let late;delayed=new Promise(r=>late=r);const oldCall=restored.confirmAction();await tick();
 const before=notices.length;restored.$hooks.onPageHide();owner='student-b';late(ok({...row,status:'SUCCESS'}));await oldCall;
 assert.equal(notices.length,before,'old-account response cannot toast success or clear its pending draft');assert.equal(storage.size,1);
 console.log('Refund page behavior passed: uncertain retry/reentry, single submission, cursor serialization and stale-account response suppression.');
})().catch(e=>{console.error(e);process.exitCode=1});
