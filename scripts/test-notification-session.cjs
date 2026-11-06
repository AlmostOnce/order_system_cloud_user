const fs = require('node:fs'), assert = require('node:assert/strict');
const ts = require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
let owner = 'user-a', count = 3, closed = 0, badge = '', changes = 0;
const sockets = [], timeouts = [], sentFrames = []; let chatChanges = 0;
const moduleData = { exports: {} };
global.uni = {
 setTabBarBadge: options => { badge = options.text; }, removeTabBarBadge: () => { badge = ''; },
 connectSocket: () => {
  const handlers = {};
  const socket = { handlers, send: options => { sentFrames.push(JSON.parse(options.data)); }, close: () => { closed++; }, onOpen: fn => { handlers.open = fn; }, onMessage: fn => { handlers.message = fn; }, onClose: fn => { handlers.close = fn; }, onError: fn => { handlers.error = fn; } };
  sockets.push(socket); return socket;
 }
};
const source = fs.readFileSync('store/notifications.uts', 'utf8');
new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(path => {
 if (path === 'vue') return { reactive: value => value };
 if (path.includes('api/notifications')) return { fetchUnreadNotificationCount: () => Promise.resolve({ ok: true, data: { data: count } }), requestNotificationSocketTicket: () => Promise.resolve({ ok: true }), parseNotificationSocketTicket: () => 'a'.repeat(43) };
 if (path.includes('config')) return { API_BASE_URL: 'http://localhost:8088/api' };
 if (path.includes('storage')) return { getAccessToken: () => owner, isSessionClosing: () => false };
 if (path.includes('jwt')) return { parseTokenPayload: token => token ? { userUuid: token } : null };
 if (path.includes('json')) return { jsonNumber: (data, key) => data[key], jsonString: (data, key) => data[key], parseJsonObject: text => JSON.parse(text) };
 if (path.includes('api/chat')) return { fetchChatUnreadCount: async () => ({ok:true,data:{data:0}}) };
 return {};
}, moduleData, moduleData.exports, fn => { timeouts.push(fn); return timeouts.length; }, () => {}, () => 1, () => {});
const api = moduleData.exports, tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
 api.subscribeNotifications(() => changes++);
 api.startNotificationSession(); await tick(); assert.equal(sockets.length, 1); assert.equal(badge, '3');
 api.startNotificationSession(); await tick(); assert.equal(sockets.length, 1);
 sockets[0].handlers.open(); await tick(); assert.equal(changes, 1, 'connection recovery notifies page subscribers'); changes = 0;
 count = 5; sockets[0].handlers.message({ data: '{"type":"notification.changed"}' }); await tick(); assert.equal(badge, '5'); assert.equal(changes, 1);
 // 聊天事件只能唤醒聊天订阅，不刷新订单；ACK精确匹配幂等键，注销终止未确认发送。
 api.subscribeChat(() => chatChanges++);
 sockets[0].handlers.message({ data: '{"type":"chat.changed"}' }); await tick();
 assert.equal(chatChanges, 1); assert.equal(changes, 1, 'chat does not refresh order subscribers');
 const pending = api.sendChatMessage('conversation', 'client-1', '你好');
 assert.equal(sentFrames[0].clientMessageId, 'client-1');
 assert.equal(await api.sendChatMessage('conversation', 'client-1', '你好'), null, 'same key cannot await twice');
 let settled = false; pending.then(() => { settled = true; });
 sockets[0].handlers.message({ data: '{"type":"chat.ack","requestId":"other"}' }); await tick();
 assert.equal(settled, false, 'unrelated ACK cannot confirm the message');
 sockets[0].handlers.message({ data: '{"type":"chat.ack","requestId":"client-1"}' });
 assert.equal((await pending).requestId, 'client-1');
 const interrupted = api.sendChatMessage('conversation', 'client-2', '稍后');
 api.stopNotificationSession(); assert.equal(await interrupted, null, 'logout leaves send unconfirmed'); sockets[0].handlers.message({ data: '{"type":"notification.changed"}' }); await tick(); assert.equal(changes, 1); assert.equal(closed, 1);
 owner = 'user-b'; count = 0; api.startNotificationSession(); await tick(); assert.equal(sockets.length, 2); assert.equal(badge, '');
 api.stopNotificationSession(true); assert.equal(api.notificationState.unreadCount, 0);
 const timerCount = timeouts.length; sockets[1].handlers.close(); assert.equal(timeouts.length, timerCount);
 console.log('Notification session checks passed: single connection, badge updates, visibility cleanup, account isolation, stale callbacks, typed chat events, ACK matching and interrupted sends.');
})().catch(error => { console.error(error); process.exitCode = 1; });
