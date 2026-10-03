import {LegacyDataModel,legacyField} from "./legacy.mjs";
import { numberField, textField, valueField } from "./fields.mjs";
import {healthFields} from "./health.mjs";
import {societyFields} from "./society.mjs";
import {developmentFields} from "./development.mjs";
import {SKILLS} from "../../development/rules.mjs";
import {entry as creditEntry,ledger as creditLedger,creationLedger} from "../../credits/rules.mjs";
import {ItemCatalog,STARTER_IDS,catalogId} from "../../items/catalog.mjs";
import {purchaseSummary} from "../../creation/purchases.mjs";
import {migrateMembership} from "../../societies/migration.mjs";
import {migratePower} from "../../migrations/legacy.mjs";
import {enabled as optionalCombatEnabled} from "../../combat/optional/settings.mjs";
import {healedWounds} from "../../combat/optional/rules.mjs";

import {powerModifier} from "../../powers/rules.mjs";
import {migrateHealth} from "../../health/rules.mjs";
import { CLEARANCE_CODES, normalizeIdentityText, synchronizeCitizenIdentity, synchronizeLinkedTokenNames } from "../../actors/identity.mjs";
import { BASIC_SKILL_ATTRIBUTES, basicSkillForAttribute, carryingCapacityForStrength, bonusForAttribute } from "../derived-capabilities.mjs";

export const SECURITY_CLEARANCES = Object.freeze(Object.keys(CLEARANCE_CODES));

/**
 * Shared Character/NPC source schema and transient preparation. Actor.items is the inventory.
 * Attribute values and skill values default to 0 as unconfigured placeholders.
 * skills.<attribute>.<skill>.value stores the learned value, not a calculated total.
 * Capacities and Basic Skills are prepared in memory, never persisted as editable values.
 * Each skill is a schema so later modifier fields can be added beside value.
 * privateNotes and secretSociety are not access-controlled by this model.
 */
