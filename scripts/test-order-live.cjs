const fs=require('node:fs'), assert=require('node:assert/strict');
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const listeners=new Set(), timers=new Map();let nextTimer=0, starts=0;
const notifications={subscribeNotifications:fn=>listeners.add(fn),unsubscribeNotifications:fn=>listeners.delete(fn),startNotificationSession:()=>starts++};
const mod={exports:{}};
new Function('require','module','exports','setTimeout','clearTimeout',ts.transpileModule(fs.readFileSync('common/order-live.uts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(
 ()=>notifications,mod,mod.exports,fn=>{timers.set(++nextTimer,fn);return nextTimer},id=>timers.delete(id));
const signal=()=>{for(const fn of listeners)fn()}, tick=()=>new Promise(r=>setImmediate(r));
function advance(){const batch=[...timers.values()];timers.clear();for(const fn of batch)fn()}
(async()=>{
 let busy=true,calls=0,resolve;
 const stop=mod.exports.startOrderLiveRefresh(()=>{calls++;return new Promise(r=>resolve=r)},()=>busy);
 assert.equal(starts,1);signal();signal();assert.equal(timers.size,1);
 advance();assert.equal(calls,0);assert.equal(timers.size,1,'busy operation keeps one pending update');
 busy=false;advance();assert.equal(calls,1);
 signal();signal();assert.equal(timers.size,0,'no overlapping requests');
 resolve();await tick();assert.equal(timers.size,1);advance();assert.equal(calls,2);
 signal();stop();resolve();await tick();assert.equal(listeners.size,0);assert.equal(timers.size,0,'hidden page cannot schedule a late reload');
 const cancel=mod.exports.startOrderLiveRefresh(()=>{calls++;return Promise.resolve()},()=>false);signal();cancel();advance();assert.equal(calls,2,'dispose cancels queued refresh');
 let failures=0;const stopFailure=mod.exports.startOrderLiveRefresh(()=>{failures++;return Promise.reject(new Error('offline'))},()=>false);
 signal();advance();await tick();signal();advance();await tick();assert.equal(failures,2,'failure does not lock future updates');stopFailure();

 let owner='student-a',subscription=null,disposed=0;
 global.uni={getWindowInfo:()=>({statusBarHeight:0}),getStorageSync:()=>false,removeStorageSync(){},reLaunch(){},switchTab(){}};
 for(const name of ['list','detail']){
  const source=fs.readFileSync('pages/order/'+name+'.uvue','utf8');
  const vm=require('./setup-harness.cjs').loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
   if(p.includes('order-live'))return{startOrderLiveRefresh:(reload,busy)=>{subscription={reload,busy};return()=>{disposed++;subscription=null}}};
   if(p.includes('store/auth'))return{currentUser:()=>({userUuid:owner,roleCode:'CUSTOMER'})};
   if(p.includes('checkout'))return{readCheckout:()=>null,paymentPendingKey:()=>''};
   return{};
  }).create();
  let reloads=0;vm.load=async()=>{reloads++};vm.refresh=async()=>{reloads++};vm.retryCleanup=()=>{};
  owner='student-a';vm.$hooks.onPageShow();assert.ok(subscription);await subscription.reload();assert.equal(reloads,2);
  if(name==='detail'){vm.paying=true;assert.equal(subscription.busy(),true);vm.paying=false;}
  owner='student-b';await subscription.reload();assert.equal(reloads,2,'account change rejects old page update');
  vm.$hooks.onPageHide();assert.equal(subscription,null);
  owner='student-a';vm.$hooks.onPageShow();assert.ok(subscription);vm.$hooks.onUnload();assert.equal(subscription,null);
 }
 assert.equal(disposed,4);
 // Exercise the real page loaders after a notification, including pickup-code removal.
 let status='制作中',detailResolve=null;
 for(const name of ['list','detail']){
  status='制作中';owner='student-a';
  const source=fs.readFileSync('pages/order/'+name+'.uvue','utf8');
  const row=()=>({orderId:18,windowId:1,status,items:[],createdAt:'2026-11-05T10:00:00+08:00'});
  const vm=require('./setup-harness.cjs').loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
   if(p.includes('order-live'))return mod.exports;
   if(p.includes('store/auth'))return{currentUser:()=>({userUuid:owner,roleCode:'CUSTOMER'})};
   if(p.includes('api/order'))return{
    fetchOrders:async()=>({ok:true,data:{data:[row()]}}),
    fetchOrder:()=>detailResolve?new Promise(r=>detailResolve=r):Promise.resolve({ok:true,data:row()}),
    parseOrder:data=>data,orderPayload:result=>result.data,
    fetchPickupCode:async()=>({ok:true,data:{pickupCode:'012345'}})
   };
   if(p.includes('api/comments'))return{fetchOrderReviews:async()=>({}),commentPayload:()=>null};
   if(p.includes('json'))return{jsonArray:(d,k)=>d[k],jsonString:(d,k)=>d[k]};
   if(p.includes('checkout'))return{readCheckout:()=>null,paymentPendingKey:()=>'',cleanupKey:()=>'',readStoredObject:()=>null};
   return{};
  }).create();
  vm.orderId=18;vm.$hooks.onPageShow();await tick();
  assert.equal(name==='list'?vm.orders[0].status:vm.order.status,'制作中');
  if(name==='detail')assert.equal(vm.pickupCode,'012345');
  status='已完成';signal();advance();await tick();
  assert.equal(name==='list'?vm.orders[0].status:vm.order.status,'已完成');
  if(name==='detail'){
   assert.equal(vm.pickupCode,'','completion removes pickup code');
   detailResolve=true;signal();advance();vm.$hooks.onPageHide();
   detailResolve({ok:true,data:{...row(),status:'待取货'}});await tick();
   assert.equal(vm.order.status,'已完成','hidden page rejects late response');detailResolve=null;
  }else vm.$hooks.onPageHide();
  assert.equal(listeners.size,0);
 }
 console.log('Order live checks passed: shared socket subscription, event coalescing, mutation wait, queued follow-up, failure recovery, hide/unload cleanup and account isolation.');
})().catch(e=>{console.error(e);process.exitCode=1});

