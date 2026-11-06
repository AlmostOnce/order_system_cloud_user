// 动画生命周期执行真实页面逻辑；不请求排行榜、不依赖真机编译器。
const fs = require('fs'), assert = require('assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const source = fs.readFileSync('pages/ranking/ranking.uvue', 'utf8');
global.uni = { getWindowInfo: () => ({ statusBarHeight: 24 }) };
let loads = 0;
const vm = loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], name => {
    if (name.includes('store/notifications')) return { startNotificationSession() {} };
    if (name.includes('store/auth')) return { isLoggedIn: () => true, currentUser: () => ({ roleCode: 'CUSTOMER' }) };
    return {};
}).create();
vm.loadRanking = async () => { loads++; };
const wait = () => new Promise(resolve => setTimeout(resolve, 90));
(async () => {
    vm.$hooks.onPageShow();
    vm.$hooks.onReady();
    assert.equal(vm.rankAnimationEntered, false);
    await wait(); assert.equal(vm.rankAnimationEntered, true);
    assert.equal(loads, 1, 'animation does not add a ranking request');
    vm.$hooks.onPageHide(); assert.equal(vm.rankAnimationEntered, false);
    vm.$hooks.onPageShow(); await wait(); assert.equal(vm.rankAnimationEntered, true);
    vm.$hooks.onPageHide(); vm.$hooks.onPageShow(); vm.$hooks.onUnload();
    await wait(); assert.equal(vm.rankAnimationEntered, false, 'unloaded page cannot animate from a late timer');
    console.log('PASS: ranking animation on first entry/return, cancellation and no extra requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
