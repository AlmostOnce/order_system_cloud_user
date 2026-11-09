// 运行真实本机删除标记逻辑，不触碰服务端数据库。
const fs=require('node:fs'),assert=require('node:assert/strict');
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const storage=new Map(),mod={exports:{}};let fail=false;
global.uni={getStorageSync:k=>storage.get(k)??'',setStorageSync:(k,v)=>{if(fail)throw Error('full');storage.set(k,v)}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('common/chat-local.uts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports);
const {hiddenChatMessages,hideChatMessage}=mod.exports;
const id='11111111-1111-4111-8111-111111111111';
// 真机缺失Key返回空串，不能像旧模拟返回undefined；空白记录不能进入JSON解析器。
const originalParse=JSON.parse;let parseCalls=0;
JSON.parse=(...args)=>{parseCalls++;return originalParse(...args);};
assert.deepEqual(hiddenChatMessages('fresh-user','fresh-chat'),[]);
storage.set('chat_hidden_fresh-user_fresh-chat','   ');
assert.deepEqual(hiddenChatMessages('fresh-user','fresh-chat'),[]);
assert.equal(parseCalls,0,'missing or blank storage must not invoke JSON.parse');
JSON.parse=originalParse;
storage.set('chat_hidden_broken_chat','[');assert.deepEqual(hiddenChatMessages('broken','chat'),[]);
storage.set('chat_hidden_wrong_chat','{}');assert.deepEqual(hiddenChatMessages('wrong','chat'),[]);

assert.equal(hideChatMessage('user-a','chat-a',id),true);
assert.deepEqual(hiddenChatMessages('user-a','chat-a'),[id]);
hideChatMessage('user-a','chat-a',id);assert.equal(hiddenChatMessages('user-a','chat-a').length,1);
assert.deepEqual(hiddenChatMessages('user-b','chat-a'),[]);assert.deepEqual(hiddenChatMessages('user-a','chat-b'),[]);
fail=true;assert.equal(hideChatMessage('user-a','chat-a','22222222-2222-4222-8222-222222222222'),false);
assert.deepEqual(hiddenChatMessages('user-a','chat-a'),[id]);
console.log('Chat local checks passed: persistence, deduplication, account/conversation isolation and failed-write handling.');
