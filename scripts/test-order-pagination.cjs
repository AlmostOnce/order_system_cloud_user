// 执行真实订单API解析与列表页面逻辑，网络仅用可控响应代替；不启动服务或编译移动应用。
const fs = require('node:fs'), assert = require('node:assert/strict');
const ts = require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const { loadSetup } = require('./setup-harness.cjs');
const json = {
 jsonObject: (o,k) => o?.[k] != null && typeof o[k] === 'object' && !Array.isArray(o[k]) ? o[k] : null,
 jsonArray: (o,k) => Array.isArray(o?.[k]) ? o[k] : null,
 jsonNumber: (o,k) => typeof o?.[k] === 'number' ? o[k] : null,
 jsonString: (o,k) => typeof o?.[k] === 'string' ? o[k] : null,
 jsonBoolean: (o,k) => typeof o?.[k] === 'boolean' ? o[k] : null
};
let owner = 'student-a', liveReload = null; const calls = [], responses = [], feedback = [];
const result = data => ({ok:true,data:{data},message:'',statusCode:200});
const row = (id,status='已完成') => ({orderId:id,orderNo:'O'+id,windowId:1,windowName:'小店',totalAmount:10,status,createdAt:'2026-11-06T10:00:00',items:[]});
const page = (items,cursor=null,more=false) => result({items,nextCursor:cursor,hasMore:more});
const mod = {exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('api/order.uts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(
 p => p.includes('json') ? json : {httpGet: async url => {calls.push(url);const response=responses.shift();return typeof response === 'function' ? response() : response;}},mod,mod.exports);
const api = mod.exports, tick = () => new Promise(resolve => setImmediate(resolve));
const makePage = () => loadSetup(fs.readFileSync('pages/order/list.uvue','utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p => {
 if(p.includes('api/order')) return api;
 if(p.includes('store/auth')) return {currentUser:()=>({userUuid:owner,roleCode:'CUSTOMER'})};
 if(p.includes('order-navigation')) return {normalizeOrderStatusFilter:s=>['pending','active','completed','cancelled'].includes(s)?s:'all'};
 if(p.includes('order-live')) return {startOrderLiveRefresh:reload=>{liveReload=reload;return()=>{};}};
 if(p.includes('checkout')) return {readCheckout:()=>null};
 if(p.includes('feedback')) return {toast:message=>feedback.push(message)};
 return {};
}).create();
global.uni={getWindowInfo:()=>({statusBarHeight:0}),switchTab(){},reLaunch(){}};
(async()=>{
 responses.push(page([])); await api.fetchOrders('active','42');
 const url = new URL(calls.pop(),'http://localhost');
 assert.equal(url.searchParams.get('status'),'active','filter must reach backend');
 assert.equal(url.searchParams.get('cursor'),'42');assert.equal(url.searchParams.get('limit'),'20');
 assert.equal(api.parseOrderPage(result([])),null,'reject legacy full-list payload');
 assert.equal(api.parseOrderPage(page([row(8)],null,true)),null,'more requires a cursor');
 assert.equal(api.parseOrderPage(page([row(8)],'9',true)),null,'cursor must match last row');
 assert.equal(api.parseOrderPage(page([row(8)],null,false)).items[0].orderId,8);
 // 路由入口和点击切换必须驱动同一套互斥视觉状态，默认“全部”也不能漏掉高亮。
 const source=fs.readFileSync('pages/order/list.uvue','utf8');
 const binding=source.match(/<view v-for="tab in filterTabs"[^>]*:class="([^"]+)"/)[1];
 const classesFor=new Function('selectedStatus','tab','return '+binding);
 const labelBinding=source.match(/<text class="order-filter-label"[^>]*:class="([^"]+)"/)[1];
 const labelClassFor=new Function('selectedStatus','tab','return '+labelBinding);
 const css=fs.readFileSync('styles/order.css','utf8');
 const baseRule=css.match(/\.order-filter\s*\{([^}]+)\}/)[1];
 assert.ok(!/background-color:|(?:^|;)\s*color:/.test(baseRule),'geometry class must not override selection colors');
 for(const status of ['all','pending','active','completed','cancelled']) {
  const entry=makePage();entry.$hooks.onLoad({status});
  for(const target of ['all','pending','active','completed','cancelled']) {
   entry.selectFilter(target);
   const selected=entry.filterTabs.filter(tab=>classesFor(entry.selectedStatus,tab)==='order-filter-selected');
   assert.equal(selected.length,1,'exactly one highlighted filter after every route/click transition');
   assert.equal(selected[0].code,target);
   for(const tab of entry.filterTabs) assert.equal(labelClassFor(entry.selectedStatus,tab),tab.code===target?'order-filter-label-selected':'order-filter-label-idle','native label state matches its background');
  }
 }
 const vm=makePage();responses.push(page([row(40),row(39)],'39',true));vm.$hooks.onPageShow();await tick();
 assert.deepEqual(vm.orders.map(x=>x.orderId),[40,39]);
 let release;responses.push(()=>new Promise(r=>release=r));const loading=vm.loadMore();const callCount=calls.length;vm.loadMore();assert.equal(calls.length,callCount,'one append at a time');
 release(page([row(39),row(38)],'38',true));await loading;
 assert.deepEqual(vm.orders.map(x=>x.orderId),[40,39,38],'append deduplicates existing orders');
 responses.push({ok:false,message:'离线',statusCode:503});await vm.loadMore();
 assert.deepEqual(vm.orders.map(x=>x.orderId),[40,39,38]);
 responses.push(page([row(37)]));await vm.loadMore();assert.equal(new URL(calls.at(-1),'http://localhost').searchParams.get('cursor'),'38','failed append keeps cursor');const lastCount=calls.length;await vm.loadMore();assert.equal(calls.length,lastCount,'stop at last page');
 // 阅读历史页时后台通知不能把已加载列表截回第一页；回到顶部再同步最新状态。
 const beforeLive=calls.length;await liveReload();assert.equal(calls.length,beforeLive,'background event must preserve history reading');
 responses.push(page([row(40),row(39),row(38),row(37)]));vm.listScrolled({detail:{scrollTop:0}});await tick();
 assert.equal(calls.length,beforeLive+1,'returning to top consumes deferred refresh');
 responses.push({ok:false,message:'离线',statusCode:503});await vm.load();assert.equal(vm.orders.length,4,'failed refresh preserves loaded records');
 let oldResolve;responses.push(()=>new Promise(r=>oldResolve=r));const stale=vm.load();
 responses.push(page([row(50,'待支付')]));vm.selectFilter('pending');await tick();
 assert.deepEqual(vm.orders.map(x=>x.orderId),[50]);assert.equal(new URL(calls.at(-1),'http://localhost').searchParams.get('cursor'),null,'filter resets cursor');
 oldResolve(page([row(999)]));await stale;assert.deepEqual(vm.orders.map(x=>x.orderId),[50],'stale filter response discarded');
 let accountResolve;responses.push(()=>new Promise(r=>accountResolve=r));const accountLoad=vm.load();owner='student-b';accountResolve(page([row(998)]));await accountLoad;
 assert.deepEqual(vm.orders.map(x=>x.orderId),[50],'late result from old account ignored');
 responses.push(page([row(60)]));vm.$hooks.onPageShow();await tick();assert.deepEqual(vm.orders.map(x=>x.orderId),[60],'account switch clears old data');
 vm.$hooks.onPageHide();vm.$hooks.onUnload();
 assert.ok(fs.readFileSync('pages/order/list.uvue','utf8').includes('@scrolltolower="loadMore"'),'bottom scroll loads next page');
 console.log('Order pagination passed: server filters, bounded page contract, cursor checks, append deduplication, concurrent guard, retry, refresh preservation, stale filters and account isolation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
