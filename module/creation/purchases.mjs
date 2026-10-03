import {tr,trHTML} from "../i18n/index.mjs";
import {CLEARANCE_CODES} from "../actors/identity.mjs";
export const STARTING_CREDITS=100;
const levels=Object.keys(CLEARANCE_CODES);
export function canPurchase(item,clearance,override=false){
  const required=[item.system.securityClearance,item.flags?.["paranoia-2-edition"]?.purchaseMinimumClearance].filter(Boolean);
  return override||required.every(level=>levels.indexOf(level)>=0&&levels.indexOf(clearance)>=levels.indexOf(level));
}
export function purchaseSummary(selections,entries,clearance,override=false){
  let total=0;
  const rows=[];
  for(const [id,quantity] of Object.entries(selections)){
    if(!Number.isSafeInteger(quantity)||quantity<0)throw new Error(tr("Cantidad de compra no válida."));
    if(!quantity)continue;
    const item=entries.find(e=>e.flags?.["paranoia-2-edition"]?.catalogId===id);
    if(!item?.flags?.["paranoia-2-edition"]?.startingPurchase||typeof item.system.price!=="number"||!Number.isFinite(item.system.price)||item.system.price<0)throw new Error(trHTML`Precio de catálogo no disponible: ${id}`);
    if(!canPurchase(item,clearance,override))throw new Error(tr("Una compra supera el nivel de seguridad. Retírala o solicita autorización del DJ."));
    const cost=item.system.price*quantity;
    total+=cost;
    rows.push({id,name:item.name,quantity,cost,unit:item.system.priceUnit==="meter"?tr("m"):"",item});
  }
  if(!Number.isFinite(total))throw new Error(tr("Coste no válido."));
  const remaining=STARTING_CREDITS-total;
  if(remaining<0&&!override)throw new Error(tr("No hay suficientes créditos (100 créditos iniciales)."));
  return {total,remaining,rows};
}
