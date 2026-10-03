import {CitizenData,SECURITY_CLEARANCES} from "./citizen.mjs";
import {cloneFields} from "./clones.mjs";
export {SECURITY_CLEARANCES};
/** PC-only workflows extend the shared citizen mechanics without changing saved paths. */
export class CharacterData extends CitizenData {
  static defineSchema(){
    const {SchemaField,BooleanField}=foundry.data.fields;
    return {...super.defineSchema(),creation:new SchemaField({complete:new BooleanField({required:true,initial:false})}),clones:cloneFields()};
  }
}
