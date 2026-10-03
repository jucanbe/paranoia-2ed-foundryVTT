import {localizedRecord,tr,trHTML} from "../i18n/index.mjs";
/** Source-backed vehicle rules only. Speeds, repair difficulty and accidents are GM decisions. */
export const VEHICLE_CATEGORIES=localizedRecord({tracked:"Oruga",autocar:"Autocoche",hovercraft:"Aerodeslizador",helicopter:"Helicóptero",roboplane:"Roboavión",robotransport:"Robotransporte",custom:"Personalizado"});
export const CONTROL_MODES=localizedRecord({manual:"Manual",autopilot:"Piloto automático",electronicBrain:"Cerebro electrónico"});
export const CREW_ROLES=localizedRecord({driver:"Piloto",gunner:"Artillero",commander:"Comandante",passenger:"Pasajero",other:"Otro"});
export const VEHICLE_STATES=localizedRecord({operational:"Operativo",cosmeticDamage:"Daño insignificante",lightDamage:"Daño leve",seriousDamage:"Daño grave",destroyed:"Destruido",vaporized:"Vaporizado"});
export const VEHICLE_RESULTS=localizedRecord({noEffect:"Sin efecto",stunned:"Daño insignificante",wounded:"Daño leve",incapacitated:"Daño grave",dead:"Destruido",vaporized:"Vaporizado"});
export const SYSTEM_STATES=localizedRecord({operational:"Operativo",damaged:"Dañado",disabled:"Desactivado",destroyed:"Destruido"});
export const SYSTEM_TYPES=localizedRecord({propulsion:"Propulsión",control:"Dirección / control",autopilot:"Piloto automático",electronicBrain:"Cerebro electrónico",sensors:"Sensores",communication:"Comunicaciones",weapons:"Armamento",defense:"Defensas",lifeSupport:"Soporte vital",cargo:"Carga",other:"Otro"});
export const GUIDANCE=localizedRecord({"":"Sin especificar",none:"Ninguno",heatSeeker:"Termo-rastreador",radioSeeker:"Radio-rastreador",radar:"Por radar",radarRemote:"Teledirigido por radar",laserGuided:"Láser dirigido"});
export const COUNTERMEASURES=localizedRecord({"":"Ninguna",smoke:"Humo antiláser",antiMissile:"Láser antimisil",interferenceA:"Interferencia A",interferenceR:"Interferencia R",interferenceGauss:"Interferencia Gauss",interferenceT:"Interferencia T"});
export function vehicleTransition(health,result){
  const map={noEffect:"operational",stunned:"cosmeticDamage",wounded:"lightDamage",incapacitated:"seriousDamage",dead:"destroyed",vaporized:"vaporized"};
  if(!Object.hasOwn(map,result))throw Error(tr("Resultado de daño no válido."));
  const order=Object.keys(VEHICLE_STATES),status=order.indexOf(map[result])>order.indexOf(health.status)?map[result]:health.status;
  // No supplied rule accumulates two light hits into serious vehicle damage.
  return {...health,kind:"vehicle",status,stunned:false};
}
export function vehicleBlocked(health){return ["seriousDamage","destroyed","vaporized"].includes(health?.status)?trHTML`Vehículo ${VEHICLE_STATES[health.status].toLowerCase()}: requiere adjudicación del DJ.`:"";}
export function currentMovement(vehicle){return vehicle.movement.modes.find(m=>m.key===vehicle.movement.currentMode)??null;}
export function movementSummary(vehicle){const m=currentMovement(vehicle);return m?`${m.label||m.key} · ${m.maxSpeed==null?tr("velocidad sin especificar"):`${m.maxSpeed} ${m.unit}`}`:tr("Movimiento sin configurar (DJ)");}
export function capacityWarning(vehicle){
  const mode=currentMovement(vehicle),capacity=mode?.capacity??vehicle.capacity;
  if(capacity==null)return tr("Capacidad no especificada; adjudicación del DJ.");
  const total=capacity+(vehicle.temporaryPassengerCapacity??0);
  return vehicle.crew.length>total?trHTML`Ocupación ${vehicle.crew.length} / ${total}: sobrecarga; requiere autorización del DJ.`:"";
}
export function smokeProtection(vehicle,category){return vehicle?.defense?.smokeActive&&category==="laser"?5:0;}
export function controlAvailable(vehicle,mode=vehicle.control.currentMode){return !!vehicle.control[`${mode}Available`];}
export function assertHumanSalvo(operators){
  const seen=new Set();for(const operator of Object.values(operators)){if(operator==="electronicBrain")continue;if(!operator)throw Error(tr("Selecciona un artillero para cada arma."));if(seen.has(operator))throw Error(tr("Cada artillero manual solo puede disparar un arma por turno."));seen.add(operator);}
}
