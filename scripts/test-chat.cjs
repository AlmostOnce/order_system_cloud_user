// 在Node执行真实接口解析、聊天页逻辑；Socket发送使用模拟实现；不访问真实服务。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const {loadSetup}=require('./setup-harness.cjs');
let response,readCalls=0,sendCalls=[],keys=0,frames=[];
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
let messages=[];let canSend=true;
const chat={conversationUuid:id,orderId:8,orderNo:'O8',windowName:'小店',canSend:true};
const source=fs.readFileSync('pages/notifications/chat.uvue','utf8');
const factory=loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('api/chat'))return {...api,fetchChatDetail:async()=>ok({...chat,canSend}),fetchChatMessages:async(uuid,before,after)=>ok({items:messages.filter(m=>after<0||m.seq>after).slice().reverse(),hasMore:false,nextCursor:null}),readChat:async()=>{readCalls++;return ok(null);}};
 if(p.includes('store/notifications'))return {subscribeChat(){},unsubscribeChat(){},startNotificationSession(){},refreshNotificationCount(){},sendChatMessage:async(...args)=>{sendCalls.push(args);return frames.shift()??null;}};
 if(p.includes('common/json'))return json;
 if(p.includes('store/auth'))return {currentUser:()=>({userUuid:owner,roleCode:'CUSTOMER'})};
 if(p.includes('common/comments'))return {newCommentKey:()=>`33333333-3333-4333-8333-${String(++keys).padStart(12,'0')}`};
 if(p.includes('api/wallet'))return {fetchMyProfile:async()=>ok({}),walletPayload:()=>null};
 if(p.includes('feedback'))return {toast(){}};
 return {};
});
global.uni={getWindowInfo:()=>({windowHeight:800,statusBarHeight:24}),navigateBack(){},reLaunch(){}};
const originalInterval=global.setInterval;global.setInterval=()=>1;global.clearInterval=()=>{};
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const vm=factory.create();vm.$hooks.onLoad({conversationUuid:id});vm.$hooks.onPageShow();await tick();
 assert.equal(vm.title,'小店');assert.equal(vm.ready,true);
 vm.draft='你好';vm.send();await tick();assert.equal(vm.pending.length,1);assert.equal(vm.pending[0].sending,false);
 const firstKey=sendCalls[0][1];const message={messageUuid:id,seq:1,senderUuid:owner,senderName:'我',senderSide:'CUSTOMER',clientMessageId:firstKey,content:'你好',createdAt:'2026-11-06T12:00:00'};
 frames.push({type:'chat.ack',message});messages=[message];vm.retry(firstKey);await tick();
 assert.equal(sendCalls[1][1],firstKey,'retry keeps idempotency key');assert.equal(vm.pending.length,0);assert.equal(vm.items.length,1);
 const reads=readCalls;vm.markRead();vm.markRead();await tick();assert.equal(readCalls,reads,'unchanged reading watermarks do not cause push loops');
 canSend=false;await vm.sync();assert.equal(vm.canSend,false);vm.draft='再发';const before=sendCalls.length;vm.send();await tick();assert.equal(sendCalls.length,before);
 vm.$hooks.onPageHide();const itemCount=vm.items.length;await vm.sync();assert.equal(vm.items.length,itemCount);
 vm.$hooks.onUnload();global.setInterval=originalInterval;
 console.log('Chat checks passed: response validation, retry key, ACK merge, read watermark loop guard, readonly state and page cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
