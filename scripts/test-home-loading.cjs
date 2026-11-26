const fs=require('node:fs'),assert=require('node:assert/strict');
const {loadSetup}=require('./setup-harness.cjs');
let owner='student-a',requests=0,fail=false,windowFail=false,announcement=null;
const storage={};
global.uni={getWindowInfo:()=>({statusBarHeight:24}),reLaunch(){},
 getStorageSync:(key)=>storage[key],setStorageSync:(key,value)=>{storage[key]=value},removeStorageSync:(key)=>{delete storage[key]},
 makePhoneCall(){}};
const source=fs.readFileSync('pages/home/home.uvue','utf8');
const create=()=>loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('store/notifications'))return{startNotificationSession(){}};
 if(p.includes('store/auth'))return{isLoggedIn:()=>true,currentUser:()=>({userUuid:owner,roleCode:'CUSTOMER'})};
 // 推荐与月售已拆分到独立接口：补齐桩，避免首页初始化时因缺函数中断。
 if(p.includes('common/storage'))return{getSessionVersion:()=>1};
 if(p.includes('api/recommendations'))return{fetchHomeRecommendations:async()=>({ok:true,message:'',data:{recommendationId:'test',algorithmVersion:'v1',mode:'FALLBACK',generatedAt:'',items:[]}})};
 if(p.includes('api/statistics'))return{fetchMonthlyWindowSales:async()=>({ok:true,items:[]})};
 if(p.includes('api/product'))return{
  listActiveRestaurants:async()=>{requests++;return{ok:!fail,message:'offline',items:[{restaurantId:1,restaurantName:'一食堂'}]}},
  listActiveWindows:async()=>{requests++;return{ok:!windowFail,message:'windows offline',items:[{windowId:1,restaurantId:1,windowName:'窗口',isOpen:1}]}},
  fetchHomeAnnouncement:async()=>({ok:true,message:'',data:announcement})
 };
 if(p.includes('api/comments'))return{fetchCardRatings:async()=>[]};
 return{};
}).create();
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const vm=create();vm.$hooks.onPageShow();vm.$hooks.onPageShow();await tick();assert.equal(requests,2,'first visit loads once, including while pending');
 // 首次就绪及每次返回都重播右上角图形，离页后不允许迟到定时器重新点亮。
 vm.$hooks.onReady();await new Promise(r=>setTimeout(r,90));assert.equal(vm.heroShapesEntered,true);
 vm.$hooks.onPageHide();assert.equal(vm.heroShapesEntered,false);
 vm.$hooks.onPageShow();assert.equal(vm.heroShapesEntered,false);
 await new Promise(r=>setTimeout(r,90));assert.equal(vm.heroShapesEntered,true);
 vm.$hooks.onPageHide();vm.$hooks.onPageShow();vm.$hooks.onPageHide();
 await new Promise(r=>setTimeout(r,90));assert.equal(vm.heroShapesEntered,false,'hidden page cannot resume its animation');
 vm.selectRestaurant(1,'一食堂');const windows=vm.windows;
 vm.$hooks.onPageShow();await tick();
 // 公告是独立加载链：有公告时展示，无公告时整块隐藏，不阻塞目录。
 announcement={announcementId:9,title:'午餐通知',content:'二楼暂停营业',publishedAt:'2026-11-26T10:00:00'};
 vm.loadAnnouncement();await tick();assert.equal(vm.announcementVisible,true);assert.equal(vm.announcementTitle,'午餐通知');
 vm.openAnnouncement();await new Promise(r=>setTimeout(r,40));assert.equal(vm.announcementSheetVisible,true);
 vm.closeAnnouncement();await new Promise(r=>setTimeout(r,260));assert.equal(vm.announcementSheetVisible,false);
 announcement=null;vm.loadAnnouncement();await tick();assert.equal(vm.announcementVisible,false,'No active announcement hides the bar.');
 vm.$hooks.onPageShow();await tick();assert.equal(requests,2,'returning home does not fetch');assert.equal(vm.windows,windows);assert.equal(vm.selectedRestaurantId,1,'selection survives return');
 await vm.loadCatalog();assert.equal(requests,4,'manual refresh remains available');
 owner='student-b';vm.$hooks.onPageShow();await tick();assert.equal(requests,6,'new account initializes separately');assert.equal(vm.selectedRestaurantId,0);
 fail=true;const failed=create();failed.$hooks.onPageShow();await tick();const previous=requests;
 // 餐厅失败只影响筛选面板，档口照常展示且不写入档口错误。
 assert.equal(failed.windows.length,1,'Restaurant failure must not block windows.');
 assert.equal(failed.loadError,'','Restaurant failure must not set the window error.');
 failed.$hooks.onPageShow();await tick();assert.equal(requests,previous,'failed first load waits for explicit refresh');
 fail=false;await failed.loadCatalog();assert.equal(failed.loadError,'');assert.equal(failed.windows.length,1);assert.equal(failed.restaurants.length,1);
 // 档口失败只影响档口区，餐厅仍可正常加载。
 windowFail=true;const windowFailed=create();windowFailed.$hooks.onPageShow();await tick();
 assert.ok(windowFailed.loadError.length>0,'Window failure shows the window error.');
 assert.equal(windowFailed.restaurants.length,1,'Window failure must not block restaurants.');
 windowFail=false;
 console.log('Home loading passed: first load, duplicate guard, return without fetch, selection retained, explicit refresh, account switch and failed-load retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
