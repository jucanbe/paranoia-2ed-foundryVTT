import {localizedRecord} from "../i18n/index.mjs";
/** Render-time localized presentation labels; persisted paths remain English. */
export const LABELS = localizedRecord({
  character: "Personaje", secret: "Secreto", sheet: "Ficha de personaje",
  createCharacter: "Crear personaje", coverService: "Servicio de cobertura", registeredMutation: "Mutación registrada",
  name: "Nombre", clearance: "Nivel", sector: "Sector", service: "Servicio", clone: "Clon",
  citizenId: "Identificador ciudadano", identityHint: "El identificador se actualiza al editar sus componentes. ??? indica un sector pendiente.",
  legacyIdentity: "El nombre anterior se conserva hasta que introduzcas el nombre personal.",
  attributes: "Atributos", capabilities: "Capacidades", skills: "Habilidades",
  carryingCapacity: "Acarreo", damageBonus: "Bonus de Daño", stamina: "Aguante",
  basicSkill: "HB", pending: "Dato o cálculo pendiente", basicSkillLegend: "HB: Habilidad Básica · Valores calculados, no editables",
  weapons: "Armas", armor: "Armadura", equipment: "Equipo", weapon: "Arma",
  weaponType: "Tipo", skill: "Habilidad", damageNumber: "Nº Daño", range: "Distancia",
  weaponCategory: "Categoría de arma", area: "Arma de área", damageNotation: "Notación de daño original",
  experimental: "Experimental", description: "Descripción", armorType: "Tipo de armadura",
  quantity: "Cantidad", yes: "Sí", no: "No", empty: "Sin objetos registrados.",
  edit: "Abrir / editar", delete: "Eliminar", create: "Añadir", actions: "Acciones",
  deleteTitle: "Eliminar objeto", deletePrompt: "¿Eliminar este objeto del inventario?",
  secretNotice: "INFORMACIÓN SECRETA — Solo para el propietario y el DJ",
  secretSociety: "Sociedad Secreta", rank: "Nivel", mutantPower: "Poder Mutante",
  health: "Estado de Salud", status: "Estado", credits: "Créditos", notes: "Notas",
  publicNotes: "Notas públicas", privateNotes: "Notas privadas", save: "Guardar",
  newItems: {weapon: "Nueva arma", armor: "Nueva armadura", equipment: "Nuevo equipo"},
  clearances: {
    infrared: "Infrarrojo", red: "Rojo", orange: "Naranja", yellow: "Amarillo",
    green: "Verde", blue: "Azul", indigo: "Índigo", violet: "Violeta", ultraviolet: "Ultravioleta"
  },
  attributeNames: {
    strength: "Fuerza", endurance: "Resistencia", agility: "Agilidad", dexterity: "Destreza",
    perception: "Percepción", cynicism: "Cinismo", mechanicalTalent: "Talento Mecánico", mutantPower: "Poder Mutante"
  },
  skillNames: {
    agility: {
      ancientMeleeWeapons: "Armas Blancas Antiguas", energySword: "Espada Energética",
      grenade: "Granada", neuralWhip: "Neurálgico", brawling: "Pelea", club: "Porra"
    },
    cynicism: {
      flattery: "Adulación", fastTalk: "Charlatanería", con: "Embaucamiento", forgery: "Falsificación",
      interrogation: "Interrogatorio", intimidation: "Intimidación", spuriousLogic: "Lógica Espuria",
      oratory: "Oratoria", psychology: "Psicología", suggestion: "Sugestión"
    },
    dexterity: {
      fieldWeapons: "Armas de Campaña", energyWeapons: "Armas Energéticas", projectileWeapons: "Armas de Proyectil", ancientFirearms: "Armas de Fuego Antiguas",
      laserWeapons: "Armas Láser", artillery: "Artillería", fieldArtillery: "Artillería de Campaña", missileArtillery: "Artillería de Misiles"
    },
    mechanicalTalent: {
      autoMechanics: "Automecánica", hovercraft: "Aerodeslizador", autocars: "Autocoche", helicopter: "Helicóptero",
      trackedVehicle: "Oruga", roboplane: "Roboavión", robotics: "Robótica", condorRoboplane: "Roboavión Cóndor",
      robodoctor: "Robodoctor", robomop: "Robofregona", robomechanic: "Robomecánico", robosoldier: "Robosoldado",
      robotransport: "Robotransporte", systemsEngineering: "Ingeniería de Sistemas"
    },
    perception: {
      dataAnalysis: "Análisis de Datos", biochemotherapy: "Bioquimioterapia", dataSearch: "Búsqueda de Datos",
      demolition: "Demolición", electronicEngineering: "Ingeniería Electrónica", geneticEngineering: "Ingeniería Genética",
      mechanicalEngineering: "Ingeniería Mecánica", nuclearEngineering: "Ingeniería Nuclear", chemicalEngineering: "Ingeniería Química",
      medicine: "Medicina", security: "Seguridad", stealth: "Sigilo", survival: "Supervivencia", surveillance: "Vigilancia"
    }
  }
});
