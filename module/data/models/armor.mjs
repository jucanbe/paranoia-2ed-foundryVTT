import {LegacyDataModel,legacyField} from "./legacy.mjs";
import { textField } from "./fields.mjs";
import {commonItemFields,optionalNumber} from "./item-fields.mjs";
import {PROTECTION_TYPES} from "../../items/config.mjs";
import {protectionCode,getProtectionFor} from "../../items/protection.mjs";

export class ArmorData extends LegacyDataModel {
  static defineSchema() {
    return {
      ...commonItemFields(),
      integrated:new foundry.data.fields.BooleanField({required:true,initial:false}),
      armorType: textField(),
      equipped:new foundry.data.fields.BooleanField({required:true,initial:false}),
      protectionType:new foundry.data.fields.StringField({required:true,blank:true,initial:"",choices:["",...Object.keys(PROTECTION_TYPES)]}),
      protectionValue:optionalNumber()
      ,protections:new foundry.data.fields.ArrayField(new foundry.data.fields.SchemaField({type:new foundry.data.fields.StringField({required:true,choices:Object.keys(PROTECTION_TYPES),initial:"laser"}),value:new foundry.data.fields.NumberField({required:true,initial:0,min:0})}),{required:true,initial:[]})
    };
  }
  get armorCode(){return protectionCode(this);}
  getProtectionFor(category,options){return getProtectionFor(this,category,options);}
  static migrateData(source){
    // Only recognize an explicit old armor code; never infer statistics from an Item name.
    const match=typeof source.armorType==="string"?source.armorType.trim().match(/^(PP|L|P|C|B|E|T)(\d+(?:\.\d+)?)$/):null;
    if(!source.protectionType&&match){
      source.protectionType=Object.keys(PROTECTION_TYPES).find(key=>PROTECTION_TYPES[key].code===match[1]);
      source.protectionValue??=Number(match[2]);
    }
    if(!Object.hasOwn(source,"protections")&&source.protectionType&&source.protectionValue!=null)source.protections=[{type:source.protectionType,value:source.protectionValue}];
    if(Array.isArray(source.protections)){
      if(!Object.hasOwn(source,"protectionType"))source.protectionType=source.protections[0]?.type??"";
      if(!Object.hasOwn(source,"protectionValue"))source.protectionValue=source.protections[0]?.value??null;
    }
    return super.migrateData(source);
  }
}
