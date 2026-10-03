import {documentText,preserveTranslatedFields} from "../i18n/documents.mjs";
import {tr} from "../i18n/index.mjs";
import {ITEM_LABELS as L,ITEM_CLEARANCES,WEAPON_CATEGORIES,PROTECTION_TYPES,EQUIPMENT_CATEGORIES,ITEM_SKILLS,armorCode} from "../items/config.mjs";
import {SOURCE_DETAIL_LABELS,SOURCE_DETAIL_NUMBERS} from "../data/models/source-details.mjs";
import {GUIDANCE,COUNTERMEASURES} from "../vehicles/rules.mjs";
import {PERIPHERALS} from "../robots/rules.mjs";
import {protectionEntries,protectionCode} from "../items/protection.mjs";
import {protectionAction} from "../items/protection-dialog.mjs";
import {repairDialog} from "../combat/optional/repairs.mjs";
import {enabled} from "../combat/optional/settings.mjs";
import {selectWeaponProfile} from "../items/weapon-profiles.mjs";

/** Type-specific field groups share V14's standard document form and image picker. */
export class SimpleItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS={classes:["paranoia-sheet","paranoia-item"],position:{width:600,height:760},window:{resizable:true},form:{submitOnChange:true,closeOnSubmit:false},actions:{addProtection:protectionAction,editProtection:protectionAction,removeProtection:protectionAction,repairWeapon:async function(){try{await repairDialog(this.item);}catch(error){ui.notifications.error(error.message);}}}};
  static PARTS={body:{template:"systems/paranoia-2-edition/templates/item-sheet.hbs",scrollable:[".p2-item-editor"]}};
  static {this.DEFAULT_OPTIONS.actions.selectWeaponProfile=selectWeaponProfile;}

  get title(){return documentText(this.item);}

  _processFormData(event,form,formData){return preserveTranslatedFields(this.item,super._processFormData(event,form,formData));}

  async _prepareContext(options){
    const context=await super._prepareContext(options), system=this.item.system;
    const hasArmamentTable=this.item.type==="weapon"&&!!system.sourceDetails?.weaponTypeCode;
    const tableFields=new Set(["areaRadiusMeters","chargeTurns","tableRecharge","tableNotes"]);
    const field=(key,kind="text",label=L[key],choices)=>{
      const value=documentText(this.item,`system.${key}`,foundry.utils.getProperty(system,key));
      const disabled=!game.user.isGM&&((key==="ammoCurrent"&&enabled("ammunition"))||(key==="malfunctioned"&&enabled("malfunctions")));
      const result={disabled,path:`system.${key}`,label,value,isNumber:kind==="number",isBoolean:kind==="boolean",isMultiline:kind==="textarea"};
      if(choices){
        result.choices=Object.entries(["category","priceUnit"].includes(key)?choices:{"":L.none,...choices}).map(([id,label])=>({id,label,selected:id===value}));
        // Keep legacy free-text skills selected until the owner explicitly replaces them.
        if(value&&!Object.hasOwn(choices,value))result.choices.push({id:value,label:`${value} (${L.legacy})`,selected:true});
      }
      return result;
    };
    const coded=map=>Object.fromEntries(Object.entries(map).map(([key,v])=>[key,`${v.code} · ${v.label}`]));
    const sections=[];
    if(["robotProgram","robotPeripheral"].includes(this.item.type)){
      const fields=this.item.type==="robotProgram"?[field("skill","text",tr("Habilidad"),Object.fromEntries(ITEM_SKILLS.map(s=>[s.key,s.label]))),field("level","number",tr("Nivel / coste de memoria")),field("storageMode","text",tr("Almacenamiento"),{resident:tr("Residente"),card:tr("Tarjeta")}),field("active","boolean",tr("Instalado / tarjeta insertada")),field("source","text",tr("Origen"))]:[field("category","text",tr("Periférico"),PERIPHERALS),field("operational","boolean",tr("Operativo"))];
      sections.push({label:this.item.type==="robotProgram"?tr("Programa — un sector por nivel"):tr("Periférico"),fields:[...fields,field("description","textarea",tr("Descripción")),field("notes","textarea",tr("Notas"))]});
      return {...context,labels:L,name:documentText(this.item),img:this.item.img,sections};
    }
    const common=[field("securityClearance","text",L.clearance,Object.fromEntries(ITEM_CLEARANCES.map(k=>[k,L.clearances[k]]))),field("quantity","number"),field("experimental","boolean"),field("assigned","boolean"),...(["weapon","armor"].includes(this.item.type)?[field("integrated","boolean",tr("Integrado en robot / vehículo"))]:[])];
    if(this.item.type==="weapon")sections.push({label:L.weaponData,fields:[field("weaponCategory","text",L.weaponCategory,coded(WEAPON_CATEGORIES)),field("skill","text",L.skill,Object.fromEntries(ITEM_SKILLS.map(s=>[s.key,`${s.groupLabel} · ${s.label}`]))),field("damageNumber","number"),field("range"),...common]});
    if(this.item.type==="armor")sections.push({label:L.armor,fields:[field("equipped","boolean"),...common],armorCode:protectionCode(system),protections:protectionEntries(system).map((p,index)=>({...p,index,label:PROTECTION_TYPES[p.type]?.label??p.type})),armor:true});
    if(this.item.type==="equipment")sections.push({label:L.equipment,fields:[field("category","text",L.category,EQUIPMENT_CATEGORIES),field("model"),...common,field("consumable","boolean")]});
    sections.push({label:tr("Precio"),fields:[field("price","number"),field("priceUnit","text",L.priceUnit,{item:tr("Objeto"),bottle:tr("Botella"),meter:tr("Metro")}),...(system.priceUnit==="meter"?[field("length","number")]:[])]});
    sections.push({label:L.description,fields:[field("description","textarea")]});
    sections.push({label:L.specialRules,fields:[field("specialRules","textarea"),field("notes","textarea")]});
    const advanced=[field("assignmentNotes","textarea"),field("weight","number"),field("sourceReference"),field("experimentalNotes","textarea")];
    if(this.item.type!=="armor")advanced.push(field("charges.value","number",`${L.charges} · ${L.current}`),field("charges.max","number",`${L.charges} · ${L.maximum}`));
    if(this.item.type==="equipment")advanced.push(field("uses.value","number",`${L.uses} · ${L.current}`),field("uses.max","number",`${L.uses} · ${L.maximum}`));
    if(this.item.type==="weapon")advanced.push(field("ammunition.capacity","number",`${L.ammunition}`),field("ammunition.notes","textarea",L.ammunition),field("reloadInfo","textarea"),field("area","boolean"),field("areaNotes","textarea"),field("weaponType","text",`${L.weaponType} (${L.legacy})`),field("damageNotation","text",L.damageNotation));
    if(this.item.type==="armor")advanced.push(field("armorType","text",`${L.armorType} (${L.legacy})`));
    sections.push({label:L.optional,optional:true,fields:advanced.filter(f=>!hasArmamentTable||f.path!=="system.damageNotation")});
    if(this.item.type==="weapon")sections.push({label:tr("Combate opcional · datos verificados / DJ"),optional:true,fields:[field("maxRangeMeters","number",tr("Alcance máximo (m; vacío si desconocido)")),field("burstCapable","boolean",tr("Admite ráfagas (solo si verificado)")),field("burstMaxTargets","number",tr("Máximo de objetivos")),field("burstMaxTargetSeparationMeters","number",tr("Separación máxima (m)")),field("burstAmmoCost","number",tr("Consumo de ráfaga (vacío: manual)")),field("ammoCurrent","number",tr("Disparos en carga actual (vacío: manual)")),field("ammoType","text",tr("ID de catálogo de munición compatible")),field("reloadTurns","number",tr("Turnos de recarga (vacío: 1)")),field("drawTurnsRequired","number",tr("Turnos para acceder al arma (vacío: 1)")),field("requiredArm","text",tr("Brazo necesario"),{unspecified:tr("Sin especificar"),left:tr("Izquierdo"),right:tr("Derecho"),both:tr("Ambos"),none:tr("Ninguno / integrada")}),field("reliabilityType","text",tr("Fiabilidad"),{normal:tr("Normal"),experimental:tr("Experimental"),trulyExperimental:tr("Verdaderamente experimental")}),field("malfunctionThreshold","number",tr("Umbral manual de avería")),field("malfunctioned","boolean",tr("Averiada")),field("malfunctionShot","text",tr("Disparo que provoca avería"),{manual:tr("Decide el DJ"),resolve:tr("Resuelve disparo"),cancel:tr("Cancela disparo")}),field("repairSkill","text",tr("Habilidad de reparación"),Object.fromEntries(ITEM_SKILLS.map(s=>[s.key,s.label]))),field("repairable","boolean",tr("Admite reparación normal"))],repair:this.item.parent?.isOwner&&enabled("repairs")&&system.malfunctioned});
    if(system.sourceDetails)sections.push({label:tr("Datos de la fuente (sin automatización)"),optional:true,fields:Object.entries(SOURCE_DETAIL_LABELS).filter(([key])=>!hasArmamentTable||!tableFields.has(key)).map(([key,label])=>field(`sourceDetails.${key}`,SOURCE_DETAIL_NUMBERS.includes(key)?"number":"text",label,key==="guidance"?GUIDANCE:key==="countermeasure"?COUNTERMEASURES:undefined))});
    if(this.item.type==="weapon"&&system.sourceDetails?.weaponTypeCode)sections.splice(1,0,{label:tr("Tabla de armamento · Anexo B"),fields:[field("damageNotation"),field("sourceDetails.areaRadiusMeters","number",tr("RAc · radio de acción (m)")),field("sourceDetails.chargeTurns","number",tr("Cg · carga (turnos)")),field("sourceDetails.tableRecharge","number",tr("RCg · recarga (tabla)")),field("sourceDetails.tableNotes","text",tr("Notas: r ráfagas · cf cono frontal · cg cargador · a área"))]});
    const ammunitionProfiles=(system.ammunitionProfiles??[]).map(p=>({...p,label:documentText(this.item,`system.ammunitionProfiles.${system.ammunitionProfiles.indexOf(p)}.label`,p.label),selected:p.id===system.ammunitionProfile,damage:p.damageNotation||"?",radius:p.sourceDetails?.areaRadiusMeters??"?"}));
    return {...context,labels:L,name:documentText(this.item),img:this.item.img,sections,ammunitionProfiles,experimental:system.experimental,assigned:system.assigned,optionalExpanded:this.element?.querySelector("details")?.open??false};
  }
}
