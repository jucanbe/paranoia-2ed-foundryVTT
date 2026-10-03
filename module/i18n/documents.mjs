import {CATALOGUE_KEYS} from "./catalogue-keys.mjs";
import {messageKey} from "./index.mjs";
const get=(object,path)=>path.split(".").reduce((value,key)=>value?.[key],object);
function translationFields(document){
  const id=document?.flags?.["paranoia-2-edition"]?.catalogId;
  if(CATALOGUE_KEYS[id])return CATALOGUE_KEYS[id];
  const parent=document?.parent,parentId=parent?.flags?.["paranoia-2-edition"]?.catalogId;
  const index=parent?.items?.contents?.findIndex(item=>item.id===document.id)??-1;
  if(!CATALOGUE_KEYS[parentId]||index<0)return {};
  const prefix="items."+index+".";
  return Object.fromEntries(Object.entries(CATALOGUE_KEYS[parentId]).filter(([key])=>key.startsWith(prefix)).map(([key,value])=>[key.slice(prefix.length),value]));
}
/** Translate unchanged catalogue fields; custom names and text remain verbatim. */
export function documentText(document,path="name",value=get(document,path)){
  const expected=translationFields(document)[path];
  if(!expected||typeof value!=="string"||messageKey(value)!==expected)return value;
  const translated=globalThis.game?.i18n?.localize?.(expected);
  return translated&&translated!==expected?translated:value;
}
/** Displayed translations must not become edits when another form field is submitted. */
export function preserveTranslatedFields(document,submission){
  for(const path of Object.keys(translationFields(document))){
    const submitted=get(submission,path),original=get(document,path);
    if(typeof original!=="string"||submitted!==documentText(document,path,original))continue;
    const parts=path.split("."),key=parts.pop(),target=parts.reduce((v,k)=>v?.[k],submission);
    if(target&&submitted!==original)target[key]=original;
  }
  return submission;
}

/** Copy a reference view without changing fields on the document or translating custom edits. */
export function documentView(document,path="",value=path?get(document,path):(document.toObject?.()??document)){
  if(typeof value==="string")return documentText(document,path,value);
  if(Array.isArray(value))return value.map((next,index)=>documentView(document,path+"."+index,next));
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,next])=>[key,documentView(document,path?path+"."+key:key,next)]));
  return value;
}
