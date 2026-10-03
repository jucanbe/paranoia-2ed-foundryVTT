# Vehicle system

Implemented and verified on Foundry VTT **14.367**. Vehicles are the fourth Actor type, alongside Characters, NPCs and Robots. No vehicle is represented as an ordinary Equipment Item or given citizen identity/clone fields.

## Model and sheet

`VehicleData` stores identity/model, access clearance, assignment, crew UUID references, normal/temporary capacity, control availability, electronic-brain personality and memory, movement modes, structured systems and flaws, defensive state, damage notes and private GM material. Damage uses `system.health` with an explicit vehicle discriminator so Robot penalties cannot accidentally apply to Vehicles.

The dedicated V14 ActorSheetV2 has normal autosave, native embedded Item handling, Actor/Token crew drops, editable movement/system/flaw rows, and a compact status/armament area. UUID references can be edited; missing/deleted references display safely. Capacity warnings use the current mode's capacity when supplied and do not impose a hard limit. Hidden flaws, programming details, GM notes and surprises are omitted from player sheet context and HTML. This uses Foundry ownership plus sheet visibility, not a new document-security system.

Crew members remain independent Actors. Manual, autopilot and electronic-brain controls are distinct. The brain uses existing Robot Program Items, skill keys and memory validation. Unspecified capacity and program levels are not invented. The legacy Roboavión Robot placeholder remains compatible, but its creator now redirects to Vehicle creation.

## Maneuvers, repair and accidents

`game.paranoia.VehicleService` exposes the reusable workflow helpers and creator. Routine maneuvers can succeed without a roll when the GM chooses. Other maneuvers invoke the existing RollService with the operator's actual skill, selected difficulty, situational modifier and an explicitly GM-configured vehicle modifier. No speed/grid/terrain penalty table was fabricated. Failure offers GM consequences rather than automatically crashing.

Repair also uses RollService. The GM chooses skill, difficulty/modifier, optionally the source's ÷2 or ÷3 repair alternative, the affected system, and the resulting vehicle state. No automatic repair time or reconstruction of destroyed vehicles is supplied.

Accidents record the vehicle, movement/speed context, occupant references and individual adjudications in a private GM chat record. Each occupant routes through DamageService independently. Optional escape checks record success first, then leave the less severe column to the GM. Pending resolutions survive dialog closure; completed entries cannot be submitted again. The GM can exclude an absent/deleted occupant reference explicitly. No Annex B values are inferred.

Destroyed vehicles and the VTT's special airborne damage case flag an accident review. Vaporization flags the source's **column 19** instruction without silently killing passengers. The vehicle sheet offers the occupant workflow.

## Combat, damage and armor

- Reuses existing decision/resolution/movement phases; no vehicle initiative or second dice engine.
- Each manual gunner may fire one selected integrated weapon per turn. The same operator is tracked across vehicle and personal combatant attack records.
- A configured electronic brain can resolve all selected integrated weapons once each. Skills come from its programs.
- Operator health is captured at the start of Resolution, with private notes excluded. Later simultaneous damage does not erase an already valid attack.
- The existing Damage Table maps to Operational, Cosmetic, Light, Serious, Destroyed and Vaporized vehicle states. Vehicle light damage does **not** inherit Robot −4 or human wound accumulation.
- Active integrated Armor Items use the existing category/protection calculation. No arbitrary armor stacking or human Strength/Aguante is added to the hull.
- External protection for an occupant is an explicit GM choice in damage adjudication; it uses the hull instead of stacking personal armor. Vehicle damage alone does not change occupant health.
- Small-arms protection is a GM warning/adjudication flag, not universal category immunity.
- Smoke adds temporary **+5 against laser** through DamageService without editing Armor Items. The GM activates/removes it. Other countermeasures retain their supplied rules and metadata, without inventing interception odds or recharge durations.

## Builder and bundled catalogue

The GM's **Crear vehículo** workflow has ten design steps plus review, Back/Next navigation, template/custom selection, catalogue armament/armor/equipment choices, optional programming and hidden flaws. The draft stays local until confirmation. Movement modes, crew and further systems can be added on the resulting sheet. Cancellation creates no Actor.

The system-owned `paranoia-2-edition.vehicles` pack contains:

1. **Buitre Guerrero 920**: Violet access; two normal crew positions; electronic brain/personality; two Laser Cannon Model II Items, four missile-tube Items, anti-missile laser, smoke launcher, four interference emitters and integrated **T14** armor. Thirteen embedded Items. No default nuclear warhead, invented speed or brain skill level.
2. **Robocoche VTT 17 CS-I**: Indigo access; land/water/air modes; manual control only; no weapons or armor; hidden propeller-shaft flaw and GM airborne-damage warning.

