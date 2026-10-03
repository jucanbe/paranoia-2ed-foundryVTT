import {CitizenData} from "./citizen.mjs";
import {textField} from "./fields.mjs";
import {POWER_REGISTRY,identifyPower} from "../../powers/registry.mjs";
import {NPC_ROLES} from "../../npc/config.mjs";

/** Same rules and persisted mechanical paths as Characters, without PC creation/history. */
export class NPCData extends CitizenData {
  static identityFields(){return {...super.identityFields(),useCitizenId:new foundry.data.fields.BooleanField({required:true,initial:true})};}
  static mutantPowerFields(){return {...super.mutantPowerFields(),key:new foundry.data.fields.StringField({required:true,blank:true,initial:"",choices:["",...Object.keys(POWER_REGISTRY)]})};}
  static defineSchema(){
    const {SchemaField,StringField}=foundry.data.fields;
    const fields=super.defineSchema();
    return {...fields,npc:new SchemaField({role:new StringField({required:true,initial:"other",choices:Object.keys(NPC_ROLES)}),tags:textField(),
      appearance:textField(),personality:textField(),objective:textField(),behavior:textField(),gmNotes:textField(),activeWeaponId:textField()})};
  }
  async _preCreate(data,options,user){
    if(!user.isGM)return false;
    const power=POWER_REGISTRY[this.mutantPower.key]??identifyPower(this.mutantPower.name);
    this.parent.updateSource({"system.mutantPower.key":power?.key??"","system.mutantPower.name":power?.label??this.mutantPower.name});
    return super._preCreate(data,options,user);
  }
  async _preUpdate(changes,options,user){
    if(!user.isGM){ui.notifications.warn("Solo el DJ puede editar este PNJ.");return false;}
    const expanded=foundry.utils.expandObject(changes),power=expanded.system?.mutantPower;
    if(power&&Object.hasOwn(power,"key"))power.name=POWER_REGISTRY[power.key]?.label??"";
    else if(power&&Object.hasOwn(power,"name"))power.key=identifyPower(power.name)?.key??"";
    Object.keys(changes).forEach(key=>delete changes[key]);Object.assign(changes,expanded);
    return super._preUpdate(changes,options,user);
  }
}
