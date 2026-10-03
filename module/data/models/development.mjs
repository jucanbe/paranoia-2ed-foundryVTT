import {numberField,textField} from "./fields.mjs";
export function developmentFields(){
  const {SchemaField,BooleanField,ArrayField,ObjectField}=foundry.data.fields;
  const total=()=>numberField({integer:true,min:0});
  return new SchemaField({available:total(),lifetimeEarned:total(),lifetimeSpent:total(),lifetimeRefunded:total(),
    restricted:new BooleanField({required:true,initial:false}),eligibleSkills:new ArrayField(textField(),{required:true,initial:[]}),
    usage:new ArrayField(new SchemaField({skillKey:textField(),count:total()}),{required:true,initial:[]}),
    history:new ArrayField(new ObjectField({required:true,nullable:false}),{required:true,initial:[]})});
}
