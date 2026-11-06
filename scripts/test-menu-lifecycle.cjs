// 执行真实页面逻辑，用可控响应顺序复现返回首页后的迟到请求。
const fs = require('fs');
const assert = require('assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
global.uni = { getWindowInfo: () => ({ statusBarHeight: 24 }), createSelectorQuery: () => ({ in() { return this; }, selectAll() { return this; }, scrollOffset() { return this; }, exec() {} }) };
const source = fs.readFileSync('pages/menu/menu.uvue', 'utf8');
function createPage() {
    const pending = [];
    const page = loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], request => {
        if (request.endsWith('/menu.uts')) return { fetchWindowMenu: () => new Promise(resolve => pending.push(resolve)) };
        if (request.endsWith('/comments.uts')) return { fetchCardRatings: () => Promise.resolve([]) };
        if (request.endsWith('/cart.uts')) return { fetchCart: () => Promise.resolve({ ok: true, cart: { windows: [] } }) };
        if (request.endsWith('/stock.uts')) return { fetchWindowStocks: () => Promise.resolve({ ok: true, items: [] }) };
        return {};
    }).create();
    page.windowId = 1;
    return { page, pending };
}
function result(name) {
    return { ok: true, menu: { windowName: name, imageUrls: [], location: '', description: '',
        categories: [{ categoryId: 1, categoryName: name, products: [{ productId: 1 }] }], uncategorizedProducts: [] } };
}
(async () => {
    const first = createPage();
    const leaving = first.page.loadMenu();
    first.page.$hooks.onUnload();
    first.pending[0](result('已退出页面'));
    await leaving;
    assert.equal(first.page.groups.length, 0, '退出后迟到菜单不得更新已卸载的原生视图');

    const second = createPage();
    second.page.$hooks.onReady();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(second.page.layoutReady, true, '首帧完成后再挂载左侧分类栏');
    const older = second.page.loadMenu();
    const newer = second.page.loadMenu();
    second.pending[1](result('新菜单'));
    await newer;
    second.pending[0](result('旧菜单'));
    await older;
    assert.equal(second.page.windowName, '新菜单', '较早发出的请求不得覆盖新菜单和分类');
    second.page.$hooks.onUnload();
    await new Promise(resolve => setTimeout(resolve, 90));
    assert.equal(second.page.listReady, false, '退出后入场定时器不得继续写入状态');
    console.log('PASS: menu unload, out-of-order responses and entry timer isolation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
