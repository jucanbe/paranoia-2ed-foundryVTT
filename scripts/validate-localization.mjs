import {readFile,readdir} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import {messageKey} from "../module/i18n/index.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),load=async p=>JSON.parse(await readFile(join(root,p),"utf8"));
const es=await load("lang/es.json"),en=await load("lang/en.json"),manifest=await load("system.json");
function flatten(value,path=""){return Object.fromEntries(Object.entries(value).flatMap(([key,next])=>typeof next==="object"?Object.entries(flatten(next,path+key+".")):[[path+key,next]]));}
const a=flatten(es),b=flatten(en);assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());
for(const [key,value]of Object.entries(es.P2.Text)){assert.equal(messageKey(value),"P2.Text."+key);assert.ok(en.P2.Text[key]?.trim());}
for(const lang of ["es","en"])assert.ok(manifest.languages.some(l=>l.lang===lang&&l.path===`lang/${lang}.json`));
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true}))out.push(...(e.isDirectory()?await files(join(dir,e.name)):[join(dir,e.name)]));return out;}
let templates=0;for(const file of await files(join(root,"templates"))){if(!file.endsWith(".hbs"))continue;templates++;const text=await readFile(file,"utf8");for(const match of text.matchAll(/{{localize "(P2\.[^"]+)"}}/g))assert.ok(Object.hasOwn(a,match[1]),`Missing translation in ${file}: ${match[1]}`);}
console.log(`${Object.keys(es.P2.Text).length} bilingual messages; ${templates} templates; matching dictionaries and valid manifest.`);
