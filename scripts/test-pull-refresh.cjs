const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require(process.env.ORDER_TEST_TYPESCRIPT || 'D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..');
let clock = 1700000000000;
const timers = [];
Date.now = () => clock;
global.setTimeout = (fn, delay) => { timers.push({ fn, at: clock + delay }); return timers.length; };
function advance(ms) {
    clock += ms;
    for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= clock) { const timer = timers.splice(i, 1)[0]; timer.fn(); }
}
const refreshSource = fs.readFileSync(path.join(root, 'common/refresh.uts'), 'utf8');
const refreshModule = { exports: {} };
new Function('exports', 'module', ts.transpileModule(refreshSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(refreshModule.exports, refreshModule);
const cases = [
    ['home/home', ['loadCatalog'], { roleCode: 'CUSTOMER' }],
    ['menu/menu', ['loadMenu'], {}],
    ['mine/mine', ['loadProfile', 'loadBalance'], { roleCode: 'CUSTOMER' }],
    ['account/profile', ['loadProfile'], { loading: false }],
    ['account/pay-password', ['loadStatus'], { ready: true }],
    ['wallet/recharge', ['loadBalance'], { balanceReady: true }],
    ['wallet/records', ['loadRecords'], {}],
    ['order/list', ['load'], {}],
    ['order/confirm', ['loadCart'], {}],
    ['order/detail', ['refresh', 'retryCleanup'], {}]
];
function page(name) {
    const source = fs.readFileSync(path.join(root, 'pages', name + '.uvue'), 'utf8');
    assert.ok(source.includes('@refresherrefresh="refreshPage"'), name + ': gesture handler wired');
    assert.ok(source.includes(':refresher-triggered="refreshing"'), name + ': indicator wired');
    assert.ok(source.includes('<refresh-header slot="refresher"'), name + ': time is in refresher slot');
    assert.ok(source.includes('refresher-default-style="none"'), name + ': custom refresher enabled');
    assert.ok(!source.includes('class="refresh-status"') && !source.includes('上次刷新：'), name + ': no timestamp in page body');
    const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
    const parsed = ts.createSourceFile(name + '.ts', script, ts.ScriptTarget.Latest, true);
    assert.equal(parsed.parseDiagnostics.length, 0, name + ': syntax');
    const setup = require('./setup-harness.cjs').loadSetup(script, request => request.endsWith('/refresh.uts') ? refreshModule.exports : {});
    const vm = setup.create();
    return vm;
}
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
    for (const [name, tasks, state] of cases) {
        const vm = page(name); Object.assign(vm, { loading: false }, state);
        const resolvers = [], calls = [];
        for (const task of tasks) vm[task] = (...args) => { calls.push({ task, args }); return new Promise(resolve => resolvers.push(resolve)); };
        assert.equal(vm.refreshing, false, name + ': initial load is not a pull refresh');
        vm.refreshPage(); assert.equal(vm.refreshing, true, name + ' starts refresh');
        assert.equal(calls.length, tasks.length, name + ': refresh data sources');
        vm.refreshPage(); assert.equal(calls.length, tasks.length, name + ': no overlapping refresh');
        if (name === 'wallet/records') assert.deepEqual(calls[0].args, [true], 'ledger refresh starts at first page');
        resolvers[0](); await flush();
        if (tasks.length > 1) assert.equal(vm.refreshing, true, name + ': waits for all sources');
        for (let i = 1; i < resolvers.length; i++) resolvers[i]();
        await flush(); assert.equal(vm.refreshing, true, name + ': animation minimum duration');
        advance(1199); assert.equal(vm.refreshing, true, name + ': still animating before minimum');
        advance(1); assert.equal(vm.refreshing, false, name + ': stops at minimum');
        assert.ok(vm.currentRefreshTime.length > 0, name + ': successful refresh timestamp');
        const lastSuccess = vm.currentRefreshTime;
        for (const task of tasks) vm[task] = () => Promise.reject(new Error('request failed'));
        vm.refreshPage(); const failedAttempt = vm.currentRefreshTime;
        assert.notEqual(failedAttempt, lastSuccess, name + ': shows this attempt time rather than previous refresh');
        await flush(); assert.equal(vm.refreshing, true, name + ': failure also keeps stable animation');
        advance(1200); assert.equal(vm.refreshing, false, name + ': stops on failure');
        assert.equal(vm.currentRefreshTime, failedAttempt, name + ': failed attempt never displays previous refresh time');
    }
    let finished = false;
    const started = clock; advance(2000);
    refreshModule.exports.finishPullRefresh(started, true, () => { finished = true; });
    assert.equal(finished, true, 'slow requests finish without an extra artificial delay');
    assert.equal(timers.length, 0);
    for (const [name, guard, value] of [['order/confirm', 'pending', true], ['order/confirm', 'submitting', true], ['order/detail', 'paying', true], ['wallet/recharge', 'submitting', true], ['account/pay-password', 'saving', true], ['menu/menu', 'mutating', true]]) {
        const vm = page(name); vm[guard] = value; vm.refreshPage();
        assert.equal(vm.refreshing, false, name + ': guards ' + guard);
    }
    console.log('Pull refresh checks passed for 10 pages: gesture binding, loading separation, completion/failure cleanup, multi-request waiting, duplicate and mutation guards, ledger reset, 1.2s minimum animation, successful timestamps and slow request completion.');
})().catch(error => { console.error(error); process.exitCode = 1; });
