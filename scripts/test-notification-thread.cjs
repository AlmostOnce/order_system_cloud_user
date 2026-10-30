const fs = require('node:fs'), assert = require('node:assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const source = fs.readFileSync('pages/notifications/orders.uvue', 'utf8');
const row = n => ({ notificationId: String(n), title: '订单通知', content: '状态更新', orderId: 12, createdAt: '2026-10-30T12:00:00', readAt: '' });
const pages = [{ items: [row(3), row(2)], nextCursor: '2', hasMore: true }, { items: [row(1)], nextCursor: '', hasMore: false }, { items: [row(4), row(3)], nextCursor: '3', hasMore: true }];
const cursors = [], reads = [];
const vm = loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], path => {
 if (path.includes('api/notifications')) return { fetchNotifications: cursor => { cursors.push(cursor); return Promise.resolve(pages.shift()); }, parseNotificationPage: value => value, markNotificationRead: id => { reads.push(id); return Promise.resolve({ ok: true }); } };
 if (path.includes('store/auth')) return { currentUser: () => ({ userUuid: 'u' }) };
 if (path.includes('store/notifications')) return { refreshNotificationCount: () => Promise.resolve(), subscribeNotifications() {}, unsubscribeNotifications() {}, startNotificationSession() {} };
 if (path.includes('account')) return { accountDate: value => value };
 return {};
}).create();
(async () => {
 vm.userUuid = 'u'; // state fields are isolated below through the lifecycle guard.
 global.uni = { getWindowInfo: () => ({ statusBarHeight: 0 }), navigateTo() {}, reLaunch() {} };
 vm.$hooks.onPageShow(); await new Promise(resolve => setImmediate(resolve));
 assert.deepEqual(vm.chronologicalItems.map(item => item.notificationId), ['2', '3']);
 await vm.load(false);
 assert.deepEqual(vm.chronologicalItems.map(item => item.notificationId), ['1', '2', '3']);
 await vm.load(true);
 assert.deepEqual(vm.chronologicalItems.map(item => item.notificationId), ['1', '2', '3', '4']);
 assert.equal(vm.hasMore, false); assert.deepEqual(cursors, ['', '2', '']);
 assert.ok(reads.includes('4')); vm.$hooks.onUnload();
 console.log('Notification thread checks passed: chronological display, older-page loading, deduplication, realtime history preservation and loaded-message read acknowledgement.');
})().catch(error => { console.error(error); process.exitCode = 1; });
