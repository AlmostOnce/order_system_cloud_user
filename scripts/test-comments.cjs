const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..'), cache = new Map(), storage = new Map(), calls = [];
let mode = 'success', listMode = 'success', chooseMode = 'success';
const user = { userUuid: '12345678-1234-4234-8234-123456789abc', roleCode: 'CUSTOMER' };
const comment = { commentId: 'a1111111-1111-4111-8111-111111111111', productId: 5, windowId: 2, authorName: '同学', score: 5, content: '分量很足', images: [], tags: ['分量足'], createdAt: '2026-10-28T12:00:00' };
const result = data => ({ ok: true, data: { code: 'COMMON_000', data }, message: '', statusCode: 200 });
const http = {
 httpUploadImage(file,bizType,bizRef) { calls.push({file,bizType,bizRef}); return Promise.resolve(result({fileKey:'0123456789abcdef0123456789abcdef'})); },
 httpGet(url) { calls.push({url}); if(url.includes('/ratings/batch')) return Promise.resolve(listMode==='error'?{ok:false,data:null,message:'服务暂不可用',statusCode:503}:result([{id:5,reviewCount:2,averageScore:4.5}])); if(url.startsWith('/orders/')) return Promise.resolve(result({orderId:7,orderNo:'O7',windowId:2,totalAmount:12,status:'已完成',remark:'',pickupCode:'',createdAt:'',items:[{productId:5,productName:'番茄鸡蛋',quantity:1,unitPrice:12,lineAmount:12}]})); if(url.endsWith('/rating')) return Promise.resolve(result({productId:5,reviewCount:0,averageScore:null})); if(listMode==='error') return Promise.resolve({ok:false,data:null,message:'服务暂不可用',statusCode:503}); if(url.includes('cursor=')) return Promise.resolve(result({items:[comment,{...comment,commentId:'b1111111-1111-4111-8111-111111111111'}],nextCursor:null,hasMore:false})); return Promise.resolve(result({items:[comment],nextCursor:comment.commentId,hasMore:listMode==='pages'})); },
 httpPost(url,body,auth,key) { calls.push({url,body:JSON.parse(JSON.stringify(body)),auth,key}); return Promise.resolve(mode==='success'?result(url.includes('window-reviews')?{reviewId:comment.commentId,windowId:2}:comment):{ok:false,data:null,message:'网络连接失败',statusCode:0}); }
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
 const vm=load('pages/review/create.uvue').create();
 vm.$hooks.onLoad({orderId:'7',productId:'5'}); vm.$hooks.onPageShow();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.productName,'番茄鸡蛋');assert.equal(vm.eligible,true);
 await vm.addPhoto();assert.equal(vm.photos.length,1);assert.equal(calls.find(c=>c.file).bizType,'COMMENT_IMAGE');assert.equal(calls.find(c=>c.file).bizRef,0);chooseMode='cancel';await vm.addPhoto();assert.equal(vm.photos.length,1,'cancel does not add image');
 vm.content='分量很足';vm.score=5;mode='network';await vm.submit();
 assert.equal(vm.pending,true);const first=calls.find(c=>c.body);
 const restored=load('pages/review/create.uvue').create();
 restored.$hooks.onLoad({orderId:'7',productId:'5'});restored.$hooks.onPageShow();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(restored.pending,true);assert.equal(restored.content,'分量很足');assert.equal(restored.photos.length,1);restored.setScore(1);assert.equal(restored.score,5,'pending request cannot change rating');
 mode='success';await restored.submit();const sent=calls.filter(c=>c.body);
 assert.equal(sent[1].key,first.key);assert.deepEqual(sent[1].body,first.body);
 assert.equal(restored.succeeded,true);assert.equal(storage.size,0);
 await restored.submit();assert.equal(calls.filter(c=>c.body).length,2,'success cannot submit again');
 const windowReview=load('pages/review/create.uvue').create();windowReview.$hooks.onLoad({orderId:'7'});windowReview.$hooks.onPageShow();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(windowReview.eligible,true);windowReview.score=5;windowReview.content='出餐很快';await windowReview.submit();
 assert.equal(windowReview.succeeded,true);const windowRequest=calls.filter(c=>c.body).at(-1);assert.equal(windowRequest.url,'/comments/window-reviews');assert.equal(windowRequest.body.orderId,7);assert.equal('productId' in windowRequest.body,false);
 assert.equal(api.parseWindowReviewPage({items:[{...comment,reviewId:comment.commentId}],nextCursor:null,hasMore:false}).items[0].productId,0);
 const denied=load('pages/review/create.uvue').create();denied.orderId=7;denied.productId=99;await denied.loadOrder();assert.equal(denied.eligible,false);
 const list=load('pages/review/list.uvue').create();list.showWindowReviews=false;listMode='pages';await list.loadReviews(true);assert.equal(list.hasMore,true);await list.loadReviews(false);assert.equal(list.reviews.length,2,'overlapping pages are deduplicated');assert.equal(list.hasMore,false);listMode='error';await list.loadReviews(true);assert.equal(list.reviews.length,2,'failed refresh preserves previous reviews');assert.equal(list.errorText,'服务暂不可用');
 listMode='success';list.productId=5;await list.loadRating();assert.equal(list.averageScore,null);assert.equal(list.reviewCount,0);
 console.log('Comment checks passed: response validation, UUID request keys, user isolation, purchase guard, uncertain-result recovery, identical retries success lock, photo upload/cancel, pagination deduplication and failed-refresh preservation.');
})().catch(e=>{console.error(e);process.exitCode=1});
