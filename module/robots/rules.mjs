import {localizedRecord,trHTML,tr} from "../i18n/index.mjs";
import {ITEM_SKILLS,canonicalSkill} from "../items/config.mjs";
export const ROBOT_STATES=Object.freeze(localizedRecord({operational:"Operativo",shortCircuit:"Cortocircuito",lightDamage:"Daño leve",seriousDamage:"Daño grave",destroyed:"Destruido",vaporized:"Vaporizado"}));
export const ROBOT_RESULTS=Object.freeze(localizedRecord({noEffect:"Sin efecto",stunned:"Cortocircuito",wounded:"Daño leve",incapacitated:"Daño grave",dead:"Destruido",vaporized:"Vaporizado"}));
export const RESULT_STATE={noEffect:"operational",stunned:"shortCircuit",wounded:"lightDamage",incapacitated:"seriousDamage",dead:"destroyed",vaporized:"vaporized"};
export const ASIMOV=localizedRecord({functional:"Funcionales",defective:"Defectuosos",absent:"Ausentes"});
export const ROBOT_TYPES=localizedRecord({"":"Personalizado",robodoctor:"Robodoctor",robomechanic:"Robomecánico",robomop:"Robofregona",robosoldier:"Robosoldado",roboguard:"Roboguardia",roboteacher:"Roboprofesor",roboplane:"Roboavión",robopet:"Robomascota",roboclown:"Robopayaso",robocommunicator:"Robocomunicador"});
export const PERIPHERALS=localizedRecord({locomotion:"Locomoción",manipulator:"Manipuladores",sensor:"Sensores",communication:"Comunicaciones",medical:"Instrumental médico",repair:"Herramientas de reparación",other:"Otros"});
export const FIVE_LAWS=localizedRecord(["Obedecer al Ordenador antes que cualquier otra orden.","Obedecer a los humanos si no contradice al Ordenador.","Preservarse, subordinado a las órdenes anteriores.","Proteger a los humanos y cumplir su función programada, subordinado a las leyes anteriores.","Los robots no tienen nivel de seguridad. La programación puede restringir a qué humanos obedecen."]);
export const combatSkill=key=>/^(agility|dexterity)\./.test(canonicalSkill(key));
export function robotModifier(health,key){return health?.status==="lightDamage"&&combatSkill(key)?-4:0;}
export function robotBlocked(health){return ["shortCircuit","seriousDamage","destroyed","vaporized"].includes(health?.status)||health?.stunned?trHTML`El robot está ${ROBOT_STATES[health.status]??tr("en cortocircuito")} y no puede actuar.`:"";}
export function robotTransition(health,result,{combat=null}={}){
  if(!Object.hasOwn(RESULT_STATE,result))throw Error(tr("Resultado de daño no válido."));
  const next={...health};if(result==="noEffect"||health.status==="vaporized")return next;
  if(result==="vaporized")return {...next,status:"vaporized",stunned:false,salvageAvailable:false};
  if(health.status==="destroyed")return next;
  if(health.status==="seriousDamage"&&!["noEffect","stunned"].includes(result))return {...next,status:"destroyed",stunned:false};
  if(result==="stunned")return {...next,status:health.status==="operational"?"shortCircuit":health.status,stunned:true,stunCombatId:combat?.id??"",stunnedUntilRound:combat?combat.round+2:null};
  const status=result==="wounded"&&health.status==="lightDamage"?"seriousDamage":RESULT_STATE[result];
  const order=["operational","shortCircuit","lightDamage","seriousDamage","destroyed","vaporized"];
  return {...next,status:order.indexOf(status)>order.indexOf(health.status)?status:health.status,stunned:false,stunCombatId:"",stunnedUntilRound:null};
}
export function repairedRobot(health){
  if(!["lightDamage","seriousDamage"].includes(health.status))throw Error(tr("Solo se reparan daños leves o graves; no se reconstruyen robots destruidos."));
  return {...health,status:health.status==="seriousDamage"?"lightDamage":"operational",stunned:false,stunCombatId:"",stunnedUntilRound:null};
}
export const activeProgram=item=>item.type==="robotProgram"&&!!item.system.active;
export function programSummary(items,capacity){
  const programs=Array.from(items).filter(activeProgram),skills={};let used=0;
  for(const item of programs){const {level,skill}=item.system;const key=canonicalSkill(skill);
    if(!Number.isInteger(level)||level<0||!ITEM_SKILLS.some(s=>s.key===key))throw Error(tr("Programa sin habilidad o nivel válido."));
    used+=level;const [group,name]=key.split(".");skills[group]??={};skills[group][name]={value:Math.max(skills[group][name]?.value??0,level)};
  }
  return {used,free:capacity==null?null:capacity-used,skills};
}
export function validateMemory(items,capacity,{override=false,previousUsed=0}={}){
  const summary=programSummary(items,capacity);
  if(!override&&summary.used>previousUsed&&(capacity==null||summary.used>capacity))throw Error(tr("Memoria insuficiente: configura capacidad y libera sectores antes de instalar."));
  return summary;
}
export function peripheralWarnings(actor){
  const medical=actor.items.some(i=>i.type==="robotPeripheral"&&i.system.category==="medical"&&i.system.operational);
  return actor.system.skills?.perception?.medicine?.value&&!medical?[tr("Conoce Medicina, pero no consta instrumental/manipuladores médicos adecuados. El DJ decide la capacidad física.")]:[];
}
