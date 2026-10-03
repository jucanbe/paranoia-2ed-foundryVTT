# Damage, health and recovery (Foundry V14)

The Actor's existing `system.health.status` is the canonical state. It supports healthy,
stunned, wounded, incapacitated, dead and vaporized, with a separate `stunned` flag so a
wound survives the temporary stun. Notes remain editable by the owner. State changes,
damage resolution, treatment and time checks require the GM through the normal Foundry
permission model. No hit points, automatic clones or Item deletion are introduced.

## Damage and armor

`game.paranoia.DamageService` exposes `preview`, `resolveDamage`, `applyResolution` and
`fromMessage`. Inputs use Actor/Weapon documents, optional explicit baseDamageNumber and
category, and explicit GM switches for strength, stamina and armor. Existing prepared
damageBonus and stamina values are reused; missing numeric data is rejected.

Final ND = base ND + applicable melee Strength bonus - defender Aguante - armor.
Armor must be equipped. Select the first valid equipped armor in inventory sort/ID order,
warn if several are equipped, and never stack them. Protection applies only to a matching
weaponCategory or protectionType `all`. Zero remains zero. Reflect armor's color rule is
recorded in the bundled catalogue, but color interaction is not automated.

`module/damage/table.mjs` contains only the verified ND 8 column: 1–4 no effect,
5–9 stunned, 10–14 wounded, 15–18 incapacitated, 19–20 dead. Every other ND, including
zero and negatives, stays unchanged and requires the GM to choose a result. Native d20
Rolls remain attached to chat. Manual results are identified as GM decisions. Pending
cards can be resolved later; repeated submissions of a resolved card do not reapply damage.

## Health and recovery

Wounded adds -4 after difficulty and situational modifiers in the shared roll engine.
Combat previews and checks use that same helper, avoiding a second wound penalty.
Stunned, incapacitated, dead and vaporized block normal checks, declarations, attacks and
player token movement. Explicit GM roll overrides remain available.

Stun lasts through the current and following combat rounds, clearing at round N+2.
Outside an encounter the GM clears it manually. Clearing stun preserves a wound.
Repeated wounds escalate wounded to incapacitated, then incapacitated to dead. Dead and
vaporized are terminal under damage; the separate GM state correction can repair mistakes.
Vaporization marks equipmentDestroyed without deleting inventory or changing clones.

Recovery uses Foundry world-time timestamps, never wall-clock or offline elapsed time.
The GM explicitly checks untreated wounds after a day, and initiates hourly Endurance
checks for incapacitation. Failed survival checks offer confirmation before death.
Treatment can move incapacitated to wounded, or wounded to healthy; treatment marking
and notes are separate. No treatment difficulties or success rules have been invented.

`game.paranoia.HealthService` exposes applyHealthResult, clearStun, applyTreatment,
markTreated, setStatus, checkUntreated and hourlySurvival. State updates emit
`paranoiaHealthChanged(actor, {previous, current, userId})`. The Secret tab and tracker
show health; no global ActiveEffect definitions are replaced.

## Compatibility and validation

Known legacy health labels migrate to canonical states; unknown text is retained in notes.
Partial note updates must never reset health. Weapon partial updates likewise preserve
the existing category. Dedicated regression tests cover both Foundry migration cases.

Validation on Foundry 14.367 in an isolated world covered native damage rolls and manual
chat resolution, armor matching/equipping, wound escalation, action and player movement
gates, stun expiry, treatment, hourly failure/death confirmation, one-day deterioration,
owner notes, reload persistence, and creation with all three system packs. Creation still
produced DAVID-R-ARO-1, 100 credits and three issued Items. Packs contain 25/2/39 Items.

The automated suite has 42 tests: 41 pass. All nine new damage/health and partial-update
tests pass. The pre-existing creation reroll test expects lower-only replacement whereas
the current creator always replaces the roll; that unrelated discrepancy is unchanged.
The missing Annex B columns, detailed Reflect color automation and Item effects remain
unimplemented. Subsequent clone and core combat work now provides clone replacement and
attack-to-damage handoff; see `../clones/README.md` and `../combat/README.md`. Combat's
valid simultaneous declarations use starting health for their check, while ordinary rolls
continue to use current health. Recovery ignores duplicate stun-clear requests safely.
