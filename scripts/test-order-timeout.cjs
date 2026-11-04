const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {loadSetup}=require('./setup-harness.cjs');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'pages/order/detail.uvue'),'utf8');
const factory=loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],()=>({}));
const vm=factory.create();const original=Date.now;Date.now=()=>1000000;
try {
 vm.startPaymentClock({status:'待支付',paymentExpiresAt:1900000,serverTime:1000000});
 assert.equal(vm.paymentExpired,false);assert.equal(vm.remainingPaymentText,'15:00');
 vm.startPaymentClock({status:'待支付',paymentExpiresAt:1000000,serverTime:1000000});
 assert.equal(vm.paymentExpired,true);assert.equal(vm.remainingPaymentText,'00:00');
 vm.startPaymentClock({status:'待支付',paymentExpiresAt:0,serverTime:0});assert.equal(vm.paymentExpired,true,'missing server deadline must not enable payment');
 vm.startPaymentClock({status:'已支付',paymentExpiresAt:1000000,serverTime:1000000});assert.equal(vm.paymentExpired,false);
} finally {Date.now=original;vm.stopPaymentClock();}
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const mod={exports:{}};
const json={jsonNumber:(r,k)=>typeof r[k]==='number'?r[k]:null,jsonString:(r,k)=>typeof r[k]==='string'?r[k]:null,jsonArray:(r,k)=>Array.isArray(r[k])?r[k]:null};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'api/order.uts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(p=>p.includes('json')?json:{},mod,mod.exports);
const parsed=mod.exports.parseOrder({orderId:1,windowId:2,totalAmount:10,status:'待支付',paymentExpiresAt:1900000,serverTime:1000000});
assert.equal(parsed.paymentExpiresAt,1900000);assert.equal(parsed.serverTime,1000000);
console.log('Order timeout UI passed: server-based countdown, expiry and missing-deadline guards, terminal state, API timestamp parsing.');
