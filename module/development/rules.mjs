import {tr,trHTML} from "../i18n/index.mjs";
import {ITEM_SKILLS,canonicalSkill} from "../items/config.mjs";
export const SKILLS=ITEM_SKILLS;
export function skillKey(value){const key=canonicalSkill(value);if(!SKILLS.some(s=>s.key===key))throw Error(tr("Habilidad desconocida; los PD no mejoran atributos ni habilidades básicas."));return key;}
export function integer(value,label=tr("PD")){
  if(!Number.isSafeInteger(value)||value<0)throw Error(trHTML`${label}: se requiere un entero no negativo.`);return value;
}
export function development(value={}){
  const copy=structuredClone(value.toObject?.()??value);
  return {available:0,lifetimeEarned:0,lifetimeSpent:0,lifetimeRefunded:0,restricted:false,eligibleSkills:[],usage:[],history:[],...copy};
}
/** Post-creation policy: no generation cap. Round half-cost odd increases upward, never fractional PD. */
export function improvementCost(key,increase,metadata={}){
  integer(increase,tr("Incremento"));
  const factor=metadata.scope==="creation"?1:metadata.skillCostMultipliers?.[key]??1;
  if(typeof factor!=="number"||!Number.isFinite(factor)||factor<=0)throw Error(tr("Modificador de coste no válido."));
  const cost=increase?Math.max(1,Math.ceil(increase*factor)):0;integer(cost,tr("Coste"));
  return {cost,rule:factor===1?"normal":`skillCostMultiplier:${factor}`,multiplier:factor};
}
export function improvementPlan(actor,rows,metadata={},options={}){
  const d=development(actor.system.development),seen=new Set(),result=[];
  for(const row of rows){
    const key=skillKey(row.skillKey);if(seen.has(key))throw Error(tr("Habilidad duplicada."));seen.add(key);
    integer(row.increase,tr("Incremento"));if(!row.increase)continue;
    if(d.restricted&&!d.eligibleSkills.includes(key)&&!options.overrideRestrictions)throw Error(tr("La habilidad no está autorizada por el DJ."));
    const [group,skill]=key.split("."),oldValue=actor.system.skills?.[group]?.[skill]?.value;
    if(!Number.isSafeInteger(oldValue)||oldValue<0)throw Error(tr("El valor actual de la habilidad no es válido."));
    const newValue=oldValue+row.increase;integer(newValue,tr("Valor de habilidad"));
    const normal=improvementCost(key,row.increase,metadata);
    const overridden=row.overrideCost!==undefined;
    const cost=overridden?integer(row.overrideCost,tr("Coste elegido por el DJ")):normal.cost;
    if((overridden||options.overrideRestrictions)&&!String(options.reason??"").trim())throw Error(tr("La excepción del DJ requiere motivo."));
    result.push({skillKey:key,oldValue,newValue,cost,rule:overridden?"gmOverride":normal.rule,multiplier:normal.multiplier});
  }
  const totalCost=result.reduce((sum,row)=>sum+row.cost,0);integer(totalCost,tr("Coste total"));
  if(totalCost>d.available)throw Error(tr("No hay suficientes PD. No se aplicó ninguna mejora."));
  return {rows:result,totalCost,remaining:d.available-totalCost};
}
