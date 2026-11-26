const fs = require('node:fs'), assert = require('node:assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
let status = '待取货', calls = 0;
global.uni = { getWindowInfo: () => ({ statusBarHeight: 0 }), getStorageSync: () => false, removeStorageSync() {}, navigateTo() {}, switchTab() {}, reLaunch() {} };
function page(file) {
 const source = fs.readFileSync(file, 'utf8');
 return loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], path => {
  if (path.includes('common/order-live')) return {startOrderLiveRefresh:()=>()=>{}};
  if (path.includes('api/comments')) return {fetchOrderReviews: () => Promise.resolve({}), commentPayload: () => null, parseOrderReviews: () => null};
  if (path.includes('api/order')) return {
   fetchOrder: () => Promise.resolve({ ok: true, data: { orderId: 18, windowId: 2, status, items: [{quantity:1,fulfillableQuantity:1}] } }), parseOrder: data => data,
   fetchPickupCode: () => { calls++; return Promise.resolve({ ok: true, data: { pickupCode: '012345' } }); },
   fetchPickupQr: () => Promise.resolve({ ok: true, data: { imageBase64: 'AAAA' } }),
   orderPayload: result => result.ok ? result.data : null
  };
  // 取餐地点是独立展示链路，补齐桩避免订单详情加载时因缺函数中断。
  if (path.includes('api/product')) return { fetchWindowSummary: () => Promise.resolve({ ok: true, message: '', location: '一食堂一楼' }) };
  if (path.includes('store/auth')) return { currentUser: () => ({ userUuid: 'owner', roleCode: 'CUSTOMER' }) };
  if (path.includes('checkout')) return { paymentPendingKey: () => 'pending', cleanupKey: () => 'cleanup', readStoredObject: () => null };
  if (path.includes('json')) return { jsonString: (data, key) => data[key] ?? null };
  return {};
 }).create();
}
(async () => {
 const customer = page('pages/order/detail.uvue'); customer.orderId = 18;
 customer.$hooks.onPageShow(); await tick(); assert.equal(customer.pickupCode, '012345'); assert.equal(calls, 1);
 // 取餐地点独立加载：失败不影响取餐码，成功后展示在订单详情。
 assert.equal(customer.windowLocation, '一食堂一楼', 'pickup location loads with the order');
 customer.order.items[0].fulfillableQuantity=0;const oldCalls=calls;await customer.loadPickupCode();assert.equal(calls,oldCalls,'approved full refund cannot load an old code');assert.equal(customer.canPickup,false);
 customer.$hooks.onPageHide(); assert.equal(customer.pickupCode, '');
 await customer.loadPickupCode(); assert.equal(calls, 1);
 status = '已完成'; customer.$hooks.onPageShow(); await tick(); assert.equal(customer.pickupCode, ''); assert.equal(calls, 1);
 console.log('Pickup UI checks passed: customer-only retrieval lifecycle and completed-code hiding.');
})().catch(error => { console.error(error); process.exitCode = 1; });
