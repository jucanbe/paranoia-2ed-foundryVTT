import {trHTML,tr} from "../i18n/index.mjs";
export const CATALOG_NAMESPACE="paranoia-2-edition";
export const CATALOG_PACKS=["weapons","armor","equipment"].map(id=>`${CATALOG_NAMESPACE}.${id}`);
export const STARTER_IDS=["standard-troubleshooter-uniform","laser-pistol","laser-charge"];
export const catalogId=item=>item.flags?.[CATALOG_NAMESPACE]?.catalogId;

/** Always resolves system packs, never development-world Items. */
export class ItemCatalog {
  static _entries;
  static invalidate(){this._entries=undefined;}
  static async entries(){
    if(!this._entries)this._entries=this._load().catch(error=>{this.invalidate();throw error;});
    return [...await this._entries];
  }
  static async _load(){
    const documents=[];
    for(const id of CATALOG_PACKS){
      const pack=game.packs.get(id);
      if(!pack||pack.documentName!=="Item")throw new Error(trHTML`Compendio requerido no disponible: ${id}`);
      documents.push(...await pack.getDocuments());
    }
    const ids=new Set();
    for(const item of documents){
      const id=catalogId(item);
      if(!id||ids.has(id))throw new Error(tr("Identificador de catálogo ausente o duplicado."));
      ids.add(id);
    }
    return documents;
  }
  static async getById(id){
    const item=(await this.entries()).find(item=>catalogId(item)===id);
    if(!item)throw new Error(trHTML`Objeto de catálogo no disponible: ${id}`);
    return item;
  }
}
