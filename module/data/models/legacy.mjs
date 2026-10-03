/** Preserve undeclared legacy fields before Foundry's schema cleaning drops them. */
export class LegacyDataModel extends foundry.abstract.TypeDataModel {
  static migrateData(source,options){
    const fields=this.schema?.fields;
    if(fields){
      const unknown={};
      const collect=(value,schema,prefix="")=>{
        for(const [key,data] of Object.entries(value??{})){
          if(key.startsWith("-="))continue;
          const path=prefix?`${prefix}.${key}`:key,field=schema[key];
          if(!field){unknown[path]=data;continue;}
          if(field.fields&&data&&typeof data==="object")collect(data,field.fields,path);
          else if(field.element?.fields&&Array.isArray(data))data.forEach((entry,index)=>collect(entry,field.element.fields,`${path}.${index}`));
        }
      };
      collect(source,fields);
      if(Object.keys(unknown).length)source.legacyData={...(source.legacyData??{}),...unknown};
    }
    return super.migrateData(source,options);
  }
}
export const legacyField=()=>new foundry.data.fields.ObjectField({required:true,nullable:false,initial:{}});
