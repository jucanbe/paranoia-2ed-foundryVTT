import {createRequire} from "node:module";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {readFile,mkdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),output=join(root,"dist/pack-determinism"),app=process.env.FOUNDRY_APP;
if(!app)throw Error("Set FOUNDRY_APP to resources/app.");
const {ClassicLevel}=createRequire(resolve(app,"package.json"))("classic-level"),manifest=JSON.parse(await readFile(join(root,"system.json"),"utf8"));
await mkdir(output,{recursive:true});
async function snapshot(){const result={};for(const pack of manifest.packs){const db=new ClassicLevel(join(output,pack.name),{keyEncoding:"utf8",valueEncoding:"json"});try{await db.open();result[pack.name]=createHash("sha256").update(JSON.stringify(await db.iterator().all())).digest("hex");}finally{await db.close();}}return result;}
const build=()=>execFileSync(process.execPath,[join(root,"scripts/build-packs.mjs")],{env:{...process.env,PACK_OUTPUT:output},stdio:"inherit"});
build();const first=await snapshot();build();const second=await snapshot();if(JSON.stringify(first)!==JSON.stringify(second))throw Error("Non-deterministic pack contents");console.log(JSON.stringify({deterministic:true,hashes:second},null,2));
