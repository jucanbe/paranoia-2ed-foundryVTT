import {readFile,readdir,access} from "node:fs/promises";
import {resolve,dirname,join,relative} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {validateSocietyRegistry,SOCIETY_REGISTRY} from "../module/societies/registry.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),manifest=JSON.parse(await readFile(join(root,"system.json"),"utf8"));
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const files=(await Promise.all(["module","templates","styles","scripts","tests"].map(d=>walk(join(root,d))))).flat();
const graph=new Map();let checked=0;
for(const file of files){
  const source=await readFile(file,"utf8");
  if(/\.(mjs|cjs)$/.test(file)){
    execFileSync(process.execPath,["--check",file]);checked++;
    const imports=[...source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)].map(m=>resolve(dirname(file),m[1]));
    for(const p of imports)await access(p);graph.set(file,imports);
  }
  if(file.includes(`${join(root,"module")}`)){
    if(/(?:[CE]:[\\/]|society-fresh-validation)/.test(source))throw Error(`Local dependency: ${relative(root,file)}`);
    for(const m of source.matchAll(/systems\/paranoia-2-edition\/([^"'`]+\.(?:hbs|css))/g))await access(join(root,m[1]));
  }
}
for(const path of [...manifest.esmodules,...manifest.styles,...(manifest.languages??[]).map(l=>l.path)])await access(join(root,path));
validateSocietyRegistry();
const ids=new Set(),packs=[];
for(const pack of manifest.packs){
  await access(join(root,pack.path));
  let count=Object.keys(SOCIETY_REGISTRY).length;
  if(pack.name!=="societies"){
    const entries=JSON.parse(await readFile(join(root,`packs-source/${pack.name}.json`),"utf8"));count=entries.length;
    for(const entry of entries){if(ids.has(entry.catalogId))throw Error(`Duplicate catalogId: ${entry.catalogId}`);ids.add(entry.catalogId);if(!manifest.documentTypes[pack.type]?.[entry.type])throw Error(`Undeclared type: ${entry.type}`);}
  }
  packs.push({id:`${manifest.id}.${pack.name}`,type:pack.type,count});
}
// Cycles are reported for review, not silently rewritten when existing runtime behavior is valid.
const cycles=new Set();
function visit(file,path=[]){if(path.includes(file)){cycles.add([...path.slice(path.indexOf(file)),file].map(p=>relative(root,p).replaceAll("\\","/")).join(" -> "));return;}if(path.length>15)return;for(const child of graph.get(file)??[])visit(child,[...path,file]);}
// Limit traversal to service entry points to keep the audit bounded.
for(const file of graph.keys())if(file.endsWith("service.mjs"))visit(file);
console.log(JSON.stringify({version:manifest.version,files:files.length,syntaxFiles:checked,packs,importCycles:[...cycles]},null,2));
