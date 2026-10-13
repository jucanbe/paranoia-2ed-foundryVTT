import {SERVICES,serviceForRoll,validateD20} from "../creation/config.mjs";
/** system.service remains the real affiliation. Legacy values are never discarded. */
export function serviceState(actor){
 const s=actor.system??actor,isSSI=s.service==="SSI";
 const validCover=!!s.coverService&&s.coverService!=="SSI"&&Object.hasOwn(SERVICES,s.coverService);
 return {isSSI,realService:s.service,coverService:s.coverService,needsCoverService:isSSI&&!validCover,invalidCoverService:!!s.coverService&&(!isSSI||!validCover)};
}
export function getApparentService(actor){const s=serviceState(actor);return s.isSSI?(s.needsCoverService?"—":s.coverService):s.realService;}
/** "Otro Servicio": repeat the SAME d20 table when SSI is rolled again. */
export async function rollCoverService(rollD20){const rolls=[];let result;do{const rolled=validateD20(await rollD20());rolls.push(rolled);result=serviceForRoll(rolled);}while(result==="SSI");return {rolled:rolls.at(-1),rolls,result};}