The Item catalogue gains ten Weapon entries and five Equipment entries. Current pack totals are **35 Weapons, 2 Armor, 44 Equipment, 13 Robot templates, 3 Robot Programs and 2 Vehicles** (99 top-level documents).

Editable JSON sources and the existing deterministic builder produce the distributed LevelDB packs. Vehicle Actor embedded Items use V14's separate embedded-document storage. No world Items or installation/import script are needed.

## Verified numerical source data used

- BG 920: two crew, two Model II cannons, four missiles/tubes, T14 armor; 120-degree turns retained descriptively.
- VTT 17: maximum land slope about **15°**, air speed about **50 km/h**, air load about **six light passengers** or equivalent luggage. No assumed land/water speed or universal capacity.
- Smoke: **+5** laser protection while active.
- Interference R: approximately **10 km** radio-disruption radius.
- Laser Cannon I: recharge after one shot, **10 turns**. Model II: **3 shots**, **5-turn** recharge. Model III: **1 shot/turn**, large power-system limitation.
- Sonic projector: **60°** frontal cone.
- Tubular Cannon II: **2 shots/turn**, stored as source metadata.
- Vehicle flamethrower: **10-shot** capacity.
- Missile: **1 per tube**, **10-turn** flight maximum, approximately **300 m/s**; external stationary reload and selectable guidance metadata.
- Gas launcher: approximately **20 m** radius, referring to existing gas catalogue definitions.

Normal weapon Damage Numbers, ranges, prices, unspecified categories/skills, brain program levels, unprovided speeds/capacities and the full accident/column-19 results remain unset or explicitly manual. Source firing/recharge rates are descriptive metadata; no ammunition expenditure, missile physics or automated interception was added.

## Files created

- `module/data/models/vehicle.mjs`
- `module/vehicles/rules.mjs`, `fields.mjs`, `ui.mjs`, `service.mjs`, `dialogs.mjs`, `combat.mjs`, `creator.mjs`, `register.mjs`
- `module/sheets/vehicle-sheet.mjs`
- `templates/vehicles/sheet.hbs`
- `styles/vehicle-sheet.css`
- `packs-source/vehicles.json` and distributed `packs/vehicles/`
- `tests/vehicles.test.mjs`
- This report

## Files modified

- `system.json`, `module/paranoia-2-edition.mjs`
- `module/actors/types.mjs`
- `module/data/models/register.mjs`, `source-details.mjs`
- `module/sheets/register.mjs`, `item-sheet.mjs`
- `module/robots/item-document.mjs`, `combat.mjs`, `creator.mjs`
- `module/health/rules.mjs`, `service.mjs`
- `module/rolls/service.mjs`
- `module/combat/rules.mjs`, `service.mjs`, `dialogs.mjs`, `tracker.mjs`, `damage.mjs`
- `module/damage/service.mjs`, `dialogs.mjs`
- `templates/combat/declaration.hbs`, `damage.hbs`; `templates/damage/input.hbs`
- `scripts/build-packs.mjs`
- `packs-source/weapons.json`, `equipment.json`, `missing-statistics.md`; distributed packs rebuilt
- `tests/catalogue.test.mjs` (new catalogue counts)

## Verification

**104 automated tests passed, 0 failed.** Syntax checks passed for **107 JavaScript modules**.

An isolated fresh V14.367 world verified automatic pack availability and strict validation of all 99 bundled documents, including embedded Items. Both vehicle templates cloned correctly. Live checks covered:

- Three electronic-brain attacks, duplicate rejection and continued simultaneous resolution after hull destruction.
- Manual gunner single-weapon restriction, and Resolution-time operator damage preserved after later death.
- All six vehicle damage mappings without automatic passenger injury.
- T14 against ND20 produces ND6 through the shared service; active smoke changes laser ND to 1 without altering the Armor Item.
- Routine maneuvers produce no dice; dangerous maneuvers use the driver's actual skill.
- Explicit ÷3 repair at skill 12 gives target 4; GM repair application remains separate.
- Occupant accident damage and duplicate-resolution protection.
- Builder Back/Next draft retention, final creation and safe cancellation.
- Native Item drops, nullable unknown weapon damage, mode/serial autosave and persistence across a server restart.
- Player-session omission of hidden flaws/private notes and absence of GM creation controls.
- Character, NPC and Robot sheets; existing generation, rolls, powers and clone-service regression tests.
- Narrow 500-pixel sheet layout without horizontal overflow. Final normal-session console checks were clear.

V14-specific issues found and fixed during validation were optional enum fields requiring explicit blank support, native Actor-drop handlers receiving a resolved document, and DialogV2 returning a cancellation action key. No unresolved V14 compatibility blocker remains.

Full physics, grid/altitude/fuel simulation, missile AI, unprovided Accident Table data, treason and XP remain outside scope.
