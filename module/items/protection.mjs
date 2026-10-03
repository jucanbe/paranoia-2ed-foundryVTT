import {tr} from "../i18n/index.mjs";
import {PROTECTION_TYPES,normalizeWeaponCategory,armorCode} from "./config.mjs";
export function protectionEntries(system){
  if(system.protections?.length)return [...system.protections];
  return system.protectionType&&system.protectionValue!=null?[{type:system.protectionType,value:system.protectionValue}]:[];
}
export const protectionCode=system=>protectionEntries(system).map(p=>armorCode(p.type,p.value)).join(tr("/"))||"—";
export function getProtectionFor(system,category,{polyvalent=true}={}){
  const key=normalizeWeaponCategory(category),entries=polyvalent?protectionEntries(system):[{type:system.protectionType,value:system.protectionValue}];
  return Math.max(0,...entries.filter(p=>(p.type===key||p.type==="all")&&Object.hasOwn(PROTECTION_TYPES,p.type)&&Number.isFinite(p.value)&&p.value>=0).map(p=>p.value));
}
