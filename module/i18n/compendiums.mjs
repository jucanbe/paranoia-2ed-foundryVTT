import {tr} from "./index.mjs";
import {documentText} from "./documents.mjs";
/** Client-only index display/search; pack documents and persisted names stay canonical. */
export function registerCompendiumLocalization(){
  Hooks.once("ready",()=>{
    for(const pack of game.packs){
      if(!pack.collection.startsWith("paranoia-2-edition."))continue;
      pack.metadata.label=tr(pack.metadata.label);
      const getIndex=pack.getIndex.bind(pack),originals=new WeakMap();
      pack.getIndex=async(options={})=>{
        const index=await getIndex({...options,fields:[...(options.fields??[]),"flags.paranoia-2-edition.catalogId","flags.paranoia-2-edition.societyKey"]});
        for(const entry of index){
          if(!originals.has(entry))originals.set(entry,entry.name);
          const original=originals.get(entry);
          entry.name=pack.documentName==="JournalEntry"?tr(original):documentText(entry,"name",original);
        }
        return index;
      };
    }
  });
  const translateReference=(app,element)=>{
    if(!app.document?.pack?.startsWith("paranoia-2-edition.societies"))return;
    const root=element instanceof HTMLElement?element:element?.[0];
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      if(node.parentElement.closest("textarea,input,script,style"))continue;
      const value=node.textContent,trimmed=value.trim(),translated=tr(trimmed);
      if(translated!==trimmed)node.textContent=value.replace(trimmed,translated);
    }
  };
  Hooks.on("renderJournalEntryPageTextSheet",translateReference);
  Hooks.on("renderJournalEntrySheet",translateReference);
}
