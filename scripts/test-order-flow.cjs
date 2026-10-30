// Runs frontend business logic in Node; does not compile the app or call live APIs.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require(process.env.ORDER_TEST_TYPESCRIPT || 'D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..');
const storage = new Map();
global.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key), redirectTo() {}, navigateTo() {}, getWindowInfo: () => ({ statusBarHeight: 0 }) };
const calls = [];
let response = null;
const http = {};
for (const method of ['httpGet', 'httpPost', 'httpPatch']) http[method] = (...args) => { calls.push({ method, args }); return Promise.resolve(typeof response === 'function' ? response(args[0]) : response); };
const cache = new Map();
function load(relative) {
    const file = path.resolve(root, relative);
    if (file === path.resolve(root, 'store/notifications.uts')) return { notificationState: { unreadCount: 0 }, startNotificationSession() {}, refreshNotificationCount: () => Promise.resolve() };
    if (cache.has(file)) return cache.get(file);
    if (file === path.resolve(root, 'common/http.uts')) return http;
    if (file === path.resolve(root, 'store/auth.uts')) return { currentUser: () => ({ userUuid: '12345678-1234-4234-8234-123456789abc', roleCode: 'CUSTOMER' }) };
    if (file === path.resolve(root, 'common/account.uts')) return { accountDate: s => s, backToAccount() {} };
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.uvue')) { const setup = require('./setup-harness.cjs').loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], p => load(path.relative(root, path.resolve(path.dirname(file), p)))); cache.set(file, setup); return setup; }
    const parsed = ts.createSourceFile(file + '.ts', source, ts.ScriptTarget.Latest, true);
    assert.equal(parsed.parseDiagnostics.length, 0, relative + ': syntax');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const mod = { exports: {} }; cache.set(file, mod.exports);
    new Function('require', 'exports', 'module', output)(p => load(path.relative(root, path.resolve(path.dirname(file), p))), mod.exports, mod);
    cache.set(file, mod.exports); return mod.exports;
}
function page(relative) {
    const vm = load(relative).create();
    return { vm, component: vm.$hooks };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const ok = data => ({ ok: true, data: { data }, message: '', statusCode: 200 });
const orderData = { orderId: 11, orderNo: 'O11', windowId: 2, totalAmount: 18, status: '待支付', items: [{ productId: 3, productName: '饭', quantity: 2, unitPrice: 9, lineAmount: 18 }] };

(async () => {
    const api = load('api/order.uts');
    await api.verifyOrderPickup('012345');
    assert.deepEqual(calls.at(-1).args.slice(0,2),['/orders/pickup/verify',{pickupCode:'012345'}]);
    calls.length=0;
    const checkout = load('common/checkout.uts');
    const draft = { key: 'order-original', windowId: 2, windowName: '一食堂', remark: '少辣', items: [{ productId: 3, productName: '饭', quantity: 2, revision: 'rev-original', unitPrice: 9, lineAmount: 18 }] };
    assert.deepEqual(checkout.orderBody(draft), { windowId: 2, remark: '少辣', items: [{ productId: 3, quantity: 2 }] });
    assert.equal(checkout.cleanupBody(draft).items[0].revision, 'rev-original');
    assert.equal(api.parseOrder({ ...orderData, totalAmount: null }), null);
    assert.equal(api.parseOrder({ ...orderData, items: [null] }), null);
    assert.equal(api.parseOrder(orderData).items[0].lineAmount, 18);
    assert.equal(api.parseOrder({...orderData,windowName:'川味小厨'}).windowName,'川味小厨');
    assert.equal(api.parseOrder(orderData).windowName,'','missing name never becomes an internal window id');

    const { vm, component } = page('pages/order/confirm.uvue');
    Object.assign(vm, { userUuid: '12345678-1234-4234-8234-123456789abc', windowId: 2, windowName: draft.windowName, items: draft.items, remark: draft.remark });
    response = { ok: false, statusCode: 0, message: 'timeout' };
    vm.submit(); await flush();
    assert.equal(vm.pending, true);
    const first = calls.find(c => c.args[0] === '/orders');
    const saved = checkout.readCheckout('12345678-1234-4234-8234-123456789abc');
    assert.equal(saved.key, first.args[3]);
    vm.submit(); await flush();
    const submitted = calls.filter(c => c.args[0] === '/orders');
    assert.deepEqual(submitted[0].args, submitted[1].args, 'uncertain retry uses identical body and key');
    const restored = page('pages/order/confirm.uvue');
    restored.component.onPageShow.call(restored.vm);
    assert.equal(restored.vm.pending, true);
    assert.equal(restored.vm.requestKey, saved.key);
    assert.equal(restored.vm.remark, '少辣');

    response = ok(orderData);
    vm.submit(); await flush();
    assert.equal(vm.createdOrderId, 11);
    assert.equal(checkout.readCheckout('12345678-1234-4234-8234-123456789abc'), null);
    const cleaned = calls.find(c => c.args[0] === '/cart/orders/11/cleanup');
    assert.deepEqual(cleaned.args[1], checkout.cleanupBody(draft));
    const count = calls.filter(c => c.args[0] === '/orders').length;
    vm.submit(); await flush();
    assert.equal(calls.filter(c => c.args[0] === '/orders').length, count, 'created order cannot be submitted again');

    const rejected = page('pages/order/confirm.uvue').vm;
    Object.assign(rejected, { userUuid: '12345678-1234-4234-8234-123456789abc', windowId: 2, items: draft.items });
    response = { ok: false, statusCode: 400, message: '库存不足' };
    rejected.submit(); await flush();
    assert.equal(rejected.pending, false);
    assert.equal(checkout.readCheckout('12345678-1234-4234-8234-123456789abc'), null);

    response = { ok: false, statusCode: 409, message: '菜品库存不足' };
    rejected.submit(); await flush();
    assert.equal(rejected.pending, false, 'stock rejection allows editing cart and resubmitting');
    response = { ok: false, statusCode: 409, message: 'Idempotency-Key 已用于不同的订单请求' };
    rejected.submit(); await flush();
    assert.equal(rejected.pending, true, 'key conflict never silently starts another order');
    storage.delete(checkout.checkoutKey('12345678-1234-4234-8234-123456789abc'));
    response = ok({ status: 'SUCCESS' });
    await api.payOrder(11, 'secret');
    const payment = calls.at(-1);
    assert.deepEqual(payment.args[1], { orderId: 11, channelCode: 'BALANCE', payPassword: 'secret' });
    await api.cancelOrder(11);
    assert.equal(calls.at(-1).method, 'httpPatch');
    assert.equal(calls.at(-1).args[0], '/orders/11/cancel');

    const detail = page('pages/order/detail.uvue');
    detail.vm.payPassword = 'secret'; detail.component.onPageHide.call(detail.vm);
    assert.equal(detail.vm.payPassword, '', 'password cleared when leaving');
    Object.assign(detail.vm, { cancelConfirm: true, paymentReady: true, paymentUncertain: true, orderId: 11 });
    const before = calls.length; detail.vm.cancel(); await flush();
    assert.equal(calls.length, before, 'uncertain payment blocks cancellation');
    const state = page('pages/order/detail.uvue').vm;
    Object.assign(state, { orderId: 11, userUuid: '12345678-1234-4234-8234-123456789abc' });
    response = route => route === '/orders/11' ? ok(orderData) : route === '/users/me/balance' ? ok({ balance: 25, payPasswordSet: true }) : { ok: false, statusCode: 404, message: '支付单不存在' };
    const firstRefreshCalls = calls.length;
    state.refresh(); await flush();
    assert.equal(calls.slice(firstRefreshCalls).filter(c => c.args[0] === '/payments/order/11').length, 0, 'first visit does not query a nonexistent payment');
    assert.equal(state.paymentReady, true, 'no payment yet permits first payment');
    assert.equal(state.balanceReady, true);
    assert.equal(state.paymentExpanded, false, 'password form is hidden initially');
    const beforeOpen = calls.length;
    state.openPayment();
    assert.equal(state.paymentExpanded, true, 'pay order button expands password form');
    assert.equal(calls.length, beforeOpen, 'opening form never submits payment');
    state.payPassword = 'secret'; state.closePayment();
    assert.equal(state.paymentExpanded, false);
    assert.equal(state.payPassword, '', 'closing payment clears password');
    state.payPasswordSet = false;
    state.openPayment();
    assert.equal(state.paymentExpanded, false, 'password setup required before expanding');
    state.payPasswordSet = true;
    storage.set(checkout.paymentPendingKey(state.userUuid, 11), true);
    const recoveredPayment = page('pages/order/detail.uvue');
    recoveredPayment.vm.orderId = 11;
    const recoveryCalls = calls.length;
    recoveredPayment.component.onPageShow(); await flush();
    assert.equal(recoveredPayment.vm.paymentUncertain, true, 'page recreation restores uncertain payment');
    assert.equal(calls.slice(recoveryCalls).filter(c => c.args[0] === '/payments/order/11').length, 1, 'uncertain payment is queried on return');
    response = route => route === '/orders/11' ? ok(orderData) : route === '/users/me/balance' ? ok({ balance: 7, payPasswordSet: true }) : ok({ status: 'SUCCESS' });
    state.paymentUncertain = true;
    state.refresh(); await flush();
    assert.equal(state.paymentSuccess, true, 'successful payment remains visible while order update is pending');
    assert.equal(storage.has(checkout.paymentPendingKey(state.userUuid, 11)), false, 'confirmed payment clears recovery marker');
    state.payPassword = 'secret'; const paidCalls = calls.length; state.pay(); await flush();
    assert.equal(calls.length, paidCalls, 'successful payment cannot be reissued from detail');
    const list = page('pages/order/list.uvue');
    list.vm.orders = ['待支付', '已支付', '制作中', '待取货', '已完成', '已取消'].map((status, index) => ({ ...api.parseOrder(orderData), orderId: index + 1, status }));
    list.component.onLoad.call(list.vm, { filter: 'pending' });
    assert.deepEqual(list.vm.visibleOrders.map(o => o.status), ['待支付']);
    list.vm.selectFilter('active');
    assert.deepEqual(list.vm.visibleOrders.map(o => o.status), ['已支付', '制作中', '待取货']);
    list.vm.selectFilter('completed');
    assert.deepEqual(list.vm.visibleOrders.map(o => o.status), ['已完成']);
    list.vm.selectFilter('cancelled');
    assert.deepEqual(list.vm.visibleOrders.map(o => o.status), ['已取消']);
    list.component.onLoad.call(list.vm, { filter: 'cancelled' });
    assert.equal(list.vm.selectedStatus, 'cancelled');
    list.vm.selectFilter('all');
    assert.equal(list.vm.visibleOrders.length, 6, 'cancelled orders remain in all orders');
    list.vm.selectFilter('invalid'); assert.equal(list.vm.selectedStatus, 'all');
    const mine = page('pages/mine/mine.uvue');
    let url = ''; uni.navigateTo = options => { url = options.url; };
    const destinations = [
        ['openPendingOrders', 'pending', ['待支付'], '待支付订单'],
        ['openActiveOrders', 'active', ['已支付', '制作中', '待取货'], '进行中订单'],
        ['openCompletedOrders', 'completed', ['已完成'], '已完成订单'],
        ['openCancelledOrders', 'cancelled', ['已取消'], '已取消订单'],
        ['openOrders', 'all', ['待支付', '已支付', '制作中', '待取货', '已完成', '已取消'], '全部订单']
    ];
    const config = ts.parseConfigFileTextToJson('pages.json', fs.readFileSync(path.join(root, 'pages.json'), 'utf8')).config;
    for (const [method, status, expected, title] of destinations) {
        mine.vm[method]();
        assert.equal(url, '/pages/order/list?status=' + status);
        const [pathname, search] = url.split('?');
        assert.ok(config.pages.some(p => '/' + p.path === pathname), 'target page registered');
        const destination = page('pages/order/list.uvue');
        destination.vm.orders = list.vm.orders;
        destination.component.onLoad.call(destination.vm, Object.fromEntries(new URLSearchParams(search)));
        assert.equal(destination.vm.selectedStatus, status, method + ': selected tab');
        assert.equal(destination.vm.pageTitle, title);
        assert.deepEqual(destination.vm.visibleOrders.map(o => o.status), expected);
    }
    console.log('All 5 order shortcuts passed route registration, query parsing, selected tab, page title and result filtering checks.');
    console.log('Order flow assertions passed: price isolation, snapshot cleanup, idempotent retry/recovery, duplicate guard, rejection recovery, payment contract, cancellation guard, password clearing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
