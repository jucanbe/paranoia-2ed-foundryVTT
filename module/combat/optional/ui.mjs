import {staticMarkup} from "../../i18n/index.mjs";
import {tr,trHTML} from "../../i18n/index.mjs";
import {enabled,OPTIONAL_RULES} from "./settings.mjs";
import {ammunitionData} from "./runtime.mjs";
import {RANGE_LABELS} from "./rules.mjs";
const esc=v=>foundry.utils.escapeHTML(String(v??""));
export function optionalAttackHTML(combat,c,d){
  const opts=Object.fromEntries(Object.keys(OPTIONAL_RULES).map(k=>[k,enabled(k)]));
  if(!["range","cover","movement","burstFire","weaponHandling","ammunition","malfunctions"].some(k=>opts[k]))return "";
  const rows=(["range","cover","movement"].some(k=>opts[k])?(d.burst?d.targetIds:[""]):[]).map(id=>{
    const prefix=id?`target.${id}.`:"",target=combat.combatants.get(id);
    return `<fieldset><legend>${esc(target?.name??tr("Circunstancias del objetivo"))}</legend>${opts.range?trHTML`<label>Distancia manual (m; vacío usa escena)<input type="number" name="${prefix}distanceMeters" min="0" step="any"></label><label>Alcance<select name="${prefix}rangeBand"><option value="auto">Detectar / DJ si desconocido</option>${Object.entries(RANGE_LABELS).map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}</select></label>`:""}${opts.cover?trHTML`<label>Cobertura<select name="${prefix}cover"><option value="none">Ninguna</option><option value="light">Poca (−1)</option><option value="half">La mitad (−4)</option><option value="nearTotal">Casi completa (−15)</option></select></label>`:""}${opts.movement?staticMarkup("<p>Movimiento: se utiliza la declaración de cada participante; Paseo / quieto 0, Marcha −1, Carrera −4.</p>"):""}</fieldset>`;
  }).join("");
  const weapons=c.actor.items.filter(i=>i.type==="weapon").map(w=>`${esc(w.name)}: ${opts.ammunition?trHTML`munición ${w.system.ammoCurrent??tr("sin verificar")} / ${ammunitionData(w).capacity??"?"}; `:""}${opts.weaponHandling?`${w.system.integrated||c.getFlag("paranoia-2-edition","weaponReady")?.includes(w.id)?tr("Preparada"):tr("Enfundada")}; `:""}${opts.burstFire?`${w.system.burstCapable?trHTML`Ráfaga: hasta ${w.system.burstMaxTargets} objetivos` : tr("Sin ráfaga")}; `:""}${opts.malfunctions?`${esc(({normal:tr("Normal"),experimental:tr("Experimental"),trulyExperimental:tr("Verdaderamente experimental")})[w.system.reliabilityType]??w.system.reliabilityType)}${w.system.malfunctioned?" · AVERIADA":""}`:""}`).join("<br>");
  return trHTML`<details open><summary>Reglas opcionales${d.burst?" · RÁFAGA":""}</summary>${rows}<p>${weapons}</p>${game.user.isGM?`${d.burst?staticMarkup('<label><input name="confirmBurstSeparation" type="checkbox"> DJ confirma objetivos separados por ≤5 m</label>'):""}${opts.movement?staticMarkup('<label><input name="ignoreMovement" type="checkbox"> DJ ignora penalización de movimiento</label>'):""}${opts.malfunctions?staticMarkup('<label><input name="ignoreMalfunction" type="checkbox"> DJ ignora avería automática</label>'):""}`:""}</details>`;
}
export function optionalFormOptions(form){
  const values=Object.fromEntries(new FormData(form)),targetCircumstances={};
  for(const [name,value] of Object.entries(values))if(name.startsWith("target.")){const [,id,key]=name.split(".");targetCircumstances[id]??={};targetCircumstances[id][key]=key==="distanceMeters"?(value===""?null:Number(value)):value;}
  return {...values,targetCircumstances,distanceMeters:values.distanceMeters==null||values.distanceMeters===""?null:Number(values.distanceMeters),ignoreMovement:!!values.ignoreMovement,ignoreMalfunction:!!values.ignoreMalfunction,confirmBurstSeparation:!!values.confirmBurstSeparation};
}
export async function surpriseDialog(combat,request){
  const values=await foundry.applications.api.DialogV2.wait({window:{title:tr("Turno de Sorpresa · DJ")},content:trHTML`<p>Selecciona quienes sorprenden. Los demás solo pueden defenderse. Después comienza el turno normal 1.</p>${combat.combatants.map(c=>`<label><input type="checkbox" name="surprisingIds" value="${c.id}">${esc(c.name)}</label>`).join("")}`,buttons:[{action:"apply",label:tr("Comenzar Sorpresa"),callback:(_e,b)=>new FormData(b.form).getAll("surprisingIds")},{action:"cancel",label:tr("Cancelar")}]});
  if(Array.isArray(values))return request(combat,"surprise",{surprisingIds:values});
}
