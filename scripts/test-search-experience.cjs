const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const { loadSetup } = require('./setup-harness.cjs');

const storage = new Map();
const navigation = [];
const messages = [];
let user = { userUuid: 'user-a', roleCode: 'CUSTOMER' };
let succeeds = true;
global.uni = {
    getStorageSync: key => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    getWindowInfo: () => ({ statusBarHeight: 24 }),
    navigateTo: options => navigation.push(options.url),
    reLaunch: () => {}, switchTab: () => {}
};
const historySource = fs.readFileSync('common/search-history.uts', 'utf8');
assert.equal(ts.createSourceFile('history.ts', historySource, ts.ScriptTarget.Latest, true).parseDiagnostics.length, 0);
const historyModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(historySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText)(historyModule, historyModule.exports);
const history = historyModule.exports;
const flush = () => new Promise(resolve => setImmediate(resolve));

(async () => {
    let entries = [];
    for (let i = 0; i < 12; i++) {
        assert.equal(history.saveSearchHistory('user-a', '词' + i, entries), true);
        entries = history.readSearchHistory('user-a');
    }
    assert.equal(entries.length, 10);
    assert.equal(entries[0], '词11');
    history.saveSearchHistory('user-a', '词5', entries);
    assert.equal(history.readSearchHistory('user-a')[0], '词5');
    assert.equal(history.readSearchHistory('user-a').filter(x => x === '词5').length, 1);
    const beforeRemoval = history.readSearchHistory('user-a');
    assert.equal(history.removeSearchHistory('user-a', '词5', beforeRemoval), true);
    assert.deepEqual(history.readSearchHistory('user-a'), beforeRemoval.filter(x => x !== '词5'));
    assert.deepEqual(history.readSearchHistory('user-b'), []);
    storage.set('search_history_user-b', '{invalid');
    assert.deepEqual(history.readSearchHistory('user-b'), []);
    history.clearSearchHistory('user-a');
    assert.deepEqual(history.readSearchHistory('user-a'), []);

    const searchSource = fs.readFileSync('pages/search/search.uvue', 'utf8');
    const search = loadSetup(searchSource.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], request => {
        if (request.endsWith('/auth.uts')) return { isLoggedIn: () => true, currentUser: () => user };
        if (request.endsWith('/feedback.uts')) return { toast: message => messages.push(message) };
        if (request.endsWith('/search-history.uts')) return history;
        if (request.endsWith('/search.uts')) return { searchProducts: () => Promise.resolve(succeeds
            ? { ok: true, page: 1, size: 20, total: 0, items: [] }
            : { ok: false, message: '网络错误' }) };
        return {};
    }).create();
    search.$hooks.onPageShow();
    search.keyword = ' 鸡肉 ';
    search.submit();
    await flush();
    assert.deepEqual(Array.from(search.history), ['鸡肉']);
    search.toggleHistoryEditing();
    search.searchHistory('鸡肉');
    assert.equal(search.historyEditing, true);
    search.removeHistory('鸡肉');
    assert.deepEqual(Array.from(search.history), []);
    assert.deepEqual(history.readSearchHistory('user-a'), []);
    assert.equal(search.historyEditing, false);
    succeeds = true;
    search.keyword = '鸡肉';
    search.submit();
    await flush();
    succeeds = false;
    search.keyword = '失败关键词';
    search.submit();
    await flush();
    assert.deepEqual(Array.from(search.history), ['鸡肉'], 'failed searches are not stored');
    search.clearHistory();
    assert.equal(search.historyClearConfirm, true);
    search.cancelClearHistory();
    assert.deepEqual(history.readSearchHistory('user-a'), ['鸡肉']);
    search.clearHistory();
    search.confirmClearHistory();
    assert.equal(search.historyClearConfirm, false);
    assert.deepEqual(history.readSearchHistory('user-a'), []);
    search.openWindow({ windowId: 2, productId: 7 });
    assert.equal(navigation.pop(), '/pages/menu/menu?windowId=2&productId=7');
    user = { userUuid: 'user-b', roleCode: 'CUSTOMER' };
    search.$hooks.onPageShow();
    assert.deepEqual(Array.from(search.history), [], 'switching account isolates history');
    assert.equal(search.submittedKeyword, '', 'switching account clears old results');

    const menuSource = fs.readFileSync('pages/menu/menu.uvue', 'utf8');
    let menuFails = true;
    const menu = loadSetup(menuSource.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], request => {
        if (request.endsWith('/feedback.uts')) return { toast: message => messages.push(message) };
        if (request.endsWith('/menu.uts')) return { fetchWindowMenu: () => Promise.resolve(menuFails
            ? { ok: false, message: '菜单不可用', menu: null }
            : { ok: true, menu: { windowName: '窗口', imageUrl: '', location: '', description: '',
                categories: [{ categoryId: 11, categoryName: '米饭', products: [{ productId: 1 }] }],
                uncategorizedProducts: [{ productId: 7 }] } }) };
        if (request.endsWith('/stock.uts')) return { fetchWindowStocks: () => Promise.resolve({ ok: true, items: [] }) };
        if (request.endsWith('/cart.uts')) return { fetchCart: () => Promise.resolve({ ok: true, cart: { windows: [] } }) };
        return {};
    }).create();
    menu.$hooks.onLoad({ windowId: '2', productId: '7' });
    await menu.loadMenu();
    assert.equal(menu.highlightedProductId, 0, 'failed menu load keeps the target pending');
    menuFails = false;
    await menu.loadMenu();
    await flush();
    assert.equal(menu.activeCategoryId, -1);
    assert.equal(menu.railAnchor, 'menu-rail-other');
    assert.equal(menu.dishesAnchor, 'menu-product-7');
    assert.equal(menu.highlightedProductId, 7);
    menu.selectCategory(11);
    await flush();
    assert.equal(menu.dishesAnchor, 'menu-category-11', 'manual category selection takes control');
    assert.equal(menu.highlightedProductId, 0);
    menu.$hooks.onLoad({ windowId: '2', productId: '99' });
    menu.locateRequestedProduct();
    assert.ok(messages.includes('该菜品已下架或暂不可用'));
    menu.$hooks.onUnload();
    assert.ok(menuSource.includes(':id="productSectionId(product.productId)"'));
    console.log('Search experience checks passed: history isolation, ordering, failure handling, routing, target category, and unavailable product.');
})().catch(error => { console.error(error); process.exitCode = 1; });
