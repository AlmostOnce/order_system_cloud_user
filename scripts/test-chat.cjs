// 在Node执行真实接口解析、聊天页逻辑；Socket发送使用模拟实现；不访问真实服务。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const {loadSetup}=require('./setup-harness.cjs');
let response,readCalls=0,sendCalls=[],keys=0,frames=[],orderCalls=0,orderFail=false;
const loadApi=()=>{
 const mod={exports:{}};
 const json={jsonString:(o,k)=>typeof o[k]==='string'?o[k]:null,jsonNumber:(o,k)=>typeof o[k]==='number'?o[k]:null,jsonBoolean:(o,k)=>typeof o[k]==='boolean'?o[k]:null,jsonObject:(o,k)=>o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])?o[k]:null,jsonArray:(o,k)=>Array.isArray(o[k])?o[k]:null};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync('api/chat.uts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(p=>p.includes('json')?json:{httpGet:async()=>response,httpPost:async(route)=>{if(route.endsWith('/read'))readCalls++;return response;}},mod,mod.exports);
 return {api:mod.exports,json};
};
const {api,json}=loadApi();
const id='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
const ok=data=>({ok:true,data:{data},message:'',statusCode:200});
assert.equal(api.parseChatConversations(ok({items:[],hasMore:true,nextCursor:''})),null);
assert.equal(api.parseChatMessages(ok({items:[{messageUuid:id,seq:-1,content:'x'}],hasMore:false})),null);
assert.equal(api.parseChatConversation({conversationUuid:id,orderId:0}),null);
let messages=[];let canSend=true;let peerReadSeq=0;
const chat={conversationUuid:id,orderId:8,orderNo:'O8',windowName:'小店',canSend:true};
assert.equal(api.parseChatConversation(chat).peerReadSeq,-1,'old server cannot imply unread');
const source=fs.readFileSync('pages/notifications/chat.uvue','utf8');
// 宽度由flex外框约束，换行自动增高但最多五行，避免长消息无限占用聊天区。
assert.match(source,/\.chat-order-mask \{ position: fixed;/,'order summary must overlay instead of taking layout space');
assert.ok(!source.includes("'height:' + availableHeight"),'page must not freeze previous tab window height');
assert.match(source,/\.chat-page \{ flex: 1;/);
assert.match(source, /<textarea[^>]*:auto-height="true"/);
assert.match(source, /\.chat-input \{[^}]*max-height: 100px/);
assert.match(source, /\.chat-input-box \{[^}]*max-height: 120px/);
const factory=loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('api/chat'))return {...api,fetchRevokedChatMessages:async()=>ok([]),revokeChatMessage:async()=>ok({...messages[0],revokedAt:new Date().toISOString(),content:"该消息已撤回"}),fetchChatDetail:async()=>ok({...chat,canSend,peerReadSeq}),fetchChatMessages:async(uuid,before,after)=>ok({items:messages.filter(m=>after<0||m.seq>after).slice().reverse(),hasMore:false,nextCursor:null}),readChat:async()=>{readCalls++;return ok(null);}};
 if(p.includes('store/notifications'))return {subscribeChat(){},unsubscribeChat(){},startNotificationSession(){},refreshNotificationCount(){},sendChatMessage:async(...args)=>{sendCalls.push(args);return frames.shift()??null;}};
 if(p.includes('common/chat-local'))return {hiddenChatMessages:()=>[],hideChatMessage:()=>true};
 if(p.includes('common/json'))return json;
 if(p.includes('store/auth'))return {currentUser:()=>({userUuid:owner,roleCode:'CUSTOMER'})};
 if(p.includes('common/comments'))return {newCommentKey:()=>`33333333-3333-4333-8333-${String(++keys).padStart(12,'0')}`};
 if(p.includes('api/wallet'))return {fetchMyProfile:async()=>ok({avatarUrl:'/files/avatar'}),walletPayload:r=>r.data.data};
 if(p.includes('api/order'))return {fetchOrder:async()=>{orderCalls++;return orderFail?{ok:false,message:'失败'}:ok({orderId:8,items:[{productName:'炒饭',quantity:2,lineAmount:24}],status:'已支付',totalAmount:24});},orderPayload:r=>r.ok?r.data.data:null,parseOrder:o=>o};
 if(p.includes('feedback'))return {toast(){}};
 return {};
});
global.uni={getWindowInfo:()=>({windowHeight:800,windowWidth:390,statusBarHeight:24}),navigateBack(){},reLaunch(){}};
const originalInterval=global.setInterval;global.setInterval=()=>1;global.clearInterval=()=>{};
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const vm=factory.create();vm.$hooks.onLoad({conversationUuid:id});vm.$hooks.onPageShow();await tick();
 assert.equal(vm.title,'小店');assert.equal(vm.ready,true);assert.equal(vm.peerReadSeq,0);
 peerReadSeq=3;await vm.sync();assert.equal(vm.peerReadSeq,3);
 peerReadSeq=1;await vm.sync();assert.equal(vm.peerReadSeq,3,'late receipt must not regress read state');
 vm.$hooks.onReady();vm.$hooks.onResize();
 assert.equal(vm.avatarUrl,'/files/avatar');assert.equal(vm.messageMaxWidth,290);
 await vm.openOrder();assert.equal(vm.orderExpanded,true);assert.equal(vm.orderSummary.items[0].productName,'炒饭');assert.equal(orderCalls,1);
 vm.closeOrderSummary();assert.equal(vm.orderExpanded,false);assert.equal(orderCalls,1);
 orderFail=true;await vm.openOrder();assert.equal(vm.orderSummary,null,'failed refresh must not display stale summary');assert.equal(vm.orderLoading,false);
 orderFail=false;await vm.openOrder();await vm.openOrder();

 // 浮层优先在气泡上方，靠屏幕边缘自动夹紧；顶部消息放下方，关闭后不遗留遮罩。
 vm.messageActions({messageUuid:id,senderUuid:owner,revokedAt:'',createdAt:new Date().toISOString()});
 vm.positionMessageMenu(280,300,90,40);assert.equal(vm.menuVisible,true);assert.equal(vm.menuBelow,false);assert.ok(vm.menuLeft+vm.menuWidth<=378);
 vm.positionMessageMenu(2,85,70,35);assert.equal(vm.menuBelow,true);assert.equal(vm.menuLeft,12);assert.ok(vm.menuTop>=109);
 vm.closeMessageMenu();assert.equal(vm.menuVisible,false);
 assert.ok(!source.includes('showActionSheet'),'chat operations must use bubble-adjacent menu');
 vm.draft='你好';vm.send();await tick();assert.equal(vm.pending.length,1);assert.equal(vm.pending[0].sending,false);
 const firstKey=sendCalls[0][1];const message={messageUuid:id,seq:1,senderUuid:owner,senderName:'我',senderSide:'CUSTOMER',clientMessageId:firstKey,content:'你好',createdAt:'2026-11-06T12:00:00'};
 // 不同会话或错误幂等键的ACK不能混入当前聊天，更不能清除本条待确认消息。
 frames.push({type:'chat.ack',conversationUuid:'99999999-9999-4999-8999-999999999999',message});vm.retry(firstKey);await tick();
 assert.equal(vm.items.length,0,'wrong-conversation ACK must not be rendered');assert.equal(vm.pending.length,1);
 frames.push({type:'chat.ack',conversationUuid:id,message});messages=[message];vm.retry(firstKey);await tick();
 assert.equal(sendCalls[2][1],firstKey,'retry keeps idempotency key');assert.equal(vm.pending.length,0);assert.equal(vm.items.length,1);
 await vm.revokeMessage(vm.items[0]);assert.ok(vm.items[0].revokedAt);assert.equal(vm.items[0].content,'该消息已撤回');
 await vm.sync();assert.ok(vm.items[0].revokedAt,'late original snapshot cannot restore revoked content');
 const reads=readCalls;vm.markRead();vm.markRead();await tick();assert.equal(readCalls,reads,'unchanged reading watermarks do not cause push loops');
 canSend=false;await vm.sync();assert.equal(vm.canSend,false);vm.draft='再发';const before=sendCalls.length;vm.send();await tick();assert.equal(sendCalls.length,before);
 vm.$hooks.onPageHide();const itemCount=vm.items.length;await vm.sync();assert.equal(vm.items.length,itemCount);
 vm.$hooks.onUnload();global.setInterval=originalInterval;
 console.log('Chat checks passed: response validation, retry key, ACK merge, read watermark loop guard, readonly state and page cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
