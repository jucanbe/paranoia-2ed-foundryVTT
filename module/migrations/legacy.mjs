import {identifyPower} from "../powers/registry.mjs";
import {initialRecord} from "../treason/rules.mjs";
/** Patch-safe normalization: the original power path remains canonical. */
export function migratePower(value){
  const source=typeof value==="string"?{name:value}:structuredClone(value??{});
  if(source.name){const power=identifyPower(source.name);if(power){source.name=power.label;source.key=power.key;}}
  if(Array.isArray(source.learned))source.learned=source.learned.map(p=>({...p,key:identifyPower(p.key??p.name)?.key??p.key??p.name}));
  return source;
}
export function legacyTreason(system={},type){
  const legacy=system.treason??system.treasonPoints??system.legacyData?.treason??system.legacyData?.treasonPoints;
  const points=typeof legacy==="object"?legacy?.points??legacy?.value:legacy;
  if(!Number.isSafeInteger(points)||points<0||points>20)return null;
  return {...initialRecord(type),...(typeof legacy==="object"?legacy:{}),points};
}
