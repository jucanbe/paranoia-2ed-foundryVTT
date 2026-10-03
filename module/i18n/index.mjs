/** Stable message IDs. Original strings are fallbacks, never persisted identifiers. */
export function messageKey(source){
  let hash=2166136261;
  for(const character of String(source)){hash^=character.codePointAt(0);hash=Math.imul(hash,16777619);}
  return `P2.Text.m${(hash>>>0).toString(36)}`;
}
export function tr(source){
  if(typeof source!=="string"||!source)return source;
  const language=globalThis.game?.i18n;
  if(!language?.localize)return source;
  const key=messageKey(source),translated=language.localize(key);
  return translated===key?source:translated;
}
const translateText=source=>source.replace(/^(\s*)([\s\S]*?)(\s*)$/,(_all,before,text,after)=>before+tr(text)+after);
/** Localizes only source-code fragments, before inserting any user-provided values. */
export function staticMarkup(source){
  return source.split(/(<[^>]*>)/g).map(part=>part.startsWith("<")?
    part.replace(/((?:title|placeholder|aria-label)=")([^"]*)(")/g,(_all,start,text,end)=>start+tr(text)+end):translateText(part)).join("");
}
export function trHTML(strings,...values){
  const source=strings.map((part,index)=>part+(index<values.length?"\uE000"+index+"\uE001":"")).join("");
  const translate=part=>part.split(/(\uE000\d+\uE001)/g).map(text=>text.startsWith("\uE000")?text:translateText(text)).join("");
  const translated=source.split(/(<[^>]*>)/g).map(part=>part.startsWith("<")?part.replace(/((?:title|placeholder|aria-label)=")([^"]*)(")/g,(_all,start,text,end)=>start+translate(text)+end):translate(part)).join("");
  return translated.replace(/\uE000(\d+)\uE001/g,(_all,index)=>String(values[Number(index)]));
}
/** Getter-backed labels avoid capturing Spanish while ES modules load before i18n. */
export function localizedRecord(source){
  if(!source||typeof source!=="object")return source;
  const result=Array.isArray(source)?[]:{};
  for(const [key,value]of Object.entries(source)){
    const nested=value&&typeof value==="object"?localizedRecord(value):value;
    Object.defineProperty(result,key,{enumerable:true,configurable:false,get:()=>typeof nested==="string"?tr(nested):nested});
  }
  return result;
}
export function registerLocalization(){
  Handlebars.registerHelper("p2t",source=>tr(source));
}
