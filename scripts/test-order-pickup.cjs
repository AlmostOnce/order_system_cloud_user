const fs = require('node:fs'), assert = require('node:assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
let role = 'CUSTOMER', status = '待取货', calls = 0, verifyCalls = [], resolveVerify;
global.uni = { getWindowInfo: () => ({ statusBarHeight: 0 }), getStorageSync: () => false, removeStorageSync() {}, navigateTo() {}, switchTab() {}, reLaunch() {} };
function page(file) {
 const source = fs.readFileSync(file, 'utf8');
 return loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], path => {
  if (path.includes('api/comments')) return {fetchOrderReviews: () => Promise.resolve({}), commentPayload: () => null, parseOrderReviews: () => null};
  if (path.includes('api/order')) return {
   fetchOrder: () => Promise.resolve({ ok: true, data: { orderId: 18, status, items: [] } }), parseOrder: data => data,
   fetchPickupCode: () => { calls++; return Promise.resolve({ ok: true, data: { pickupCode: '012345' } }); },
   orderPayload: result => result.ok ? result.data : null,
   verifyOrderPickup: (...args) => { verifyCalls.push(args); return new Promise(resolve => { resolveVerify = resolve; }); }
  };
  if (path.includes('store/auth')) return { currentUser: () => ({ userUuid: 'owner', roleCode: role }) };
  if (path.includes('checkout')) return { paymentPendingKey: () => 'pending', cleanupKey: () => 'cleanup', readStoredObject: () => null };
  if (path.includes('json')) return { jsonString: (data, key) => data[key] ?? null };
  return {};
 }).create();
}
(async () => {
 const customer = page('pages/order/detail.uvue'); customer.orderId = 18;
 customer.$hooks.onPageShow(); await tick(); assert.equal(customer.pickupCode, '012345'); assert.equal(calls, 1);
 customer.$hooks.onPageHide(); assert.equal(customer.pickupCode, '');
 await customer.loadPickupCode(); assert.equal(calls, 1);
 status = '已完成'; customer.$hooks.onPageShow(); await tick(); assert.equal(customer.pickupCode, ''); assert.equal(calls, 1);
 role = 'STALL_MANAGER'; const merchant = page('pages/manage/pickup.uvue'); merchant.$hooks.onPageShow();
 merchant.pickupCode = '123'; await merchant.verify(); assert.equal(verifyCalls.length, 0);
 merchant.pickupCode = '012345'; const pending = merchant.verify(); merchant.verify(); assert.equal(verifyCalls.length, 1);
 assert.deepEqual(verifyCalls[0], ['012345']);
 resolveVerify({ ok: false, message: '取餐码不正确' }); await pending; assert.equal(merchant.pickupCode, ''); assert.equal(merchant.succeeded, false);
 merchant.pickupCode = '012345'; const success = merchant.verify(); resolveVerify({ ok: true, data: { status: '已完成' } }); await success;
 assert.equal(merchant.succeeded, true); assert.equal(merchant.pickupCode, '');
 await merchant.verify(); assert.equal(verifyCalls.length,2,'success cannot be submitted again');merchant.nextOrder();assert.equal(merchant.succeeded,false);
 const template=fs.readFileSync('pages/manage/pickup.uvue','utf8').split('<script')[0];assert.equal(template.includes('v-model="orderNo"'),false,'order number input removed');
 console.log('Pickup UI checks passed: customer-only retrieval lifecycle, completed-code hiding, merchant validation, duplicate guard, failure recovery and code clearing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