export class CitizenData extends LegacyDataModel {
  static identityFields(){return {name:textField(),sector:textField()};}
  static mutantPowerFields(){
    return {name:textField(),key:textField(),notes:textField(),registered:new foundry.data.fields.BooleanField({required:true,initial:false}),
      learned:new foundry.data.fields.ArrayField(new foundry.data.fields.SchemaField({
        id:textField(),key:textField(),source:textField(),societyLevel:numberField({integer:true,min:1,initial:1}),membershipId:textField(),learnedAt:numberField({min:0})
      }),{required:true,initial:[]}),
      points:new foundry.data.fields.SchemaField({value:numberField({nullable:true,initial:null,integer:true,min:0}),max:numberField({nullable:true,initial:null,integer:true,min:0})})};
  }
  static defineSchema() {
    const { SchemaField, StringField } = foundry.data.fields;
    return {
      legacyData:legacyField(),
      identity: new SchemaField(this.identityFields()),
      securityClearance: new StringField({
        required: true, nullable: false, blank: false,
        choices: SECURITY_CLEARANCES, initial: "infrared"
      }),
      service: textField(),
      development:developmentFields(),
      developmentEnabled:new foundry.data.fields.BooleanField({required:true,initial:false}),
      securityProgress:new SchemaField({
        successfulMissions:numberField({integer:true,min:0}),
        requirementSatisfied:new foundry.data.fields.BooleanField({required:true,initial:false}),
        countedMissionIds:new foundry.data.fields.ArrayField(textField(),{required:true,initial:[]})
      }),
      clearanceProgressionEnabled:new foundry.data.fields.BooleanField({required:true,initial:false}),
      coverService: textField(),

      cloneNumber: numberField({integer: true, min: 1, initial: 1}),

      attributes: new SchemaField({
        strength: valueField(),
        endurance: valueField(),
        agility: valueField(),
        dexterity: valueField(),
        perception: valueField(),
        cynicism: valueField(),
        mechanicalTalent: valueField(),
        mutantPower: valueField()
      }),
      skills: new SchemaField({
        agility: new SchemaField({
          ancientMeleeWeapons: valueField(),
          energySword: valueField(),
          grenade: valueField(),
          neuralWhip: valueField(),
          brawling: valueField(),
          club: valueField()
        }),
        cynicism: new SchemaField({
          flattery: valueField(),
          fastTalk: valueField(),
          con: valueField(),
          forgery: valueField(),
          interrogation: valueField(),
          intimidation: valueField(),
          spuriousLogic: valueField(),
          oratory: valueField(),
          psychology: valueField(),
          suggestion: valueField()
        }),
        dexterity: new SchemaField({
          fieldWeapons: valueField(),
          energyWeapons: valueField(),
          projectileWeapons: valueField(),
          ancientFirearms: valueField(),
          laserWeapons: valueField(),
          artillery: valueField(),
          fieldArtillery: valueField(),
          missileArtillery: valueField()
        }),
        mechanicalTalent: new SchemaField({
          autoMechanics: valueField(),
          hovercraft: valueField(),
          autocars: valueField(),
          helicopter: valueField(),
          trackedVehicle: valueField(),
          roboplane: valueField(),
          robotics: valueField(),
          condorRoboplane: valueField(),
          robodoctor: valueField(),
          robomop: valueField(),
          robomechanic: valueField(),
          robosoldier: valueField(),
          robotransport: valueField(),
          systemsEngineering: valueField()
        }),
        perception: new SchemaField({
          dataAnalysis: valueField(),
          biochemotherapy: valueField(),
          dataSearch: valueField(),
          demolition: valueField(),
          electronicEngineering: valueField(),
          geneticEngineering: valueField(),
          mechanicalEngineering: valueField(),
          nuclearEngineering: valueField(),
          chemicalEngineering: valueField(),
          medicine: valueField(),
          security: valueField(),
          stealth: valueField(),
          survival: valueField(),
          surveillance: valueField()
        })
      }),
      mutantPower: new SchemaField(this.mutantPowerFields()),
      secretSociety: societyFields(),
      health: healthFields(),
      credits: numberField(),
      creditTrackingEnabled:new foundry.data.fields.BooleanField({required:true,initial:false}),
      creditLedger:new SchemaField({history:new foundry.data.fields.ArrayField(new foundry.data.fields.ObjectField({required:true,nullable:false}),{required:true,initial:[]})}),
      publicNotes: textField(),
      privateNotes: textField()
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const strength=this.attributes.strength.value+powerModifier(this.parent,"attribute","strength");
    this.carryingCapacity = carryingCapacityForStrength(strength);
    this.damageBonus = bonusForAttribute(strength);
    this.stamina = bonusForAttribute(this.attributes.endurance.value);
    this.basicSkills = Object.fromEntries(BASIC_SKILL_ATTRIBUTES.map(key => [
      key, basicSkillForAttribute(this.attributes[key].value+powerModifier(this.parent,"attribute",key))
    ]));
  }

  static migrateData(source){
    // Migrations also run on partial updates: a notes-only edit must not reset health.
    if(source.health&&Object.hasOwn(source.health,"status"))source.health=migrateHealth(source.health);
    if(source.secretSociety)source.secretSociety=migrateMembership(source.secretSociety);
    if(source.mutantPower)source.mutantPower=migratePower(source.mutantPower);
    return super.migrateData(source);
  }

  async _preCreate(data, options, user) {
    if (await super._preCreate(data, options, user) === false) return false;
    if(!user.isGM&&(this.credits!==0||this.creditLedger.history.length||this.creditTrackingEnabled)){
      ui.notifications.warn("Crea el personaje mediante el asistente; solo el DJ puede conceder créditos.");return false;
    }
    if(!user.isGM&&(this.development.available||this.development.lifetimeEarned||this.development.lifetimeSpent||this.development.lifetimeRefunded||this.development.history.length||this.development.restricted||this.development.eligibleSkills.length||this.development.usage.length||this.developmentEnabled)){
      ui.notifications.warn("Solo el DJ puede conceder PD posteriores a aventuras.");return false;
    }
    if(!user.isGM&&(this.securityProgress.successfulMissions!==0||this.securityProgress.requirementSatisfied||this.securityProgress.countedMissionIds.length||this.clearanceProgressionEnabled)){
      ui.notifications.warn("Solo el DJ puede conceder progreso de ascenso.");return false;
    }
    const changes = {system: {identity: {
      name: normalizeIdentityText(this.identity.name || data.name),
      sector: normalizeIdentityText(this.identity.sector)
    }}};
    synchronizeCitizenIdentity(this.parent, changes);
    this.parent.updateSource(changes);
  }

  async _preUpdate(changes, options, user) {
    if (await super._preUpdate(changes, options, user) === false) return false;
    const expanded=foundry.utils.expandObject(changes);
    const pool=expanded.system?.mutantPower?.points;
    if(pool){
      const next={...this.mutantPower.points,...pool};
      if(next.value!=null&&next.max!=null&&next.value>next.max){
        ui.notifications.warn("Los PM actuales no pueden superar el máximo. Reduce primero los PM actuales.");return false;
      }
    }
    if(!user.isGM){
      const incomingSystem=expanded.system??{};
      if(Array.isArray(expanded.items))for(const source of expanded.items){
        const prior=this.parent.items.get(source._id);if(prior?.type!=="weapon")continue;
        for(const [key,rule] of [["ammoCurrent","ammunition"],["malfunctioned","malfunctions"]])if(optionalCombatEnabled(rule)&&((source.system?.[key]!==undefined&&source.system[key]!==prior.system[key])||(options.recursive===false&&source.system?.[key]===undefined)))return false;
      }
      if(expanded.system&&options.recursive===false&&(!Object.hasOwn(incomingSystem,"credits")||!Object.hasOwn(incomingSystem,"creditLedger"))){
        ui.notifications.warn("La sustitución de datos debe conservar el saldo y su historial económico.");return false;
      }
      const firstCreation=options.paranoiaCharacterCreation&&!this.creation?.complete&&this.credits===0&&this.creditLedger.history.length===0&&incomingSystem.creation?.complete===true;
      if(Object.hasOwn(incomingSystem,"-=credits")||Object.hasOwn(incomingSystem,"-=creditLedger")||Object.hasOwn(incomingSystem,"-=creditTrackingEnabled"))return false;
      if(incomingSystem.creditTrackingEnabled!==undefined&&incomingSystem.creditTrackingEnabled!==this.creditTrackingEnabled)return false;
      if(incomingSystem.credits!==undefined&&incomingSystem.credits!==this.credits&&!firstCreation){ui.notifications.warn("Usa el servicio de créditos; el saldo no se edita directamente.");return false;}
      if(firstCreation&&(typeof incomingSystem.credits!=="number"||incomingSystem.credits>100||!Number.isFinite(incomingSystem.credits)))return false;
      if(firstCreation){
        // Reconstruct the initial economy from trusted catalogue prices, never a player-supplied ledger.
        if(!Array.isArray(expanded.items))return false;
        const entries=await ItemCatalog.entries(),selections={};
        const existing=new Set(this.parent.items.map(i=>i.id));
        for(const item of expanded.items){
          if(existing.has(item._id))continue;
          const id=catalogId(item);
          if(item.system?.assigned){if(!STARTER_IDS.includes(id))return false;continue;}
          const quantity=item.system?.priceUnit==="meter"?item.system.length:item.system?.quantity;
          if(!Number.isSafeInteger(quantity)||quantity<=0)return false;
          selections[id]=(selections[id]??0)+quantity;
        }
        const purchases=purchaseSummary(selections,entries,incomingSystem.securityClearance??this.securityClearance,false);
        if(purchases.remaining!==incomingSystem.credits)return false;
        changes["system.creditLedger"]=creationLedger(this.parent,purchases,{id:foundry.utils.randomID(),userId:user.id,timestamp:Date.now(),worldTime:game.time.worldTime});
      }
      if(incomingSystem.creditLedger!==undefined&&!firstCreation){
        const prior=this.toObject().creditLedger,next=foundry.utils.mergeObject(prior,incomingSystem.creditLedger,{inplace:false});
        if(JSON.stringify(prior)!==JSON.stringify(next)){ui.notifications.warn("Solo el DJ puede guardar transacciones de créditos.");return false;}
      }
      if(Object.hasOwn(incomingSystem,"-=development")||Object.hasOwn(incomingSystem,"-=developmentEnabled"))return false;
      if(incomingSystem.developmentEnabled!==undefined&&incomingSystem.developmentEnabled!==this.developmentEnabled)return false;
      if(incomingSystem.development!==undefined){
        const prior=this.toObject().development,next=foundry.utils.mergeObject(prior,incomingSystem.development,{inplace:false});
        const beforeUsage=prior.usage,afterUsage=next.usage;delete prior.usage;delete next.usage;
        if(JSON.stringify(prior)!==JSON.stringify(next)){ui.notifications.warn("Solo el DJ coordinador puede guardar concesiones y gastos de PD.");return false;}
        if(JSON.stringify(beforeUsage)!==JSON.stringify(afterUsage)){
          if(!Array.isArray(afterUsage)||new Set(afterUsage.map(r=>r.skillKey)).size!==afterUsage.length)return false;
          const keys=new Set([...beforeUsage,...afterUsage].map(r=>r.skillKey));let increments=0;
          for(const key of keys){
            if(!SKILLS.some(s=>s.key===key))return false;
            const before=beforeUsage.find(r=>r.skillKey===key)?.count??0,after=afterUsage.find(r=>r.skillKey===key)?.count??0;
            if(!Number.isSafeInteger(after)||after<before||after>before+1)return false;
            increments+=after-before;
          }
          if(increments!==1)return false;
        }
      }
      if((this.creation?.complete||this.development.history.length)&&(Object.hasOwn(incomingSystem,"-=skills")||incomingSystem.skills!==undefined)){
        const previous=this.toObject().skills,proposed=foundry.utils.mergeObject(previous,incomingSystem.skills??{},{inplace:false});
        if(Object.hasOwn(incomingSystem,"-=skills")||JSON.stringify(previous)!==JSON.stringify(proposed)){
          ui.notifications.warn("Usa «Mejorar habilidades» para gastar PD. Las correcciones manuales corresponden al DJ.");return false;
        }
      }
      const initialCreation=options.paranoiaCharacterCreation&&!this.creation?.complete;
      if(Object.hasOwn(incomingSystem,"-=securityClearance")||Object.hasOwn(incomingSystem,"-=securityProgress")||Object.hasOwn(incomingSystem,"-=clearanceProgressionEnabled"))return false;
      if(this.creation?.complete&&(Object.hasOwn(incomingSystem,"-=creation")||Object.hasOwn(incomingSystem.creation??{},"-=complete")))return false;
      if((incomingSystem.securityClearance!==undefined&&incomingSystem.securityClearance!==this.securityClearance&&!initialCreation)||
        (incomingSystem.clearanceProgressionEnabled!==undefined&&incomingSystem.clearanceProgressionEnabled!==this.clearanceProgressionEnabled)||
        ((incomingSystem.creation===null||incomingSystem.creation?.complete===false)&&this.creation?.complete)){
        ui.notifications.warn("Solo el DJ puede modificar el Nivel de Seguridad y su seguimiento.");return false;
      }
      if(incomingSystem.securityProgress!==undefined){
        const previous=this.toObject().securityProgress;
        const next=foundry.utils.mergeObject(previous,incomingSystem.securityProgress,{inplace:false});
        if(JSON.stringify(previous)!==JSON.stringify(next)){ui.notifications.warn("Solo el DJ puede registrar progreso de ascenso.");return false;}
      }
      const proposedPowers=expanded.system?.mutantPower;
      if(proposedPowers&&(Object.hasOwn(proposedPowers,"learned")||Object.hasOwn(proposedPowers,"-=learned"))){
        if(Object.hasOwn(proposedPowers,"-=learned")||JSON.stringify(proposedPowers.learned)!==JSON.stringify(this.toObject().mutantPower.learned)){
          ui.notifications.warn("Solo el DJ puede conceder poderes aprendidos.");return false;
        }
      }
      if(expanded.system&&Object.hasOwn(expanded.system,"-=secretSociety"))return false;
      if(expanded.system?.secretSociety!==undefined&&!options.paranoiaCharacterCreation){
        const previous=this.toObject().secretSociety;
        const proposed=foundry.utils.mergeObject(previous,expanded.system.secretSociety,{inplace:false});
        delete previous.notes;delete proposed.notes;
        if(JSON.stringify(previous)!==JSON.stringify(proposed)){
          ui.notifications.warn("Solo el DJ puede modificar afiliación, rango o misiones.");return false;
        }
      }
      if(expanded.system&&Object.hasOwn(expanded.system,"-=clones"))return false;
      if(expanded.system?.clones!==undefined){
        const prior=this.toObject().clones;
        const proposed=foundry.utils.mergeObject(prior,expanded.system.clones,{inplace:false});
        if(JSON.stringify(prior)!==JSON.stringify(proposed)){
          ui.notifications.warn("Solo el DJ puede modificar el historial de clones.");return false;
        }
      }
      const incoming=expanded.system?.health;
      if(expanded.system&&Object.hasOwn(expanded.system,"-=health"))return false;
      if(incoming!==undefined){
        const prior=this.toObject().health;
        const proposed=foundry.utils.mergeObject(prior,incoming,{inplace:false});
        delete prior.notes;delete proposed.notes;
        if(JSON.stringify(prior)!==JSON.stringify(proposed)){
          ui.notifications.warn("Solo el DJ puede modificar el estado de salud o aplicar tratamiento.");return false;
        }
      }
    }
    // Explicit GM raw/debug balance edits and CloneService corrections also keep an audit.
      if(user.isGM&&expanded.system?.health?.status==="healthy"&&!Object.hasOwn(expanded.system.health,"wounds"))changes["system.health.wounds"]=healedWounds(this.health.wounds);
    if(user.isGM&&!options.paranoiaCreditTransaction&&!options.paranoiaCharacterCreation&&expanded.system?.credits!==undefined&&expanded.system.credits!==this.credits){
      const h=creditEntry(this.credits,expanded.system.credits-this.credits,{id:foundry.utils.randomID(),userId:user.id,worldTime:game.time.worldTime,type:"adjustment",reason:"Edición directa del saldo por el DJ"});
      changes["system.creditLedger"]={history:[...creditLedger(this.parent).history,h]};
    }
    options.paranoiaPreviousHealth=this.health.status;
    synchronizeCitizenIdentity(this.parent, changes);
    if (changes.name && changes.name !== this.parent.name) options.paranoiaPreviousName = this.parent.name;
  }

  _onUpdate(changes, options, userId) {
    super._onUpdate(changes, options, userId);
    if(options.paranoiaPreviousHealth&&options.paranoiaPreviousHealth!==this.health.status)
      Hooks.callAll("paranoiaHealthChanged",this.parent,{previous:options.paranoiaPreviousHealth,current:this.health.status,userId});
    if (changes.name && options.paranoiaPreviousName && userId === game.user.id && !this.parent.isToken) {
      synchronizeLinkedTokenNames(this.parent, options.paranoiaPreviousName)
        .catch(error => console.error("paranoia-2-edition | Could not synchronize linked token names", error));
    }
  }
}
