import {localizedRecord} from "../i18n/index.mjs";
import {SERVICE_SKILLS} from "../creation/config.mjs";
import {STARTER_IDS} from "../items/catalog.mjs";
/** Foundry convenience generation rules; NOT source rules or an official NPC table. */
export const NPC_ROLES=Object.freeze(localizedRecord({civilian:"Civil",troubleshooter:"Esclarecedor",security:"Seguridad",bureaucrat:"Burócrata",technician:"Técnico",soldier:"Soldado",traitor:"Traidor",other:"Otro"}));
export const NPC_GENERATION_CONFIG=Object.freeze(localizedRecord({
  defaults:{securityClearance:"red",service:"SSI",competence:"standard",cloneNumber:1,quantity:1,role:"other",disposition:0,useCitizenId:true,basicEquipment:false,randomEquipment:false,mutation:false,society:false,sameProfile:false},
  maxQuantity:20,
  // Applied to the original 1d20 once, then clamped 1–20. Clearance never adjusts Attributes.
  competence:{minor:{label:"Secundario",attributeAdjustment:-2},standard:{label:"Normal",attributeAdjustment:0},competent:{label:"Competente",attributeAdjustment:2},elite:{label:"Élite",attributeAdjustment:4}},
  // No verified mappings exist yet. Never manufacture Service skills; reuse verified additions later.
  serviceSkillBonuses:SERVICE_SKILLS,
  serviceSkillIncrease:0,
  names:["MARTA","LUIS","ANA","DAVID","ROSA","PABLO","ELENA","JUAN","INES","MARIO","LARA","BRUNO"],
  sectorAlphabet:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  randomEquipmentCount:1
}));
export const NPC_EQUIPMENT_PRESETS=Object.freeze(localizedRecord({troubleshooter:{label:"Equipo básico de Esclarecedor",role:"troubleshooter",minimumClearance:"red",catalogIds:STARTER_IDS}}));
