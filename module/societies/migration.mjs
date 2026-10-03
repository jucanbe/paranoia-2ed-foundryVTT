import {tr} from "../i18n/index.mjs";
import {identifySociety,SOCIETY_REGISTRY} from "./registry.mjs";
export function migrateRank(rank){
  if(rank&&typeof rank==="object")return {...rank};
  const text=String(rank??"").trim();
  return {level:/^\d+$/.test(text)&&Number.isSafeInteger(Number(text))?Number(text):1,label:/^\d+$/.test(text)?"":text};
}
/** Also called on partial document updates: never add unrelated defaults to a patch. */
export function migrateMembership(source){
  const result=typeof source==="string"?{name:source}:structuredClone(source??{});
  if(result.societyKey){
    const known=identifySociety(result.societyKey);
    if(known)result.societyKey=known.key;
    else if(result.societyKey!=="custom"){
      result.custom={...(result.custom??{}),name:result.custom?.name||result.name||result.societyKey};
      result.societyKey="custom";
    }
  }
  if(result.favors)result.favors=result.favors.map(f=>({...f,title:f.title??"",type:f.type??"favor",status:f.status??(f.resolved?"resolved":"pending")}));
  if(Object.hasOwn(result,"rank"))result.rank=migrateRank(result.rank);
  if(result.membershipHistory)result.membershipHistory=result.membershipHistory.map(migrateMembership);
  if(Object.hasOwn(result,"name")&&result.name){
    const known=identifySociety(result.name);
    if(!result.societyKey){
      result.societyKey=known?.key??"custom";
      if(!known)result.custom={...(result.custom??{}),name:result.name};
    }
    // A canonical key is the source of the name. Unknown names remain in custom data.
    if(known?.key===result.societyKey||result.custom?.name===result.name)result.name="";
  }
  return result;
}
export function newMembership(key,{name="",joinedAt=null}={}){
  if(key!=="custom"&&!Object.hasOwn(SOCIETY_REGISTRY,key))throw Error(tr("Sociedad desconocida."));
  return {id:globalThis.foundry?.utils?.randomID?.()??crypto.randomUUID(),societyKey:key,name:"",custom:{name:key==="custom"?name:"",beliefs:"",objectives:"",allies:"",enemies:"",benefits:"",obligations:"",notes:""},rank:{level:1,label:""},status:"active",notes:"",joinedAt,exposed:false,missions:[],contacts:[],favors:[]};
}
export function replaceMembership(previous,member){
  const old=migrateMembership(previous),history=structuredClone(old.membershipHistory??[]);
  if(old.societyKey||old.name||old.notes){
    const {membershipHistory,gmData,...snapshot}=old;
    history.push({...snapshot,id:snapshot.id||"legacy",status:old.status==="active"?"former":old.status??"former"});
  }
  return {...member,membershipHistory:history,gmData:old.gmData??null};
}
