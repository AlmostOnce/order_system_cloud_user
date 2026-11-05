const fs=require('node:fs'),assert=require('node:assert/strict');
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
let download=null,saves=[],messages=[],saveFails=false;
global.uni={
 downloadFile:options=>{download=options},
 saveImageToPhotosAlbum:options=>{saves.push(options.filePath);saveFails?options.fail({}):options.success({})}
};
const source=fs.readFileSync('common/save-image.uts','utf8').replace(/\/\/ #ifdef WEB[\s\S]*?\/\/ #endif/g,'');
const mod={exports:{}};
new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(()=>({toast:s=>messages.push(s),toastSuccess:s=>messages.push(s)}),mod,mod.exports);
(async()=>{
 const save=mod.exports.saveImageToAlbum;
 await save('/static/images/defaults/avatar.png');assert.deepEqual(saves,['/static/images/defaults/avatar.png']);
 let pending=save('https://example.com/avatar.jpg');assert.equal(download.url,'https://example.com/avatar.jpg');
 await save('https://example.com/duplicate.jpg');assert.equal(download.url,'https://example.com/avatar.jpg','duplicate save blocked');
 download.success({statusCode:200,tempFilePath:'/tmp/avatar.jpg'});await pending;assert.equal(saves.at(-1),'/tmp/avatar.jpg');assert.equal(messages.at(-1),'已保存到相册');
 for(const fail of [options=>options.success({statusCode:404,tempFilePath:'/tmp/error.html'}),options=>options.fail({})]){
  const count=saves.length;pending=save('https://example.com/avatar.jpg');fail(download);await pending;assert.equal(saves.length,count,'failed downloads never reach album');
 }
 saveFails=true;await save('/static/images/defaults/avatar.png');assert.match(messages.at(-1),/保存失败/);
 saveFails=false;await save('/static/images/defaults/avatar.png');assert.equal(messages.at(-1),'已保存到相册','failed save releases duplicate guard');
 console.log('Image saving passed: local/network paths, download status validation, duplicate guard, permission failure and retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
