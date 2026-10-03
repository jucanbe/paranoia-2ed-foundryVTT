import {tr} from "../i18n/index.mjs";
/** Small V14 forms shared by the builder and structured-row editors. All text is escaped. */
export const escape=value=>foundry.utils.escapeHTML(String(value??""));
export function fieldHTML(spec,value){
  const [name,label,kind="text",choices]=spec,key=escape(name),v=value??"";
  const input=choices?`<select name="${key}" ${kind==="multi"?'multiple size="8"':""}>${Object.entries(choices).map(([id,label])=>`<option value="${escape(id)}" ${(kind==="multi"?Array.isArray(v)&&v.includes(id):id===String(v))?"selected":""}>${escape(label)}</option>`).join("")}</select>`:kind==="check"?`<input type="checkbox" name="${key}" ${v?"checked":""}>`:kind==="area"?`<textarea name="${key}" rows="3">${escape(v)}</textarea>`:`<input name="${key}" type="${kind==="number"?"number":"text"}" ${kind==="number"?'step="any"':""} value="${escape(v)}">`;
  return `<label>${escape(label)}${input}</label>`;
}
export function readFields(form,specs){return Object.fromEntries(specs.map(([name,,kind])=>{const el=form.elements[name];return [name,kind==="multi"?[...el.selectedOptions].map(o=>o.value):kind==="check"?el.checked:kind==="number"?(el.value.trim()?Number(el.value):null):el.value];}));}
export async function fieldsDialog(title,specs,values={}, {intro="",back=false,confirm=tr("Guardar"),extra=""}={}){
  const result=await foundry.applications.api.DialogV2.wait({window:{title},position:{width:640},classes:["p2-vehicle-dialog"],content:`${intro}<div class="p2-vehicle-form">${specs.map(s=>fieldHTML(s,values[s[0]])).join("")}</div>${extra}`,
    buttons:[...(back?[{action:"back",label:tr("Atrás"),callback:(_e,b)=>({back:true,values:readFields(b.form,specs)})}]:[]),{action:"save",label:confirm,callback:(_e,b)=>({values:readFields(b.form,specs)})},{action:"cancel",label:tr("Cancelar"),callback:()=>null}]});
  // DialogV2 returns the action key when a button callback is nullish.
  return result&&typeof result==="object"&&result.values?result:null;
}
export const skillChoices=skills=>Object.fromEntries(skills.map(s=>[s.key,s.label]));
