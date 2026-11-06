// 执行真实列表逻辑，控制网络响应先后顺序，覆盖切筛选后的分页与迟到响应。
const fs = require('fs'), assert = require('assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const source = fs.readFileSync('components/review-list/review-list.uvue', 'utf8');
const pageSource = fs.readFileSync('pages/review/list.uvue', 'utf8');
const waiting = [], calls = [];
const vm = loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], name => {
    if (name.includes('api/comments')) return {
        fetchComments: (id, cursor, score, hasImages) => { calls.push({ id, cursor, score, hasImages }); return new Promise(resolve => waiting.push(resolve)); },
        commentPayload: result => result.data,
        parseCommentPage: raw => raw,
    };
    if (name.includes('store/auth')) return { currentUser: () => ({ userUuid: 'student-a' }) };
    return {};
}).create();
const row = (id, score) => ({ commentId: id, productId: 7, windowId: 2, score });
const result = (items, nextCursor = '', hasMore = false) => ({ ok: true, data: { items, nextCursor, hasMore } });
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
    vm.productId = 7;
    assert.equal(vm.scoreFilter, 0, '默认查看全部');
    assert.ok(source.includes('const scoreTabs: Array<number> = [0, 5, 1]'));
    assert.ok(!source.includes('好评 · 五星') && !source.includes('差评 · 一星')); 
    const old = vm.loadReviews(true);
    vm.selectScore(5);
    assert.deepEqual(calls.at(-1), { id: 7, cursor: '', score: 5, hasImages: false });
    waiting[1](result([row('new', 5)], 'new', true)); await tick();
    waiting[0](result([row('old', 1)])); await old;
    assert.equal(vm.reviews[0].commentId, 'new', '旧全部请求不能覆盖五星列表');
    const more = vm.loadReviews(false);
    assert.deepEqual(calls.at(-1), { id: 7, cursor: 'new', score: 5, hasImages: false });
    vm.selectScore(1);
    waiting[3](result([row('bad', 1)])); await tick();
    waiting[2](result([row('late', 5)])); await more;
    assert.deepEqual(vm.reviews.map(item => item.commentId), ['bad'], '旧筛选下一页不能混入新筛选');
    assert.equal(vm.nextCursor, '');
    const before = calls.length; vm.selectScore(3); vm.selectScore(1);
    assert.equal(calls.length, before, '不接受中评分数及重复点击');
    vm.selectScore(0); waiting[4](result([row('middle', 3)])); await tick();
    assert.equal(vm.reviews[0].score,3,'全部包含中间评分');
    vm.selectScore(5); waiting[5](result([row('wrong', 1)])); await tick();
    assert.equal(vm.reviews.length, 0, '后端忽略筛选参数时不能把一星显示成好评');
    assert.ok(vm.errorText.length > 0);
    vm.selectPhotos();
    assert.deepEqual(calls.at(-1),{id:7,cursor:'',score:0,hasImages:true});
    waiting[6](result([{...row('photo-middle',3),images:['photo']}],'photo-middle',true));await tick();
    assert.equal(vm.reviews[0].score,3,'有图包含所有评分');
    const photosMore=vm.loadReviews(false);
    assert.equal(calls.at(-1).hasImages,true);assert.equal(calls.at(-1).cursor,'photo-middle');
    vm.selectScore(5);waiting[8](result([row('positive',5)]));await tick();
    waiting[7](result([{...row('late-photo',3),images:['photo']} ]));await photosMore;
    assert.equal(vm.photoOnly,false);assert.equal(vm.reviews[0].commentId,'positive');
    assert.ok(!source.includes('review-distribution') && !source.includes('summaryWidth'), '概览不再绘制好评/差评条形统计');
    assert.equal(typeof vm.summaryWidth, 'undefined');
    assert.ok(pageSource.includes('review-list') && pageSource.includes('embedProductId'), '独立评价页复用同一套列表，不再另写界面');
    vm.$hooks.onUnload();
    console.log('PASS: one/five filters, cursor reset, stale response isolation, all/positive/negative labels and mismatched payload guard.');
})().catch(error => { console.error(error); process.exitCode = 1; });
