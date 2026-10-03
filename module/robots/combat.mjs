import {tr} from "../i18n/index.mjs";
/** Only explicitly declared integrated robot weapons get one slot each. Held weapons retain one slot. */
export function integratedSelection(actor,ids=[]){
  if(!Array.isArray(ids))throw Error(tr("Selección de armas no válida."));
  const unique=[...new Set(ids)];
  if(unique.length&&(!["robot","vehicle"].includes(actor.type)||unique.some(id=>{const w=actor.items.get(id);return w?.type!=="weapon"||!w.system.integrated;})))throw Error(tr("Solo se permiten armas integradas del robot o vehículo."));
  return unique;
}
export function attackSlot(actor,declaration,weaponId){
  const ids=declaration?.integratedWeaponIds??[];
  if(["robot","vehicle"].includes(actor.type)&&ids.length){if(!ids.includes(weaponId))throw Error(tr("Arma no declarada en la salva integrada."));return weaponId;}
  return "single";
}
export function allAttacksResolved(state,declaration){
  if(!state)return false;
  const ids=declaration?.integratedWeaponIds??[];
  return ids.length?ids.every(id=>state.weapons?.[id]?.resolved):!!state.resolved;
}
