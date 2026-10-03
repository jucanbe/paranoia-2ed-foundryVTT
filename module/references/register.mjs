/** Public read access only for initial imports from the skills reference pack. */
export function preparePublicSkillImport(document,data){
  if(document.pack||data.flags?.["paranoia-2-edition"]?.referencePack!=="skills"
    ||!data._stats?.compendiumSource?.startsWith("Compendium.paranoia-2-edition.skills."))return;
  document.updateSource({ownership:{...data.ownership,default:2},
    pages:(data.pages??[]).map(page=>({...page,ownership:{...page.ownership,default:-1}}))});
}
export function registerReferenceImports(){Hooks.on("preCreateJournalEntry",preparePublicSkillImport);}
