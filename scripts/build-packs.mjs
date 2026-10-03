import {createRequire} from "node:module";
import {readFile, writeFile, mkdir} from "node:fs/promises";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

// Maintainer-only build. Players receive the compiled packs; no install step runs.
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const app=process.env.FOUNDRY_APP;
const output=resolve(process.env.PACK_OUTPUT??resolve(root,"packs"));
if(!app)throw new Error("Set FOUNDRY_APP to the installed Foundry resources/app directory. Stop servers using these packs before building.");
const {ClassicLevel}=createRequire(resolve(app,"package.json"))("classic-level");
const ids=new Set();
const catalogue=[];
const selected=process.argv.slice(2);
for(const pack of ["weapons","armor","equipment","robots","robot-programs","vehicles"].filter(p=>!selected.length||selected.includes(p))){
  const entries=JSON.parse(await readFile(resolve(root,`packs-source/${pack}.json`),"utf8"));
  if(["weapons","armor","equipment"].includes(pack))catalogue.push(...entries);
  await mkdir(output,{recursive:true});
  const db=new ClassicLevel(resolve(output,pack),{keyEncoding:"utf8",valueEncoding:"json"});
  try{
    await db.open();
    const items=db.sublevel(["robots","vehicles"].includes(pack)?"actors":"items",{valueEncoding:"json"});
    const documents=entries.map(entry=>{
      const {catalogId,startingPurchase=false,...source}=entry;
      if(!/^[a-z0-9-]+$/.test(catalogId)||ids.has(catalogId))throw new Error(`Invalid/duplicate catalogue ID: ${catalogId}`);
      ids.add(catalogId);
      if(!["robots","robot-programs","vehicles"].includes(pack))source.system={price:null,sourceReference:"Extracto verificado del manual español de Paranoia 2ª Edición, facilitado por el usuario (2026-09-28).",...source.system};
      if(["robots","vehicles"].includes(pack))source.items=(source.items??[]).map((item,index)=>({...item,_id:createHash("sha256").update(`${catalogId}:item:${index}`).digest("hex").slice(0,16),img:"icons/svg/item-bag.svg",effects:[]}));
      const assignedStarterItem=["standard-troubleshooter-uniform","laser-pistol","laser-charge"].includes(catalogId);
      return {...source,_id:createHash("sha256").update(`paranoia-2-edition:${catalogId}`).digest("hex").slice(0,16),
        img:source.img??"icons/svg/item-bag.svg",effects:[],folder:null,sort:0,
        flags:{"paranoia-2-edition":{catalogId,startingPurchase,assignedStarterItem,...(startingPurchase?{purchaseMinimumClearance:"red"}:{})}},ownership:{default:0}};
    });
    if(["robots","vehicles"].includes(pack)){
      // V14 stores Actor embedded Items separately, keyed by actorId.itemId.
      const embedded=db.sublevel("actors.items",{valueEncoding:"json"});
      const writes=(await embedded.keys().all()).map(key=>({type:"del",key}));
      for(const actor of documents){
        for(const item of actor.items)writes.push({type:"put",key:`${actor._id}.${item._id}`,value:item});
        actor.items=actor.items.map(item=>item._id);
      }
      await embedded.batch(writes);
    }
    // A single batch replaces records; sorted stable IDs give deterministic document content.
    const operations=(await items.keys().all()).map(key=>({type:"del",key}));
    operations.push(...documents.sort((a,b)=>a._id.localeCompare(b._id)).map(value=>({type:"put",key:value._id,value})));
    await items.batch(operations);
    console.log(`${pack}: ${documents.length} ${["robots","vehicles"].includes(pack)?"Actors":"Items"}`);
  }finally{await db.close();}
}
if(!selected.length||selected.includes("societies"))await import("./build-societies.mjs");
if(!selected.length||selected.some(p=>["services","mutant-powers","skills"].includes(p)))await import("./build-reference-packs.mjs");
if(selected.length)process.exit(0);
const list=items=>items.map(item=>`- ${item.name} (${item.catalogId})`).join("\n");
const weapons=catalogue.filter(item=>item.type==="weapon");
await writeFile(resolve(root,"packs-source/missing-statistics.md"),`# Unavailable catalogue statistics\n\nGenerated from the source JSON. Unset text is stored as an empty string to preserve the existing schema; unknown numeric values are null. Malfunction damage, web length and area radii are never used as normal damage or weapon range.\n\n## Missing normal Damage Number (${weapons.filter(i=>i.system.damageNumber==null).length})\n\n${list(weapons.filter(i=>i.system.damageNumber==null))}\n\n## Missing normal range (${weapons.filter(i=>!i.system.range).length})\n\n${list(weapons.filter(i=>!i.system.range))}\n\n## Missing price (${catalogue.filter(i=>i.system.price==null).length})\n\n${list(catalogue.filter(i=>i.system.price==null))}\n\n## Other unavailable values\n\n- Starter uniform: protection type and value; not assumed to equal the separate L4 example.\n- Clearance and prices are filled only where Annex B lists the specific model; starting purchase eligibility remains independently verified as Red.\n- Generic legacy axe and unknown mounted payload damage/type remain manual. Gas uses the printed Pt effect, and type O is non-damaging.\n- Exact model/program specifications for generic communicator and multirecorder entries are pending.\n- Detailed reflect-color interactions and special gas, stun, web and Gauss target restrictions remain descriptive/manual.\n`,"utf8");
