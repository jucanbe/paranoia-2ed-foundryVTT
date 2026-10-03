import {tr,trHTML} from "../i18n/index.mjs";
import {PROTECTION_TYPES} from "./config.mjs";
import {protectionEntries} from "./protection.mjs";
export async function protectionAction(_e,button){
  if(!this.isEditable)return;
  const entries=protectionEntries(this.item.system),index=Number(button.dataset.index);
  if(button.dataset.action==="removeProtection")entries.splice(index,1);
  else{
    const current=entries[index]??{type:"laser",value:0},values=await foundry.applications.api.DialogV2.wait({window:{title:tr("Protección de armadura")},content:trHTML`<label>Tipo<select name="type">${Object.entries(PROTECTION_TYPES).map(([key,p])=>`<option value="${key}" ${key===current.type?"selected":""}>${p.code} · ${p.label}</option>`).join("")}</select></label><label>Valor<input type="number" name="value" min="0" step="any" value="${current.value}"></label>`,buttons:[{action:"apply",label:tr("Guardar protección"),callback:(_e,b)=>Object.fromEntries(new FormData(b.form))},{action:"cancel",label:tr("Cancelar")}]});
    if(!values?.type)return;const value=Number(values.value);if(!Number.isFinite(value)||value<0)throw Error(tr("Protección no válida."));
    if(entries.some((p,i)=>i!==index&&p.type===values.type))throw Error(tr("Ya existe una entrada para ese tipo de protección."));
    const next={type:values.type,value};if(Number.isInteger(index)&&index>=0&&index<entries.length)entries[index]=next;else entries.push(next);
  }
  await this.item.update({"system.protections":entries,"system.protectionType":entries[0]?.type??"","system.protectionValue":entries[0]?.value??null});
}
