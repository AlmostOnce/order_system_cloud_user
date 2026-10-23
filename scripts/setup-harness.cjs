// Execute real script-setup bodies with Vue reactivity and isolated uni lifecycle/API stubs.
const ts=require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const vue=require('D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/vue');
exports.loadSetup=function(source,resolve){
 const sf=ts.createSourceFile('setup.ts',source,ts.ScriptTarget.Latest,true);
 if(sf.parseDiagnostics.length)throw Error('Invalid setup syntax');
 // uni-app x injects these globals during compilation. Supply isolated hook
 // registration functions here because this unit harness does not run that compiler.
 const hookNames=['onLaunch','onAppShow','onAppHide','onShow','onHide','onExit','onLastPageBackPress','onLoad','onReady','onUnload','onPageShow','onPageHide'];
 const hooksUsed=hookNames.filter(name=>new RegExp('\\b'+name+'\\s*\\(').test(source));
 const imports=sf.statements.filter(ts.isImportDeclaration).map(s=>s.getText(sf)).join('\n')+(hooksUsed.length?'\nimport { '+hooksUsed.join(',')+' } from "@dcloudio/uni-app";':'');
 const methods=[],refs=[],props=[];let body='';
 for(const s of sf.statements){
  if(ts.isImportDeclaration(s))continue;
  if(ts.isFunctionDeclaration(s)){
   const name=s.name.text;methods.push(name);
   body+='let '+name+' = function '+name+'Impl('+s.parameters.map(p=>p.getText(sf)).join(',')+')'+(s.type?': '+s.type.getText(sf):'')+' '+s.body.getText(sf)+'\n';
  }else{
   body+=s.getText(sf)+'\n';
   if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations){
    if(d.initializer&&ts.isCallExpression(d.initializer)){
     if(['ref','computed'].includes(d.initializer.expression.getText(sf)))refs.push(d.name.getText(sf));
     if(d.initializer.expression.getText(sf)==='toRefs')refs.push(...d.name.elements.map(e=>e.name.getText(sf))); 
     if(d.initializer.expression.getText(sf)==='defineProps')props.push(...d.initializer.arguments[0].properties.map(p=>p.name.getText(sf)));
    }
   }
  }
 }
 let descriptors='';
 for(const n of refs)descriptors+=`${JSON.stringify(n)}:{enumerable:true,get:()=>${n}.value,set:v=>{${n}.value=v}},`;
 for(const n of methods)descriptors+=`${JSON.stringify(n)}:{enumerable:true,get:()=>${n},set:v=>{${n}=v}},`;
 for(const n of props)descriptors+=`${JSON.stringify(n)}:{enumerable:true,get:()=>props.${n},set:v=>{props.${n}=v}},`;
 const program=imports+`\nexport function create(initialProps: any = {}) { const hooks: any = {}; __setHooks(hooks); const defineProps=(definitions: any)=>__defineProps(definitions,initialProps);\n`+body+`\nconst vm: any={}; Object.defineProperties(vm,{${descriptors}}); vm.$hooks=hooks; return vm; }`;
 const mod={exports:{}},env={hooks:{}};
 const output=ts.transpileModule(program,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function('require','module','exports','__setHooks','__defineProps',output)(p=>{
  if(p==='vue')return {...vue, onMounted:fn=>{env.hooks.onMounted=fn}, onBeforeUnmount:fn=>{env.hooks.onBeforeUnmount=fn}, getCurrentInstance:()=>null};
  if(p==='@dcloudio/uni-app')return new Proxy({},{get:(_,name)=>fn=>{env.hooks[name]=fn}});
  return resolve(p);
 },mod,mod.exports,hooks=>{env.hooks=hooks},(defs,provided)=>vue.reactive(Object.assign(Object.fromEntries(Object.entries(defs).map(([key,value])=>[key,value.default])),provided)));
 return mod.exports;
};
