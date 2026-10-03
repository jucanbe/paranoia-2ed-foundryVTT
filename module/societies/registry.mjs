import {tr,localizedRecord} from "../i18n/index.mjs";
import {definitions} from "./definitions.mjs";
const aliases={deathLeopards:["Leopardo de la Muerte"],firstChurchChristProgrammer:["Iglesia Primitiva"],purgers:["Purgadores Cristo Programador"]};
export const SOCIETY_REGISTRY=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([key,definition])=>[key,Object.freeze({
  structure:"",hierarchy:"",computerRelationship:"",benefits:"",obligations:"",jargon:"",gmNotes:"",specialRules:"",allyNotes:"",enemyNotes:"",
  ...definition,key,memberDescription:definition.shortDescription,
  allies:Object.freeze(definition.allies??[]),enemies:Object.freeze(definition.enemies??[]),relationshipsVerified:true,
  benefitSkills:Object.freeze((definition.benefitSkills??[]).map(Object.freeze)),
  ranks:key==="deathLeopards"?Object.freeze(["Gusano","Persona Auténtica","Lugarteniente","Cabecilla","Héroe","Superhéroe","Superestrella","Bestia Última"]):Object.freeze([]),
  rankHooks:Object.freeze(key==="psionics"?["additionalPsionicPowerAccess"]:[]),
  advancement:Object.freeze(key==="psionics"?{type:"additionalPsionicPower",trigger:"newSocietyLevel",selection:"gm",oncePerLevel:true,preserveOriginal:true}:{}),
  development:Object.freeze({skillCostMultipliers:Object.freeze(key==="sierraClub"?{"perception.survival":0.5}:{}),
    allowedSkills:Object.freeze(key==="computerPhreaks"?["computerSecurity","programming"]:key==="romantics"?["ancientCultures"]:[]),
    skillLabels:Object.freeze(key==="computerPhreaks"?{computerSecurity:"Seguridad Informática",programming:"Programación"}:key==="romantics"?{ancientCultures:"Conocimiento de Culturas Antiguas"}:{}),
    options:Object.freeze(["computerPhreaks","romantics"].includes(key)?[Object.freeze({type:"initialDevelopmentAccess",requiresSupportedSkill:true})]:[])}),
  aliases:Object.freeze(aliases[key]??[])
})])));
export function validateSocietyRegistry(registry=SOCIETY_REGISTRY){
  const keys=Object.keys(registry);
  if(keys.length!==16||new Set(keys).size!==16)throw Error("Se requieren exactamente 16 sociedades canónicas.");
  for(const [key,s] of Object.entries(registry)){
    if(s.key!==key||!s.displayName)throw Error(`Definición inválida: ${key}`);
    for(const target of [...s.allies,...s.enemies])if(!Object.hasOwn(registry,target))throw Error(`Referencia inválida: ${key} → ${target}`);
  }
  return true;
}
export const SOCIETY_TABLE=Object.freeze([[1,"antimutants"],[2,"computerPhreaks"],[3,"communists"],[4,"corporeMetal"],[6,"deathLeopards"],[8,"firstChurchChristProgrammer"],[9,"antifrankenstein"],[10,"freeEnterprise"],[11,"humanists"],[12,"illuminati"],[13,"mystics"],[14,"proTech"],[15,"psionics"],[16,"purgers"],[17,"romantics"],[19,"sierraClub"],[20,"custom"]].map(Object.freeze));
const normalize=value=>String(value??"").normalize("NFD").replace(/\p{Diacritic}/gu,"").trim().toLocaleLowerCase("es");
export function identifySociety(value){
  const search=normalize(value);
  return Object.values(SOCIETY_REGISTRY).find(s=>[s.key,s.displayName,tr(s.displayName),...s.aliases].some(name=>normalize(name)===search))??null;
}
export function societyKeyForRoll(value){
  if(!Number.isInteger(value)||value<1||value>20)throw Error("El resultado debe ser un entero entre 1 y 20.");
  return SOCIETY_TABLE.find(([max])=>value<=max)[1];
}
export const societyName=membership=>SOCIETY_REGISTRY[membership?.societyKey]?.displayName||membership?.custom?.name||membership?.name||"";
export const rankLabel=membership=>membership?.rank?.label||SOCIETY_REGISTRY[membership?.societyKey]?.ranks?.[membership?.rank?.level-1]||"";
export const MEMBERSHIP_STATUSES=Object.freeze(localizedRecord({active:"Activo",suspended:"Suspendido",expelled:"Expulsado",former:"Antiguo miembro"}));
export const MISSION_STATUSES=Object.freeze(localizedRecord({active:"Activa",completed:"Completada",failed:"Fallida",cancelled:"Cancelada"}));
export const MISSION_CATEGORIES=Object.freeze(localizedRecord({other:"Otra",sabotage:"Sabotaje",information:"Obtener información",recruit:"Reclutar ciudadano",protect:"Proteger miembro",equipment:"Robar equipo",investigate:"Investigar rival"}));


export const societyDisplayName=membership=>SOCIETY_REGISTRY[membership?.societyKey]?tr(SOCIETY_REGISTRY[membership.societyKey].displayName):societyName(membership);
