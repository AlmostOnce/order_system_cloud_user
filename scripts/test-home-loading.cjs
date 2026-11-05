const fs=require('node:fs'),assert=require('node:assert/strict');
const {loadSetup}=require('./setup-harness.cjs');
let owner='student-a',requests=0,fail=false;
global.uni={getWindowInfo:()=>({statusBarHeight:24}),reLaunch(){}};
const source=fs.readFileSync('pages/home/home.uvue','utf8');
const create=()=>loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],p=>{
 if(p.includes('store/notifications'))return{startNotificationSession(){}};
 if(p.includes('store/auth'))return{isLoggedIn:()=>true,currentUser:()=>({userUuid:owner,roleCode:'CUSTOMER'})};
 if(p.includes('api/product'))return{
  listActiveRestaurants:async()=>{requests++;return{ok:!fail,message:'offline',items:[{restaurantId:1,restaurantName:'一食堂'}]}},
  listActiveWindows:async()=>{requests++;return{ok:true,items:[{windowId:1,restaurantId:1,windowName:'窗口'}]}}
 };
 if(p.includes('api/comments'))return{fetchCardRatings:async()=>[]};
 return{};
}).create();
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const vm=create();vm.$hooks.onPageShow();vm.$hooks.onPageShow();await tick();assert.equal(requests,2,'first visit loads once, including while pending');
 vm.selectRestaurant(1,'一食堂');const windows=vm.windows;
 vm.$hooks.onPageShow();await tick();assert.equal(requests,2,'returning home does not fetch');assert.equal(vm.windows,windows);assert.equal(vm.selectedRestaurantId,1,'selection survives return');
 await vm.loadCatalog();assert.equal(requests,4,'manual refresh remains available');
 owner='student-b';vm.$hooks.onPageShow();await tick();assert.equal(requests,6,'new account initializes separately');assert.equal(vm.selectedRestaurantId,0);
 fail=true;const failed=create();failed.$hooks.onPageShow();await tick();const previous=requests;failed.$hooks.onPageShow();await tick();assert.equal(requests,previous,'failed first load waits for explicit refresh');
 fail=false;await failed.loadCatalog();assert.equal(failed.loadError,'');assert.equal(failed.windows.length,1);
 console.log('Home loading passed: first load, duplicate guard, return without fetch, selection retained, explicit refresh, account switch and failed-load retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
