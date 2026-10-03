import {tr,trHTML} from "../i18n/index.mjs";
import {NPC_GENERATION_CONFIG as POLICY,NPC_EQUIPMENT_PRESETS,NPC_ROLES} from "./config.mjs";
import {CLEARANCE_CODES,buildCitizenId,normalizeIdentityText} from "../actors/identity.mjs";
import {SERVICES,powerForRoll,validateD20,requiresPsychicReview} from "../creation/config.mjs";
import {SOCIETY_REGISTRY,societyKeyForRoll} from "../societies/registry.mjs";
import {newMembership} from "../societies/migration.mjs";
import {basicSkillForAttribute} from "../data/derived-capabilities.mjs";
import {identifyPower} from "../powers/registry.mjs";
import {initialPoints} from "../powers/rules.mjs";
import {canPurchase} from "../creation/purchases.mjs";
import {catalogId,CATALOG_NAMESPACE} from "../items/catalog.mjs";

export function generationOptions(input={}){
  const options={...POLICY.defaults,...input};
  options.societyMode=input.societyMode??(options.society?"random":"none");
  if(!["none","random","choose"].includes(options.societyMode))throw Error(tr("Opción de sociedad no válida."));
  if(options.societyMode==="choose"&&!Object.hasOwn(SOCIETY_REGISTRY,options.societyKey)&&options.societyKey!=="custom")throw Error(tr("Elige una sociedad válida."));
  options.society=options.societyMode!=="none";
  for(const [key,choices] of [["securityClearance",CLEARANCE_CODES],["service",{"":null,...SERVICES}],["competence",POLICY.competence],["role",NPC_ROLES]])
    if(!Object.hasOwn(choices,options[key]))throw Error(trHTML`Opción de generación no válida: ${key}`);
  if(!Number.isInteger(options.quantity)||options.quantity<1||options.quantity>POLICY.maxQuantity)throw Error(trHTML`Cantidad permitida: 1–${POLICY.maxQuantity}.`);
  if(!Number.isSafeInteger(options.cloneNumber)||options.cloneNumber<1)throw Error(tr("El clon debe ser un entero positivo."));
  if(![-1,0,1].includes(options.disposition))throw Error(tr("Disposición de Token no válida."));
  for(const key of ["useCitizenId","basicEquipment","randomEquipment","mutation","society","sameProfile"])if(typeof options[key]!=="boolean")throw Error(trHTML`Opción no válida: ${key}`);
  const preset=NPC_EQUIPMENT_PRESETS.troubleshooter;
  if(options.basicEquipment&&(options.role!==preset.role||Object.keys(CLEARANCE_CODES).indexOf(options.securityClearance)<Object.keys(CLEARANCE_CODES).indexOf(preset.minimumClearance)))
    throw Error(tr("El equipo básico requiere rol Esclarecedor y nivel Rojo o superior; no es un uniforme genérico de PNJ."));
  return options;
}

/** One native d20 per Attribute. Competence offsets are an explicitly non-official heuristic. */
export async function generateProfile(defaults,options,rollD20){
  const system=structuredClone(defaults),offset=POLICY.competence[options.competence].attributeAdjustment;
  for(const [key,attribute] of Object.entries(system.attributes)){
    attribute.value=key==="mutantPower"&&!options.mutation?0:Math.max(1,Math.min(20,validateD20(await rollD20())+offset));
  }
  for(const [group,skills] of Object.entries(system.skills))for(const skill of Object.values(skills))skill.value=basicSkillForAttribute(system.attributes[group].value);
  // This stays a no-op until verified Service mappings and an explicit heuristic amount exist.
  for(const path of POLICY.serviceSkillBonuses[options.service]??[]){
    const [group,key]=path.split(".");const skill=system.skills[group]?.[key];if(skill)skill.value=Math.min(14,skill.value+POLICY.serviceSkillIncrease);
  }
  system.securityClearance=options.securityClearance;system.service=options.service;system.cloneNumber=options.cloneNumber;
  system.identity.useCitizenId=options.useCitizenId;system.npc.role=options.role;system.npc.gmNotes=String(options.notes??"");system.credits=0;
  if(options.mutation){const power=identifyPower(powerForRoll(validateD20(await rollD20())));system.mutantPower.name=power.label;system.mutantPower.key=power.key;}
  system.mutantPower.points=initialPoints(system.attributes.mutantPower.value);
  if(options.society){
    const key=options.societyMode==="choose"?options.societyKey:societyKeyForRoll(validateD20(await rollD20()));
    system.secretSociety=newMembership(key,{name:String(options.societyCustomName??""),joinedAt:Date.now()});
    if(requiresPsychicReview(key))system.secretSociety.notes=tr("El DJ debe verificar que el Poder Mutante sea apropiado para Psiónicos. No se modifica automáticamente.");
  }
  // NPC society "Otra" remains for GM selection; psychic compatibility is reviewed by the GM, never fabricated.
  return system;
}

export function randomEquipmentEligible(item,clearance){
  const flags=item.flags?.[CATALOG_NAMESPACE]??{};
  return !!catalogId(item)&&["weapon","armor","equipment"].includes(item.type)&&flags.randomAssignable!==false
    &&!!(item.system.securityClearance||flags.startingPurchase)&&canPurchase(item,clearance);
}
export async function selectNPCEquipment(entries,options,randomIndex){
  const selected=options.basicEquipment?NPC_EQUIPMENT_PRESETS.troubleshooter.catalogIds.map(id=>{
    const item=entries.find(item=>catalogId(item)===id);if(!item)throw Error(trHTML`Falta el objeto del compendio: ${id}`);return {item,assigned:true};
  }):[];
  if(options.randomEquipment){
    const candidates=entries.filter(item=>randomEquipmentEligible(item,options.securityClearance)&&!selected.some(row=>catalogId(row.item)===catalogId(item)));
    for(let i=0;i<POLICY.randomEquipmentCount&&candidates.length;i++)selected.push({item:candidates.splice(await randomIndex(candidates.length),1)[0],assigned:false});
  }
  return selected;
}
export function uniqueNPCIdentity(system,options,usedNames,randomIndex){
  const base=String(options.name??"").trim()||POLICY.names[randomIndex(POLICY.names.length)];
  system.identity.sector=normalizeIdentityText(options.sector)||Array.from({length:3},()=>POLICY.sectorAlphabet[randomIndex(POLICY.sectorAlphabet.length)]).join("");
  let suffix=0,name;
  do{
    const personal=suffix?`${base}${suffix+1}`:base;
    system.identity.name=normalizeIdentityText(personal);
    name=buildCitizenId(system,personal);suffix++;
  }while(usedNames.has(name.toLocaleUpperCase()));
  usedNames.add(name.toLocaleUpperCase());return name;
}
