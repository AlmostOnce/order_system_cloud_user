// 卡片不再放评价按钮；点卡片打开抽屉。抽屉只当容器，评论复用既有评价列表，不在菜单里另拉一套。
const fs = require('fs');
const assert = require('assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const source = fs.readFileSync('pages/menu/menu.uvue', 'utf8');
const listSource = fs.readFileSync('components/review-list/review-list.uvue', 'utf8');
const commentCalls = [];
global.uni = { getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 800 }), previewImage() {} };
const page = loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], request => {
    if (request.endsWith('/comments.uts')) return {
        fetchComments: (id, cursor) => { commentCalls.push({ id, cursor }); return Promise.resolve({ ok: true, data: null }); },
        fetchReviewSummary: () => Promise.resolve({ ok: true, data: null }),
        commentPayload: result => result.data,
        parseCommentPage: raw => raw,
        parseReviewSummary: raw => raw,
        fetchCardRatings: () => Promise.resolve([]),
        fetchWindowReviews: () => Promise.resolve({ ok: true, data: null }),
        fetchWindowRating: () => Promise.resolve({ ok: true, data: null })
    };
    return {};
}).create();
const dish = { productId: 9, productName: '鸡肉饭', description: '示例', imageUrl: '', price: 18.5, productCode: 'A', sortOrder: 1 };
(async () => {
    assert.ok(source.includes('openProductReviewDrawer(product)'));
    assert.ok(source.includes('class="dish-hit"'));
    assert.ok(!source.includes('openProductReviews(product)') && !source.includes('查看评价'), 'menu cards must not expose a review button');
    assert.ok(source.includes('<review-list') && source.includes(':embedded="true"'), 'drawer must host the existing review list');
    assert.ok(!source.includes('loadProductReviews'), 'menu must not load dish reviews itself');
    assert.ok(!source.includes('review-sheet-list'), 'drawer must not keep a second review feed');
    assert.ok(source.includes('embedWindowId') && source.includes(':hideNav="true"'), 'shop review tab reuses the same list without a drawer');
    assert.ok(!source.includes('shop-review-card'), 'shop tab must not keep a second review card UI');
    assert.ok(listSource.includes('const scoreTabs: Array<number> = [0, 5, 1]'));
    page.openProductReviewDrawer(dish);
    assert.equal(page.productReviewVisible, true);
    assert.equal(page.productReviewId, 9);
    assert.equal(page.productReviewName, '鸡肉饭');
    page.openProductReviewDrawer({ ...dish, productId: 12, productName: '麻辣香锅' });
    assert.equal(page.productReviewId, 12);
    assert.equal(page.productReviewName, '麻辣香锅');
    assert.equal(commentCalls.length, 0, 'menu must not fetch dish comments itself');
    page.closeProductReviewDrawer();
    await new Promise(resolve => setTimeout(resolve, 260));
    assert.equal(page.productReviewVisible, false);
    console.log('PASS: compact card opens a drawer that reuses the existing review list.');
})().catch(error => { console.error(error); process.exitCode = 1; });
