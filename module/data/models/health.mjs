import {HEALTH_STATES} from "../../health/rules.mjs";
import {textField} from "./fields.mjs";
export function healthFields(){
  const {SchemaField,StringField,BooleanField,NumberField}=foundry.data.fields;
  const time=()=>new NumberField({required:true,nullable:true,initial:null});
  const round=()=>new NumberField({required:true,nullable:true,initial:null,integer:true,min:0});
  const bool=()=>new BooleanField({required:true,initial:false});
  return new SchemaField({
    status:new StringField({required:true,blank:false,initial:"healthy",choices:Object.keys(HEALTH_STATES)}),notes:textField(),
    stunned:bool(),stunCombatId:textField(),stunnedAtRound:round(),stunnedUntilRound:round(),
    woundedAt:time(),treated:bool(),treatedAt:time(),treatmentNotes:textField(),
    incapacitatedAt:time(),lastHourlyCheckAt:time(),equipmentDestroyed:bool(),lastDamageId:textField(),
    wounds:new foundry.data.fields.ArrayField(new foundry.data.fields.ObjectField({required:true,nullable:false}),{required:true,initial:[]})
  });
}
