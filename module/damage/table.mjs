import {tr} from "../i18n/index.mjs";
/** Only the complete ND 8 example is verified. Add Annex B columns here, never extrapolate. */
export const DAMAGE_TABLE=Object.freeze({8:Object.freeze([
  {min:1,max:4,result:"noEffect"},{min:5,max:9,result:"stunned"},
  {min:10,max:14,result:"wounded"},{min:15,max:18,result:"incapacitated"},{min:19,max:20,result:"dead"}
])});
export function lookupDamage(number,die){
  if(typeof number!=="number"||!Number.isFinite(number)||!Number.isInteger(die)||die<1||die>20)throw Error(tr("ND o tirada de daño no válidos."));
  return DAMAGE_TABLE[number]?.find(row=>die>=row.min&&die<=row.max)?.result??null;
}
