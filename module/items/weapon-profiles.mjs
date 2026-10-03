import {tr} from "../i18n/index.mjs";
/** Ammunition configures an attack; selecting a profile never buys or consumes Items. */
export function weaponProfileUpdate(system,id){
  const profile=system.ammunitionProfiles?.find(p=>p.id===id);
  if(!profile)throw Error(tr("Perfil de munición desconocido."));
  const update={"system.ammunitionProfile":id};
  for(const key of ["weaponCategory","damageNumber","damageNotation","range","maxRangeMeters","area","burstCapable"]){
    if(Object.hasOwn(profile,key))update[`system.${key}`]=profile[key];
  }
  for(const [key,value]of Object.entries(profile.sourceDetails??{}))update[`system.sourceDetails.${key}`]=value;
  return update;
}
export async function selectWeaponProfile(event,target){
  if(!this.item.isOwner||!this.isEditable)throw Error(tr("No puedes modificar esta arma."));
  await this.item.update(weaponProfileUpdate(this.item.system,target.dataset.profile));
}
