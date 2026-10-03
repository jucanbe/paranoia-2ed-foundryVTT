import {localizedRecord,tr} from "../../i18n/index.mjs";
export const COVER={none:0,light:-1,half:-4,nearTotal:-15};
export function healedWounds(wounds){return (wounds??[]).map(w=>w.permanent?w:{...w,active:false});}
export const MOVEMENT_PENALTIES={none:0,walk:0,march:-1,run:-4};
export const RANGE_LABELS=localizedRecord({pointBlank:"Quemarropa",short:"Corta",medium:"Media",long:"Larga",manual:"Sin alcance verificado · DJ"});
export function rangeBand(distance,maxRange){
  if(typeof distance!=="number"||!Number.isFinite(distance)||distance<0)return "manual";
  if(typeof maxRange!=="number"||!Number.isFinite(maxRange)||maxRange<0)return "manual";
  if(distance>maxRange)return "out";
  if(distance<=5)return "pointBlank";
  if(distance<=Math.floor(maxRange/3))return "short";
  if(distance<=Math.floor(2*maxRange/3))return "medium";return "long";
}
export function rangeSkill(value,band){
  if(band==="pointBlank")return value*2;if(band==="medium")return Math.floor(value/2);if(band==="long")return Math.floor(value/4);return value;
}
export function attackTarget({baseValue,targetCount=1,band="manual",cover="none",attackerMovement="none",targetMovement="none",wounded=0,defending=false,gmModifier=0}){
  if(!Number.isInteger(targetCount)||targetCount<1||targetCount>3)throw Error(tr("La ráfaga admite entre uno y tres objetivos."));
  if(!Object.hasOwn(COVER,cover)||!Object.hasOwn(MOVEMENT_PENALTIES,attackerMovement)||!Object.hasOwn(MOVEMENT_PENALTIES,targetMovement))throw Error(tr("Circunstancias opcionales no válidas."));
  if(!Number.isFinite(gmModifier))throw Error(tr("Modificador del DJ no válido."));
  const burstSkill=Math.ceil(baseValue/targetCount),rangedSkill=rangeSkill(burstSkill,band);
  const modifiers={range:rangedSkill-burstSkill,wounded,cover:COVER[cover],movement:MOVEMENT_PENALTIES[attackerMovement]+MOVEMENT_PENALTIES[targetMovement],defenderEvading:defending?-4:0,gmModifier};
  return {baseValue,burstSkill,rangedSkill,band,modifiers,finalTarget:rangedSkill+wounded+modifiers.cover+modifiers.movement+modifiers.defenderEvading+gmModifier};
}
export function malfunctionThreshold(system){
  const type=system.reliabilityType??(system.experimental?"experimental":"normal");
  if(type==="normal")return 20;if(type==="experimental")return 19;
  return system.malfunctionThreshold??null;
}
export function malfunctions(system,die){const threshold=malfunctionThreshold(system);return threshold!=null&&die>=threshold;}
export const LOCATIONS=localizedRecord({arm:"Brazo",leg:"Pierna",chest:"Pecho",abdomen:"Abdomen",head:"Cabeza"});
export const mechanicalWounds=wounds=>(wounds??[]).map(w=>({location:w.location,side:w.side,active:!!w.active,consequence:w.consequence,permanent:!!w.permanent}));
export function woundRestriction(wounds,movement,{weaponArm="unspecified",override=false}={}){
  if(override)return "";const active=wounds.filter(w=>w.active);
  if(active.some(w=>["chest","abdomen"].includes(w.location))&&movement!=="none")return tr("La herida en torso impide desplazarse; requiere excepción del DJ.");
  if(active.some(w=>w.location==="leg")&&["run","sprint","zoom"].includes(movement))return tr("La pierna herida impide carrera y sprint.");
  if(weaponArm!=="none"&&active.some(w=>w.location==="arm"&&(w.side==="unspecified"||weaponArm==="both"||w.side===weaponArm)))return tr("El arma requiere un brazo inutilizado.");
  return "";
}
