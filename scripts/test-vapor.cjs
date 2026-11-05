// Migration gate: compile real setup/template syntax and reject unsupported native selectors.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base='D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/';
const sfc=require(base+'@vue/compiler-sfc'),postcss=require(base+'postcss'),selector=require(base+'postcss-selector-parser');
const {parse:parseTemplate}=require(base+'@vue/compiler-dom');
const root=path.resolve(__dirname,'..');
const all=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?all(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=[path.join(root,'App.uvue'),...all(path.join(root,'pages')),...all(path.join(root,'components'))].filter(p=>p.endsWith('.uvue'));
const native=css=>css.replace(/\/\*\s*#ifdef WEB\s*\*\/[\s\S]*?\/\*\s*#endif\s*\*\//g,'');
function checkCss(css,file){
 postcss.parse(native(css)).walkDecls(decl=>{
  assert.ok(!['gap','row-gap','column-gap','overflow-wrap','lines'].includes(decl.prop),file+': unsupported native CSS '+decl.prop);
  if(decl.prop==='align-items')assert.ok(['center','flex-start','flex-end','stretch'].includes(decl.value),file+': unsupported native alignment '+decl.value);
  if(decl.prop==='max-width'||decl.prop==='max-height')assert.ok(/^\d+(?:\.\d+)?(?:px)?$/.test(decl.value),file+': native maximum size must be numeric pixels');
 });
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
 const checkNativeNode=node=>{
  if(node.type===1){
   if(node.tag!=='text'&&node.tag!=='button')assert.ok(!node.children.some(child=>child.type===2&&(!/^\s*$/.test(child.content)||(!child.loc.source.includes('\n')&&child.content.length>0))||child.type===5),file+': native text must be inside text/button');
   if(node.tag==='scroll-view'){
    const elements=node.children.filter(child=>child.type===1);
    const refresher=elements.find(child=>child.props.some(prop=>prop.type===6&&prop.name==='slot'&&prop.value?.content==='refresher'));
    if(refresher){assert.equal(refresher.tag,'view',file+': native refresher needs an explicit element');assert.equal(elements.at(-1),refresher,file+': refresher cannot precede scroll content');}
   }
   if(node.tag==='button'){
    assert.ok(!node.children.some(child=>child.type===1),file+': native button cannot contain child elements');
    const classes=node.props.find(prop=>prop.type===6&&prop.name==='class')?.value?.content??'';
    assert.match(classes,/button-text button-text-(34|40|42|44|46|48|50|56)$/,file+': native text button needs matching height/line-height');
   }
   for(const prop of node.props){
    const name=prop.type===6?prop.name:prop.arg?.content;
    if(node.tag==='scroll-view')assert.ok(name!=='scroll-y'&&name!=='scroll-x',file+': use scroll-view direction');
    if(node.tag==='view'||node.tag==='text')assert.ok(name!=='role'&&!name?.startsWith('aria-'),file+': unsupported native accessibility property '+name);
   }
   const opacity=node.props.find(p=>p.type===7&&p.arg?.content==='style'&&p.exp?.content.includes('opacity:0.5'));
   if(node.tag==='view'&&opacity){const click=node.props.find(p=>p.type===7&&p.arg?.content==='click');assert.ok(click?.exp?.content.includes('if (!('),file+': disabled native action must guard clicks');}
  }
  for(const child of node.children??[])checkNativeNode(child);
 };
 checkNativeNode(parseTemplate(template));
 assert.ok(!/\.indexOf\(' [^']+ '\)/.test(template),file+': bind classes directly to state conditions');
 assert.ok(!/export default\s*\{|\bthis\./.test(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]),file+': old component options remain');
 const input=source.replace('lang="uts"','lang="ts"');
 const{descriptor,errors}=sfc.parse(input,{filename:file});assert.deepEqual(errors,[]);
 const compiled=sfc.compileScript(descriptor,{id:'vapor-check',fs:{fileExists:fs.existsSync,readFile:f=>fs.readFileSync(f,'utf8')}});
 if(descriptor.template){const result=sfc.compileTemplate({id:'vapor-check',filename:file,source:descriptor.template.content,compilerOptions:{bindingMetadata:compiled.bindings,expressionPlugins:['typescript']}});assert.deepEqual(result.errors,[],file);}
 for(const style of descriptor.styles)checkCss(style.content,file);
}
for(const file of all(path.join(root,'styles')).filter(f=>f.endsWith('.css')))checkCss(fs.readFileSync(file,'utf8'),file);
// Native button text uses line-height, not child flex alignment, for vertical centering.
const accountCss=fs.readFileSync(path.join(root,'styles/account.css'),'utf8');
for(const cls of ['account-primary','vapor-account-secondary--account-primary']){
 const rule=accountCss.match(new RegExp('\\.'+cls+' \\{([^}]+)\\}'))?.[1]??'';
 assert.equal(rule.match(/height:\s*(\d+)px/)?.[1],rule.match(/line-height:\s*(\d+)px/)?.[1],cls+': native button text must match its height');
 assert.ok(rule.includes('line-height:'),cls+': explicit native button line height');
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8').replace(/\/\*[\s\S]*?\*\//g,''));
assert.equal(manifest['uni-app-x'].vapor,true);assert.equal(manifest['uni-app-x'].styleIsolationVersion,'2');
console.log(`Vapor migration gate passed: ${files.length} setup scripts, Vue SFC/template compilation, native component/attribute rules, disabled action guards, single-class selectors, Vapor and isolation 2.0 configuration.`);
