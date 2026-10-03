import {localizedRecord} from "../i18n/index.mjs";
import {CLEARANCE_CODES} from "../actors/identity.mjs";
import {LABELS} from "../sheets/labels.mjs";

export const ITEM_CLEARANCES = Object.freeze(Object.keys(CLEARANCE_CODES));
export const WEAPON_CATEGORIES = Object.freeze(localizedRecord({
  laser:{code:"L",label:"Láser"}, projectile:{code:"P",label:"Proyectiles"},
  piercingProjectile:{code:"PP",label:"Proyectiles perforantes"}, campaign:{code:"C",label:"Campaña"},
  melee:{code:"B",label:"Cuerpo a cuerpo"}, energy:{code:"E",label:"Energía"}
}));
export const LEGACY_WEAPON_CODES = Object.freeze(Object.fromEntries(Object.entries(WEAPON_CATEGORIES).map(([key,value])=>[value.code,key])));
export const PROTECTION_TYPES = Object.freeze(localizedRecord({...WEAPON_CATEGORIES,all:{code:"T",label:"Todos los tipos"}}));
export function armorCode(type,value) {
  return Object.hasOwn(PROTECTION_TYPES,type)&&typeof value==="number"&&Number.isFinite(value)?`${PROTECTION_TYPES[type].code}${value}`:"—";
}
export function normalizeWeaponCategory(value) {
  return Object.hasOwn(WEAPON_CATEGORIES,value) ? value : LEGACY_WEAPON_CODES[value] ?? "";
}
export const EQUIPMENT_CATEGORIES = Object.freeze(localizedRecord({general:"General",communicator:"Comunicador",recorder:"Grabadora",tool:"Herramienta",medical:"Médico",computer:"Informática",consumable:"Consumible",other:"Otro"}));
// Reuse the existing Character skill configuration; canonical values retain group.key compatibility.
export const ITEM_SKILLS = Object.freeze(localizedRecord(Object.entries(LABELS.skillNames).flatMap(([group,skills])=>Object.entries(skills).map(([key,label])=>({key:`${group}.${key}`,shortKey:key,label,groupLabel:LABELS.attributeNames[group]})))));
export function canonicalSkill(value) {return ITEM_SKILLS.find(skill=>skill.key===value||skill.shortKey===value)?.key??value;}
export function skillLabel(value) {return ITEM_SKILLS.find(skill=>skill.key===canonicalSkill(value))?.label??value;}
export const ITEM_LABELS = localizedRecord({
  equipped:"Equipada",
  price:"Precio (créditos)",priceUnit:"Unidad del precio",length:"Longitud (metros)",
  ...LABELS, image:"Imagen", identity:"Identificación", weaponData:"Datos del arma", protection:"Protección",
  protectionType:"Tipo de protección",protectionValue:"Protección",armorCode:"Código de armadura",
  category:"Categoría", assigned:"Asignado", assignmentNotes:"Asignación / misión", weight:"Peso (kg)",
  sourceReference:"Fuente / referencia", specialRules:"Reglas especiales", optional:"Información adicional (opcional)",
  charges:"Cargas", capacity:"Capacidad", ammunition:"Munición / capacidad", reloadInfo:"Recarga (descripción)",
  areaNotes:"Notas de área / campaña", experimentalNotes:"Notas experimentales", consumable:"Consumible",
  uses:"Usos", current:"Actual", maximum:"Máximo", model:"Modelo / tipo", none:"Sin especificar",
  legacy:"Información original conservada", inventoryHint:"Arrastra objetos desde el Directorio o un compendio. Arrastra una fila para ordenar.",
  increase:"Aumentar cantidad", decrease:"Disminuir cantidad"
});
