// Migration gate: compile real setup/template syntax and reject unsupported native selectors.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base='D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/';
const sfc=require(base+'@vue/compiler-sfc'),postcss=require(base+'postcss'),selector=require(base+'postcss-selector-parser');
const root=path.resolve(__dirname,'..');
const all=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?all(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=[path.join(root,'App.uvue'),...all(path.join(root,'pages')),...all(path.join(root,'components'))].filter(p=>p.endsWith('.uvue'));
const native=css=>css.replace(/\/\*\s*#ifdef WEB\s*\*\/[\s\S]*?\/\*\s*#endif\s*\*\//g,'');
function checkCss(css,file){
 postcss.parse(native(css)).walkRules(rule=>{
  if(rule.parent.type==='atrule'&&rule.parent.name.includes('keyframes'))return;
  selector(ast=>ast.each(sel=>assert.ok(sel.nodes.length===1&&sel.first.type==='class',file+': unsupported native selector '+sel.toString()))).processSync(rule.selector);
 });
}
for(const file of files){
 const source=fs.readFileSync(file,'utf8');assert.ok(source.includes('<script setup'),file);
 assert.ok(!/from\s*['"]@dcloudio\/uni-app['"]/.test(source),file+': use uni-app x lifecycle auto imports');
 if(file!==path.join(root,'App.uvue'))assert.ok(!/\bon(?:Show|Hide)\s*\(/.test(source),file+': use onPageShow/onPageHide for page visibility');
 assert.ok(!/\binitialState\s*=\s*\(\s*\(/.test(source),file+': temporary state initialization wrapper');
 assert.ok(!/@ts-(ignore|nocheck)|\bas any\b/.test(source),file+': type checking bypass');
 const template=source.match(/<template>([\s\S]*?)<\/template>/)?.[1]??'';
 assert.ok(!/\.indexOf\(' [^']+ '\)/.test(template),file+': bind classes directly to state conditions');
 assert.ok(!/export default\s*\{|\bthis\./.test(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]),file+': old component options remain');
 const input=source.replace('lang="uts"','lang="ts"');
 const{descriptor,errors}=sfc.parse(input,{filename:file});assert.deepEqual(errors,[]);
 const compiled=sfc.compileScript(descriptor,{id:'vapor-check',fs:{fileExists:fs.existsSync,readFile:f=>fs.readFileSync(f,'utf8')}});
 if(descriptor.template){const result=sfc.compileTemplate({id:'vapor-check',filename:file,source:descriptor.template.content,compilerOptions:{bindingMetadata:compiled.bindings,expressionPlugins:['typescript']}});assert.deepEqual(result.errors,[],file);}
 for(const style of descriptor.styles)checkCss(style.content,file);
}
for(const file of all(path.join(root,'styles')).filter(f=>f.endsWith('.css')))checkCss(fs.readFileSync(file,'utf8'),file);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8').replace(/\/\*[\s\S]*?\*\//g,''));
assert.equal(manifest['uni-app-x'].vapor,true);assert.equal(manifest['uni-app-x'].styleIsolationVersion,'2');
console.log(`Vapor migration gate passed: ${files.length} setup scripts, Vue SFC/template compilation, native single-class selectors, Vapor and isolation 2.0 configuration.`);
