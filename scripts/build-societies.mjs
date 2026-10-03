import {createRequire} from "node:module";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {SOCIETY_REGISTRY,validateSocietyRegistry} from "../module/societies/registry.mjs";
import {societyReferenceHTML} from "../module/societies/reference.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),app=process.env.FOUNDRY_APP;
if(!app)throw Error("Set FOUNDRY_APP to the installed Foundry resources/app directory.");
const {ClassicLevel}=createRequire(resolve(app,"package.json"))("classic-level");
const stable=value=>createHash("sha256").update(`paranoia-2-edition:${value}`).digest("hex").slice(0,16);
validateSocietyRegistry();
// Optional staging output lets maintainers validate while the installed pack is locked.
const output=process.env.SOCIETY_PACK_OUTPUT??resolve(process.env.PACK_OUTPUT??resolve(root,"packs"),"societies");
const db=new ClassicLevel(resolve(output),{keyEncoding:"utf8",valueEncoding:"json"});
try{
  await db.open();
  const journals=db.sublevel("journal",{valueEncoding:"json"}),pages=db.sublevel("journal.pages",{valueEncoding:"json"});
  const journalOps=(await journals.keys().all()).map(key=>({type:"del",key}));
  const pageOps=(await pages.keys().all()).map(key=>({type:"del",key}));
  for(const society of Object.values(SOCIETY_REGISTRY)){
    const catalogId=`society-${society.key}`,journalId=stable(catalogId),pageId=stable(`${catalogId}:reference`);
    const content=societyReferenceHTML(society,{isGM:true,includeTitle:false});
    journalOps.push({type:"put",key:journalId,value:{_id:journalId,name:society.displayName,img:"icons/svg/book.svg",pages:[pageId],folder:null,sort:0,ownership:{default:0},flags:{"paranoia-2-edition":{catalogId,societyKey:society.key}}}});
    pageOps.push({type:"put",key:`${journalId}.${pageId}`,value:{_id:pageId,name:society.displayName,type:"text",sort:0,title:{show:false,level:1},text:{content,format:1},ownership:{default:0}}});
  }
  await pages.batch(pageOps);await journals.batch(journalOps);
  console.log(`societies: ${Object.keys(SOCIETY_REGISTRY).length} JournalEntries, deterministic IDs and source-derived content`);
}finally{await db.close();}
