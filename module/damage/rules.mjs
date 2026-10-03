import {trHTML,tr} from "../i18n/index.mjs";
import {WEAPON_CATEGORIES,normalizeWeaponCategory,canonicalSkill,armorCode} from "../items/config.mjs";
import {getProtectionFor,protectionCode,protectionEntries} from "../items/protection.mjs";
import {enabled} from "../combat/optional/settings.mjs";
const meleeSkills=new Set(["agility.brawling","agility.neuralWhip","agility.club","agility.energySword","agility.ancientMeleeWeapons"]);
export function usesStrength(weapon){return normalizeWeaponCategory(weapon?.system?.weaponCategory)==="melee"||meleeSkills.has(canonicalSkill(weapon?.system?.skill));}
export function numeric(value,label){if(typeof value!=="number"||!Number.isFinite(value))throw Error(trHTML`${label}: falta un valor numérico verificado.`);return value;}
export function damageNumber({baseDamageNumber,strengthBonus=0,stamina=0,armorProtection=0}){
  return numeric(baseDamageNumber,tr("ND base"))+numeric(strengthBonus,tr("Bonus de Daño"))-numeric(stamina,tr("Aguante"))-numeric(armorProtection,tr("Armadura"));
}
export function armorForAttack(items,category){
  const equipped=[...items].filter(i=>i.type==="armor"&&i.system.equipped).sort((a,b)=>(a.sort??0)-(b.sort??0)||String(a.id).localeCompare(String(b.id)));
  const warnings=[];
  if(equipped.length>1)warnings.push(tr("Hay varias armaduras equipadas: se usa solo la primera válida por orden de inventario e ID."));
  const poly=enabled("polyvalentArmor"),armor=equipped.find(i=>poly?protectionEntries(i.system).some(p=>Object.hasOwn({all:true,...WEAPON_CATEGORIES},p.type)&&Number.isFinite(p.value)&&p.value>=0):(i.system.protectionType==="all"||Object.hasOwn(WEAPON_CATEGORIES,i.system.protectionType))&&typeof i.system.protectionValue==="number"&&Number.isFinite(i.system.protectionValue)&&i.system.protectionValue>=0);
  if(equipped.some(i=>!i.system.protectionType||i.system.protectionValue==null))warnings.push(tr("Hay armadura equipada sin protección configurada; no se inventa su valor."));
  if(!armor)return {armor:null,armorProtection:0,armorLabel:tr("Sin armadura válida equipada"),warnings};
  const key=normalizeWeaponCategory(category);
  if(!key)throw Error(tr("Selecciona una categoría de daño verificada para comprobar la armadura."));
  const armorProtection=getProtectionFor(armor.system,key,{polyvalent:poly});
  return {armor,armorProtection,armorLabel:`${armor.name} · ${poly?protectionCode(armor.system):armorCode(armor.system.protectionType,armor.system.protectionValue)}`,warnings};
}
