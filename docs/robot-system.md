# Robot system implementation

## Architecture

Robots use a dedicated `robot` Actor DataModel and V14 ActorSheetV2. They do not inherit citizen identity, human Attributes, mutant powers or clone replacement. Programs and peripherals are embedded Items. Active program levels supply existing skill keys; duplicate programs consume their own memory but use the highest level rather than adding levels together.

Program level is its memory cost. Batch document creation and updates validate memory, including cards. Unknown capacity stays unknown; verified template programs remain usable, while additional installation requires configured capacity or an explicit GM override. Robomechanic combat card changes take three rounds and cannot be bypassed by directly activating a card.

The existing roll, combat, armor and damage services handle robots through narrow adapters. Light damage applies −4 only to combat skills. Robot health transitions and GM-confirmed repair steps remain separate from human wounds. Destroyed/vaporized robots cannot be repaired through the ordinary repair action. Vaporization disables salvage without deleting the inventory audit record.

Integrated weapons have separate once-per-declaration attack slots. Ordinary held weapons retain the single-attack limit. The existing simultaneous-resolution snapshot preserves a declared attack when damage arrives during resolution. No second dice engine or damage table was introduced.

The GM creator selects a template or custom robot, programs, peripherals and catalogue Items. Weapons can be marked integrated, and armor selected as chassis protection. Internal memory, programming, Asimov and operator information is omitted from player sheet context. This is sheet-level visibility, not a replacement for Foundry document permissions.

## Bundled content

- `paranoia-2-edition.robots`: 13 Actor templates.
- `paranoia-2-edition.robot-programs`: 3 program Items (Medicine 4, 8 and 15).

Editable JSON sources use stable catalogue IDs. The deterministic pack builder stores Actor embedded Items in Foundry's `actors.items` sublevel, with Item IDs referenced from Actor records. Packs ship with the system and require no world import script.

Only supplied values are populated. Robodoctor I/V/XII have Medicine 4/8/15; Robosoldado lacks Asimov circuits. Unspecified memory capacity, movement, armor and weapon statistics remain unset. Roboavión is flagged as requiring the future vehicle system. No invented model statistics or autonomous AI are included.

## Files created

- `module/data/models/robot.mjs`, `robot-items.mjs`
- `module/robots/rules.mjs`, `item-document.mjs`, `combat.mjs`, `service.mjs`, `dialogs.mjs`, `creator.mjs`, `register.mjs`
- `module/sheets/robot-sheet.mjs`
- `templates/robots/sheet.hbs`, `repair.hbs`, `create.hbs`
- `styles/robot-sheet.css`
- `packs-source/robots.json`, `robot-programs.json`
- Distributed `packs/robots/` and `packs/robot-programs/`
- `tests/robots.test.mjs`, this report

## Existing files modified

- Registration/manifest: `system.json`, `module/paranoia-2-edition.mjs`, `module/data/models/register.mjs`, `module/sheets/register.mjs`
- Item integration: `module/data/models/weapon.mjs`, `armor.mjs`, `module/sheets/item-sheet.mjs`, `item-actions.mjs`
- Actor eligibility: `module/actors/types.mjs`
- Shared rules and services: `module/health/rules.mjs`, `service.mjs`; `module/rolls/rules.mjs`, `service.mjs`, `dialogs.mjs`; `module/combat/rules.mjs`, `service.mjs`, `dialogs.mjs`, `tracker.mjs`, `damage.mjs`; `module/damage/service.mjs`, `dialogs.mjs`; `module/clones/service.mjs`
- Shared presentation: `templates/combat/declaration.hbs`, `attack-dialog.hbs`, `attack-chat.hbs`, `templates/rolls/check-dialog.hbs`; robot-specific styling separated from `styles/npc.css`
- Pack build: `scripts/build-packs.mjs`

## Verification

Final automated run: **91 tests passed, 0 failed**. Syntax checks passed for **96 JavaScript modules**.

An isolated fresh world on Foundry **14.367** verified:

- Both new system packs appear automatically, with 13 robot templates and 3 programs; embedded programs/peripherals survive pack loading.
- Robot creation, sheet rendering, program editing and persisted memory usage; capacity overflow is rejected.
- Robodoctor Medicine values, combat-only damage penalties, robot health escalation, repair steps and salvage handling.
- Timed card swaps, early completion rejection and prevention of direct activation bypass.
- Multiple declared integrated attacks, later-damage snapshot preservation, duplicate rejection and the ordinary held-weapon limit.
- Shared armor/damage integration using an isolated test weapon; no fabricated statistics added to catalogue data.
- Player sheet excludes GM internals; GM robot skill checks whisper to the GM.
- Existing Character/NPC sheets, identity, generation and inventory remain usable.
- Final creator template renders integrated-weapon/chassis controls. Final normal-session console checks were clear.

A test fixture that directly created a Combat with a preset round hit a native Foundry turn-event error. Subsequent verification used normal combat startup; no unrelated Foundry combat code was changed.

## Deferred

Unprovided source statistics, vehicle mechanics, autonomous robot AI, hacking, new damage tables and automatic peripheral/Asimov behavior remain outside this implementation. Peripheral suitability is advisory; repair difficulty and ambiguous results remain explicit GM decisions.
