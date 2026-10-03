import {tr,trHTML,localizedRecord} from "../i18n/index.mjs";
import {SOCIETY_REGISTRY} from "./registry.mjs";
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
/** One rendering path for the distributed GM pack and member reference dialog. */
export function societyReferenceHTML(definition,{isGM=false,name,includeTitle=true}={}){
  if(SOCIETY_REGISTRY[definition.key])definition=localizedRecord(definition);
  const fields={beliefs:tr("Creencias"),objectives:tr("Objetivos"),allies:tr("Aliados"),enemies:tr("Enemigos"),structure:tr("Estructura"),hierarchy:tr("Jerarquía"),computerRelationship:tr("Relación con el Ordenador"),benefits:tr("Beneficios"),obligations:tr("Obligaciones"),specialRules:tr("Reglas especiales"),jargon:tr("Habla habitual")};
  let html=trHTML`${includeTitle?`<h1>${esc(name??definition.displayName??definition.name)}</h1>`:""}<h2>Resumen</h2><p>${esc(definition.memberDescription??definition.shortDescription??"")}</p>`;
  for(const [key,label] of Object.entries(fields)){
    const raw=definition[key];
    const value=Array.isArray(raw)?raw.map(k=>tr(SOCIETY_REGISTRY[k]?.displayName??k)).join(", "):raw;
    const note=key==="allies"?definition.allyNotes:key==="enemies"?definition.enemyNotes:"";
    if(value||note)html+=`<h2>${label}</h2>${value?`<p>${esc(value)}</p>`:""}${note?`<p>${esc(note)}</p>`:""}`;
  }
  if(isGM&&definition.gmNotes)html+=trHTML`<h2>Notas del DJ</h2><p>${esc(definition.gmNotes)}</p>`;
  return `<section class="p2-society-reference">${html}</section>`;
}
