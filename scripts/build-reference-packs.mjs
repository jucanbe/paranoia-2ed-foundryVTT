import {createRequire} from "node:module";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {SKILL_REFERENCES,skillReferenceHTML} from "../module/references/skills.mjs";
import {SERVICE_REFERENCES} from "../module/creation/service-reference.mjs";
import {POWER_REGISTRY,POWER_RESULTS} from "../module/powers/registry.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const {ClassicLevel}=createRequire(resolve(process.env.FOUNDRY_APP,"package.json"))("classic-level");
const stable=value=>createHash("sha256").update(`paranoia-2-edition:${value}`).digest("hex").slice(0,16);
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const paragraph=value=>`<p>${esc(value)}</p>`;
const section=(label,value)=>`<h2>${esc(label)}</h2>${paragraph(value)}`;
export function serviceHTML(s){return section("Descripción",s.description)+`<h2>Habilidades del Servicio</h2><ul>${s.skills.map(skill=>`<li>${esc(skill)}</li>`).join("")}</ul>`+paragraph("Lista de referencia del manual; esta entrada no modifica automáticamente las habilidades del personaje.")+paragraph("Fuente: manual español, páginas 43–46 y Anexo A.");}
export function powerHTML(p){return section("Reglas",p.specialRules)+section("Alcance",p.rangeMeters==null?"Según adjudicación del DJ":`${p.rangeMeters} m`)+section("Duración",p.durationNotes)+`<h2>Resultados</h2>${Object.entries(POWER_RESULTS).map(([key,label])=>section(label,p.results[key])).join("")}`+paragraph("Fuente: registro canónico de poderes mutantes; manual español, Poderes Mutantes.");}
for(const [pack,entries] of [["services",SERVICE_REFERENCES.map(s=>({key:s.key,name:`${s.key} — ${s.name}`,content:serviceHTML(s)}))],["mutant-powers",Object.values(POWER_REGISTRY).map(p=>({key:p.key,name:p.label,content:powerHTML(p)}))],["skills",SKILL_REFERENCES.map(s=>({key:s.key,name:s.label,content:skillReferenceHTML(s)}))]]){
  if(process.argv.slice(2).length&&!process.argv.slice(2).includes(pack))continue;
  const db=new ClassicLevel(resolve(process.env.PACK_OUTPUT??resolve(root,"packs"),pack),{keyEncoding:"utf8",valueEncoding:"json"});
  try{
    await db.open();const journals=db.sublevel("journal",{valueEncoding:"json"}),pages=db.sublevel("journal.pages",{valueEncoding:"json"});
    const jo=(await journals.keys().all()).map(key=>({type:"del",key})),po=(await pages.keys().all()).map(key=>({type:"del",key}));
    for(const entry of entries){const id=stable(`${pack}:${entry.key}`),pageId=stable(`${pack}:${entry.key}:reference`);
      jo.push({type:"put",key:id,value:{_id:id,name:entry.name,img:"icons/svg/book.svg",pages:[pageId],folder:null,sort:0,ownership:{default:pack==="skills"?2:0},flags:{"paranoia-2-edition":{catalogId:`${pack}-${entry.key}`,referenceKey:entry.key,referencePack:pack}}}});
      po.push({type:"put",key:`${id}.${pageId}`,value:{_id:pageId,name:entry.name,type:"text",sort:0,title:{show:false,level:1},text:{content:entry.content,format:1},ownership:{default:pack==="skills"?-1:0}}});
    }
    await pages.batch(po);await journals.batch(jo);console.log(`${pack}: ${entries.length} JournalEntries`);
  }finally{await db.close();}
}
