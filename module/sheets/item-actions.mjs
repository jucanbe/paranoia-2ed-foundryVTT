import {tr} from "../i18n/index.mjs";
import { LABELS } from "./labels.mjs";

function ownedItem(sheet, target) {
  return sheet.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
}

export async function editItem(event, target) {
  const item = ownedItem(this, target);
  if (item && this.isEditable) await item.sheet.render({force: true});
}

export async function createItem(event, target) {
  const type = target.dataset.itemType;
  const names={...LABELS.newItems,robotProgram:tr("Nuevo programa / tarjeta"),robotPeripheral:tr("Nuevo periférico")};
  if (!this.isEditable || !Object.hasOwn(names, type)) return;
  const [item] = await this.actor.createEmbeddedDocuments("Item", [{name: names[type], type}]);
  if (item) await item.sheet.render({force: true});
}

export async function deleteItem(event, target) {
  const item = ownedItem(this, target);
  if (!item || !this.isEditable) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: {title: LABELS.deleteTitle}, content: `<p>${LABELS.deletePrompt}</p>`,
    yes: {label: LABELS.yes}, no: {label: LABELS.no}
  });
  if (confirmed && this.isEditable) await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
}

const quantityUpdates=new Map();
export async function changeQuantity(event,target){
  const item=ownedItem(this,target),delta=Number(target.dataset.delta);
  if(!item||!this.isEditable||![1,-1].includes(delta))return;
  const previous=quantityUpdates.get(item.uuid)??Promise.resolve();
  const task=previous.catch(()=>{}).then(async()=>{
    if(!this.isEditable||!this.actor.items.has(item.id))return;
    const quantity=item.system.quantity;
    if(!Number.isInteger(quantity))return;
    await item.update({"system.quantity":Math.max(0,quantity+delta)});
  });
  quantityUpdates.set(item.uuid,task);
  try{await task;}catch(error){ui.notifications.error(error.message);}finally{if(quantityUpdates.get(item.uuid)===task)quantityUpdates.delete(item.uuid);}
}
