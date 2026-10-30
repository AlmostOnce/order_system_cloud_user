const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..'), cache = new Map(), storage = new Map(), calls = [];
let mode = 'success', listMode = 'success', chooseMode = 'success';
let savedWindow = null, savedProducts = [], statusFailure = false, failProduct = false;
const user = { userUuid: '12345678-1234-4234-8234-123456789abc', roleCode: 'CUSTOMER' };
const comment = { commentId: 'a1111111-1111-4111-8111-111111111111', productId: 5, windowId: 2, authorName: '同学', score: 5, content: '分量很足', images: [], tags: ['分量足'], createdAt: '2026-10-28T12:00:00' };
const result = data => ({ ok: true, data: { code: 'COMMON_000', data }, message: '', statusCode: 200 });
const http = {
 httpUploadImage(file,bizType,bizRef) { calls.push({file,bizType,bizRef}); return Promise.resolve(result({fileKey:'0123456789abcdef0123456789abcdef'})); },
 httpGet(url) { calls.push({url}); if(url.includes('/ratings/batch')) return Promise.resolve(listMode==='error'?{ok:false,data:null,message:'服务暂不可用',statusCode:503}:result([{id:5,reviewCount:2,averageScore:4.5}])); if(url.startsWith('/comments/orders/')) return Promise.resolve(statusFailure ? {ok:false,data:null,message:'状态查询失败',statusCode:503} : result({orderId:7,windowReview:savedWindow,productReviews:savedProducts})); if(url.startsWith('/orders/')) return Promise.resolve(result({orderId:7,orderNo:'O7',windowId:2,totalAmount:12,status:'已完成',remark:'',pickupCode:'',createdAt:'',items:[{productId:5,productName:'番茄鸡蛋',quantity:1,unitPrice:12,lineAmount:12}]})); if(url.endsWith('/rating')) return Promise.resolve(result({productId:5,reviewCount:0,averageScore:null})); if(listMode==='error') return Promise.resolve({ok:false,data:null,message:'服务暂不可用',statusCode:503}); if(url.includes('cursor=')) return Promise.resolve(result({items:[comment,{...comment,commentId:'b1111111-1111-4111-8111-111111111111'}],nextCursor:null,hasMore:false})); return Promise.resolve(result({items:[comment],nextCursor:comment.commentId,hasMore:listMode==='pages'})); },
 httpPost(url,body,auth,key) { calls.push({url,body:JSON.parse(JSON.stringify(body)),auth,key}); return Promise.resolve(mode==='success' && !(failProduct && url==='/comments')?result(url.includes('window-reviews')?{...comment,score:body.score,content:body.content,reviewId:comment.commentId,windowId:2}:{...comment,score:body.score,content:body.content}):{ok:false,data:null,message:'网络连接失败',statusCode:0}); }
};
global.uni = { getStorageSync:k=>storage.get(k)??'',setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),chooseImage:o=>chooseMode==='cancel'?o.fail({errMsg:'chooseImage:fail cancel'}):o.success({tempFilePaths:['blob:photo'],tempFiles:[{size:1024}]}),previewImage:()=>{},getWindowInfo:()=>({statusBarHeight:0}),navigateTo:()=>{},reLaunch:()=>{},switchTab:()=>{} };
function load(file) {
 file=path.resolve(root,file);
 if(file.endsWith(path.normalize('common/http.uts'))) return http;
 if(file.endsWith(path.normalize('store/auth.uts'))) return {currentUser:()=>user,isLoggedIn:()=>true};
 if(file.endsWith(path.normalize('common/refresh.uts'))) return {refreshTimeLabel:()=>'',finishPullRefresh:(_a,_b,fn)=>fn('')};
 if(cache.has(file)) return cache.get(file);
 const source=fs.readFileSync(file,'utf8');
 if(file.endsWith('.uvue')) { const value=require('./setup-harness.cjs').loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>load(path.resolve(path.dirname(file),p)));cache.set(file,value);return value; }
 if(file.endsWith('common/config.uts')) return { API_BASE_URL:'http://localhost:9090/api' };
 assert.equal(ts.createSourceFile(file+'.ts',source,ts.ScriptTarget.Latest,true).parseDiagnostics.length,0,file);
 const mod={exports:{}};cache.set(file,mod.exports);
 new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(p=>load(path.resolve(path.dirname(file),p)),mod,mod.exports);
 return mod.exports;
}
(async()=>{
 const api=load('api/comments.uts');
 assert.equal(api.parseComment(comment).score,5);
 assert.equal(api.parseComment({...comment,score:6}),null);
 assert.equal(api.parseComment({...comment,images:[null]}),null);
 assert.equal(api.parseCommentPage({items:[comment],hasMore:true,nextCursor:null}),null);
 assert.equal(api.parseRating({productId:5,reviewCount:0,averageScore:null}).averageScore,null);
 let ratings=await api.fetchCardRatings('products',[5,6]);assert.equal(api.cardRatingText(ratings,5),'★ 4.5 · 2条评价');assert.equal(api.cardRatingText(ratings,6),'暂无评分');
 listMode='error';ratings=await api.fetchCardRatings('products',[5]);assert.equal(api.cardRatingText(ratings,5),'评分暂不可用');listMode='success';
 const pending=load('common/comments.uts');
 assert.match(pending.newCommentKey(),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.notEqual(pending.commentPendingKey(user.userUuid,7,5),pending.commentPendingKey('another',7,5));
 assert.equal(api.parseComment({...comment,authorAvatarUrl:'/api/files/avatar/content'}).authorAvatarUrl,'/api/files/avatar/content');
 assert.equal(api.parseComment(comment).authorAvatarUrl,'');
 const vm=load('pages/review/create.uvue').create();
 vm.$hooks.onLoad({orderId:'7'}); vm.$hooks.onPageShow();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.sections.length,2,'all purchased dishes appear beside shop section');
 assert.equal(vm.sections[0].selected,true);assert.equal(vm.sections[1].selected,false,'dish review is optional');
 vm.sections[0].score=5;vm.sections[0].content='店铺服务好';vm.toggleSection(1);vm.sections[1].score=3;vm.sections[1].content='菜品有待改进';
 await vm.addPhoto(1);assert.equal(vm.sections[1].photos.length,1);assert.equal(vm.sections[0].photos.length,0,'photos stay with the rated target');
 mode='network';await vm.submit();assert.equal(vm.sections[0].pending,true);const first=calls.find(c=>c.body);
 const restored=load('pages/review/create.uvue').create();restored.$hooks.onLoad({orderId:'7'});restored.$hooks.onPageShow();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(restored.sections[0].content,'店铺服务好');restored.setScore(0,1);assert.equal(restored.sections[0].score,5,'uncertain submissions cannot change payload');
 mode='success';await restored.submit();let sent=calls.filter(c=>c.body);assert.equal(sent[1].key,first.key);assert.deepEqual(sent[1].body,first.body);assert.ok(restored.sections[0].saved);assert.ok(restored.sections[1].saved);assert.equal(restored.sections[1].saved.score,3);assert.equal(sent[2].body.score,3,'shop and dish ratings submitted independently');assert.equal(sent[2].body.content,'菜品有待改进');
 const count=calls.filter(c=>c.body).length;await restored.submit();assert.equal(calls.filter(c=>c.body).length,count,'submitted section never submits twice');
 // Persisted server state, rather than local success alone, locks already reviewed targets after reopening.
 savedWindow={...comment,reviewId:comment.commentId,productId:0};savedProducts=[comment];
 const reopened=load('pages/review/create.uvue').create();reopened.$hooks.onLoad({orderId:'7'});reopened.$hooks.onPageShow();await new Promise(resolve=>setImmediate(resolve));
 assert.ok(reopened.sections[0].saved);assert.ok(reopened.sections[1].saved);assert.equal(reopened.sections[1].saved.score,5);
 reopened.toggleSection(1);assert.equal(reopened.sections[1].selected,false);await reopened.submit();assert.equal(calls.filter(c=>c.body).length,count);
 statusFailure=true;const unavailable=load('pages/review/create.uvue').create();unavailable.$hooks.onLoad({orderId:'7'});unavailable.$hooks.onPageShow();await new Promise(resolve=>setImmediate(resolve));assert.equal(unavailable.ready,false);await unavailable.submit();assert.equal(calls.filter(c=>c.body).length,count,'unknown review state blocks submission');statusFailure=false;
 savedWindow=null;savedProducts=[];
 const partial=load('pages/review/create.uvue').create();partial.$hooks.onLoad({orderId:'7'});partial.$hooks.onPageShow();await new Promise(resolve=>setImmediate(resolve));
 partial.sections[0].score=4;partial.sections[0].content='店铺很好';partial.toggleSection(1);partial.sections[1].score=2;partial.sections[1].content='菜品偏咸';
 failProduct=true;await partial.submit();assert.ok(partial.sections[0].saved);assert.equal(partial.sections[1].pending,true);
 const shopsBefore=calls.filter(c=>c.body&&c.url.includes('window-reviews')).length;
 failProduct=false;await partial.submit();assert.ok(partial.sections[1].saved);assert.equal(calls.filter(c=>c.body&&c.url.includes('window-reviews')).length,shopsBefore,'partial retry skips already published shop review');
 const ratingOnly=load('pages/review/create.uvue').create();ratingOnly.$hooks.onLoad({orderId:'7'});ratingOnly.$hooks.onPageShow();await new Promise(resolve=>setImmediate(resolve));
 ratingOnly.sections[0].score=5;ratingOnly.toggleSection(1);ratingOnly.sections[1].score=4;
 mode='network';await ratingOnly.submit();assert.equal(ratingOnly.sections[0].pending,true,'empty text draft supports uncertain retries');
 mode='success';await ratingOnly.submit();assert.ok(ratingOnly.sections[0].saved);assert.ok(ratingOnly.sections[1].saved);
 const ratingsOnly=calls.filter(c=>c.body).slice(-2);for(const call of ratingsOnly){assert.equal(call.body.content,'');assert.deepEqual(call.body.imageFileKeys,[]);assert.deepEqual(call.body.tags,[]);}
 assert.equal(api.parseOrderReviews({orderId:7,windowReview:null,productReviews:[comment,comment]}),null,'duplicate product states rejected');
 const list=load('pages/review/list.uvue').create();list.showWindowReviews=false;listMode='pages';await list.loadReviews(true);assert.equal(list.hasMore,true);await list.loadReviews(false);assert.equal(list.reviews.length,2,'overlapping pages are deduplicated');assert.equal(list.hasMore,false);listMode='error';await list.loadReviews(true);assert.equal(list.reviews.length,2,'failed refresh preserves previous reviews');assert.equal(list.errorText,'服务暂不可用');
 listMode='success';list.productId=5;await list.loadRating();assert.equal(list.averageScore,null);assert.equal(list.reviewCount,0);
 console.log('Comment checks passed: independent shop/dish payloads and photos, all-draft recovery, idempotent retry, reopened review lock, unavailable-state guard, avatar parsing and pagination.');
})().catch(e=>{console.error(e);process.exitCode=1});
