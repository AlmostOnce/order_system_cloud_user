const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..'), cache = new Map(), storage = new Map();
let responseToken = '';
global.uni = { getStorageSync: k => storage.get(k) ?? '', setStorageSync: (k,v) => storage.set(k,v), removeStorageSync: k => storage.delete(k) };
function load(file) {
 file = path.resolve(root, file);
 if (file.endsWith(path.normalize('api/auth.uts'))) return { login: async () => ({ok:true,data:{data:{accessToken:responseToken,refreshToken:'refresh'}}}) };
 if (cache.has(file)) return cache.get(file);
 const mod={exports:{}}; cache.set(file,mod.exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function('require','module','exports',code)(p=>load(path.resolve(path.dirname(file),p)),mod,mod.exports);
 return mod.exports;
}
const auth=load('store/auth.uts');
const token=sub=>'header.'+Buffer.from(JSON.stringify({sub,exp:1900000000})).toString('base64url')+'.sig';
(async()=>{
 for(const invalid of [token('7'),'broken']) {
  storage.set('auth_access_token',invalid); storage.set('auth_refresh_token','old-refresh'); storage.set('auth_remembered_username','remember-me');
  assert.equal(auth.isLoggedIn(),false,'login must not send an unreadable session back to home');
  assert.equal(auth.currentUser(),null);
  assert.equal(storage.has('auth_access_token'),false);
  assert.equal(storage.has('auth_refresh_token'),false);
  assert.equal(storage.get('auth_remembered_username'),'remember-me');
  assert.equal(auth.isLoggedIn(),false,'re-entering login must stay on login');
 }
 const uuid='12345678-1234-4234-8234-123456789abc';
 storage.set('auth_access_token',token(uuid));
 assert.equal(auth.isLoggedIn(),true); assert.equal(auth.currentUser().userUuid,uuid);
 storage.clear(); responseToken=token('7');
 assert.notEqual(await auth.login('u','p','c','v',false),'','incompatible login response must not enter home');
 assert.equal(storage.has('auth_access_token'),false);
 responseToken=token(uuid);
 assert.equal(await auth.login('u','p','c','v',false),''); assert.equal(auth.isLoggedIn(),true);
 console.log('Session navigation checks passed: legacy/malformed session cleared, login remains stable, incompatible login rejected, UUID login accepted.');
})().catch(e=>{console.error(e);process.exitCode=1});
