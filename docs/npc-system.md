# NPC Actors

The GM can create a PNJ manually or choose **Generar PNJ** in the Actor Directory or NPC sheet. Only clearance and Service are needed. Advanced options include identity, role, competence, mutation, society, equipment, Token disposition, a group of 1–20, shared group profiles, and a cancelable preview with reroll. Generation never modifies an existing Actor, places Tokens, or starts combat.

## Shared architecture

`CitizenData` supplies the existing identity, eight Attributes, 51 Skills, capacities, health, optional mutation/society, credits, and notes. `CharacterData` adds its existing creation flag and clone history. `NPCData` adds `identity.useCitizenId`, canonical `mutantPower.key`, and `npc` role/tags/appearance/personality/objective/behavior/GM notes/active weapon. There are no duplicate formulas, inventory arrays, or NPC combat rules.

The compact NPC sheet uses ActorSheetV2, HandlebarsApplicationMixin and standard change submission. It exposes the seven ordinary Attributes, nonzero Skills (expandable to all), inventory and combat summary. Mutant score, power/pool, society and GM notes are omitted from non-GM context/HTML. New generated or duplicated NPCs have no player ownership and unlinked prototype Tokens. Normal Foundry ownership remains the document access boundary; sheet redaction is not field-level encryption.

Active weapon is a convenience selection used to preselect existing combat dialogs. Other weapons remain available. Equipping armor from the NPC sheet deselects the previous armor. Items use native embedded documents and ActorSheetV2 drag/drop. Optional next-clone use calls CloneService and does not create PC clone history.

## Rules versus convenience

- Source-backed/shared: native d20 Attributes, existing Basic Skill table, derived capacities, mutation/society tables, RollService, health penalty, combat, damage and mutant-power services.
- **Not an official generation rule:** this quick generator is a Foundry GM convenience. Minor/standard/competent/elite adjust generated Attributes by −2/0/+2/+4, clamped 1–20. Clearance never increases scores. Name/sector pools and bulk/shared profiles are conveniences. Policy lives in `module/npc/config.mjs`.
- Service is stored independently. Verified Service-to-Skill mappings remain unavailable; the existing empty configuration is reused, with no invented bonus.
- Mutation is optional. Without it the ungenerated mutant score is 0; with it the eighth d20 and an independent table roll initialize the existing PM pool. Psiónicos receives a GM compatibility reminder, not an invented reassignment.
- No equipment is assigned by default. The optional Troubleshooter kit requires that role and Red or higher clearance and resolves the three existing stable catalogue IDs. Random equipment uses native dice and excludes unknown clearance unless the existing catalogue explicitly permits starting purchase. Missing statistics remain missing. Credits default to 0; this is not the PC creation allowance.
- Only cosmetic names/sectors use ordinary randomness. Game dice use Foundry Roll and generation creates no public roll messages.

## Files

Created:
- `module/actors/types.mjs`
- `module/data/models/citizen.mjs`, `npc.mjs`
- `module/creation/dice.mjs`
- `module/npc/config.mjs`, `generation.mjs`, `service.mjs`, `generator-dialog.mjs`, `register.mjs`
- `module/sheets/npc-sheet.mjs`
- `templates/npc/sheet.hbs`, `generator.hbs`, `preview.hbs`
- `styles/npc.css`, `tests/npc.test.mjs`, this document

Modified:
- `system.json`, `module/paranoia-2-edition.mjs`
- `module/data/models/character.mjs`, `register.mjs`
- `module/actors/identity.mjs`, `module/sheets/register.mjs`, `module/creation/wizard.mjs`
- `module/rolls/service.mjs`, `dialogs.mjs`
- `module/health/service.mjs`, `module/damage/dialogs.mjs`
- `module/combat/state.mjs`, `dialogs.mjs`, `damage.mjs`
- `module/powers/register.mjs`, `service.mjs`, `dialogs.mjs`
- `module/clones/service.mjs`

## Validation

79 automated tests pass (71 regression tests plus eight NPC tests). All module files pass JavaScript syntax checking.

In a disposable Foundry V14.367 world: manual `MARTA-B-CPU-1`; saved/reopened Attribute and Skill edits; prepared capacity 55 kg at Strength 18; minimal Red/SDF generation; groups of five with unique IDs and shared profiles; quiet generation; native dice and pack equipment; independent duplicate Items and reset ownership; native armor drop preserving L4; plain-name mode; unlinked Tokens; generator preview/reroll/cancel; desktop and 480px sheet layout; Character sheet/creation opening; GM-only power output and observer sheet redaction; successful NPC tactical attack and automatic DamageService handoff; wounded target 12→8 exactly once; incapacitated/dead action blocking; optional next clone restored health and incremented identity without history. Unknown catalogue weapon ND was assigned a test-only value in the disposable world for the combat check, never added to production catalogue data.

V14 compatibility fixes found during validation: create fresh nested schema fields rather than reparenting fields; explicitly allow the blank optional power key; keep expanded dialogs scrollable/repositioned. Final reload produced no application console errors.

Robots, Vehicles, AI behavior, treason, progression, and missing Service skill tables remain outside this task.
