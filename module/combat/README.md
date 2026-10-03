# Tactical combat (Foundry V14)

Optional combat modules, disabled by default, are documented in [optional-combat.md](../../docs/optional-combat.md).

Use Foundry's normal encounter/token controls to add participants. The tracker shows
four phases: NPC decision, player decision, simultaneous resolution, movement.
An encounter turn is approximately five seconds. No initiative is assigned; participants
are alphabetized for display, and `Combat.turn` stays null. Next/previous-turn methods
advance/rewind phases. Rewinding/resetting a phase preserves attack usage; advancing past
movement resets declarations, modifiers, attack/movement usage, and snapshots for the new round.
Before advancing, the GM can cancel or override warnings for missing player declarations,
unresolved valid attacks, or unfinished movement. No automatic phase timer is used.
Completing Movement advances Foundry world time by five seconds using its native update
context. Individual phases, rewinds and starting/resetting the encounter do not advance it.

`PhaseCombat` stores phase/unlock/eligible IDs and action snapshots in `flags.paranoia-2-edition.state`.
Combatant flags hold player declarations, GM modifiers, attack usage and movement completion. NPC declarations
are GM-whisper ChatMessages using Foundry's normal visibility (not encryption). Their text
never enters player tracker context. NPC means an Actor without a player owner; no new
Actor type is needed. Ending/deleting an encounter removes its temporary NPC records;
embedded Combatants and their flags disappear with the encounter. Attack chat history remains.

Players need an active GM. Short-lived whispered request documents carry declarations,
previews, and attack requests. The active GM validates the authenticated document-event user,
ownership, current round/phase, weapon, target, modifiers, and attack eligibility, then
processes requests serially. This avoids competing clients resolving two attacks. Direct
system-flag edits are rejected for players through the Combatant lifecycle. As elsewhere
in Foundry, this is normal application permission handling, not a custom security boundary
against a modified client. GM changes and explicit exceptions remain available.

All checks call the existing `rollCheck({createMessage:false})`; combat posts one native
Roll with its attack card. Skill values are already effective values. The modifier helper
applies point blank +4 (excluding melee), active defense -4, and an integer GM modifier.
The shared health helper applies wounded -4 exactly once, including in the preview.
At the first entry into Resolution, eligible declarations snapshot their starting health,
weapon/target, defense, movement and clone number. Participants already unable to act
are excluded unless the GM expressly overrides. Subsequent damage cannot invalidate a
valid simultaneous action: even an Actor killed earlier in the same phase can roll its
declared attack. RollService accepts the initial health context only from the coordinating
GM. Outside combat it continues to check current health. A replacement clone does not
inherit the previous body's entitlement. Rewinding retains usage and snapshots; explicitly
editing an unlocked declaration refreshes that participant's snapshot.

An evaluated attack is reserved before dice execution. If an error occurs after evaluation,
the reservation stays blocked; the GM checks chat and uses **Desbloquear ataque** to recover.
Do not automatically retry a timed-out request. A disconnected GM requires reconnecting
and inspecting the encounter. No background requests are replayed on reconnect.

Target choices are encounter participants. Exactly one targeted participant is preselected;
multiple targets require a choice. Players use declared weapon/target; the GM may change
these. Campaign/area weapons use a reference target or explicit impact point and have no
automatic radius or multi-target damage. Their hit is left for GM adjudication.
The existing catalogue's unarmed Weapon can be embedded normally; attacks never create
temporary unarmed Items or infer statistics from a weapon's name.

Weapon categories now use canonical English keys from the shared Item configuration;
L/P/PP/C/B/E are display/legacy codes. Existing free-text `weaponType` is retained, and exact
known codes seed `weaponCategory`. Numeric legacy damage strings become `damageNumber`;
all original nonempty strings are retained in `damageNotation`. Unknown notation becomes
null numeric damage rather than an invented value. Short skill keys and canonical group.key
paths both work; weapon names never determine a skill.

Attack chat flags (`flags.paranoia-2-edition.attack`) contain document/token UUIDs, category,
damage number/notation, modifiers, die, target number, hit, special result, and damagePending.
On a hit, `combat/damage.mjs` calls the existing DamageService for configured single-target
weapons. That service alone calculates Strength/Aguante/armor and health transitions.
ND 8 resolves automatically; other known NDs produce the existing GM result-selection
card. Null ND remains null: the attack card offers a GM dialog for a temporary ND or
explicit manual health result through DamageService. Neither option rerolls the attack.
Manual-only results have no fabricated damage die or ND. Temporary values do not edit Items.

The attack message links its damage card with a stable sourceAttackId, so subsequent
submissions reuse it rather than reroll/reapply damage. Native Roll records and visibility
mode are retained. Pending damage records capture the target clone number and reject
application to a later replacement body. Death never calls CloneService automatically.

Movement rates are informational and centralized. Sprint blocks normal attacks. Zoom is
GM-only until Actor capabilities are defined. Movement is not path-limited. Health hooks
prevent player movement while unable to act; the GM can still reposition tokens.
Owners can mark movement complete in its phase. Stun clears at the existing N+2 boundary,
preserving any underlying wound; overlapping native/system expiry requests are harmless.

API: `game.paranoia.combat.request(combat, operation, options, combatantId)` supports
declare/preview/attack/movement; GM-only start/next/previous/reset/unlock/release/markAttack.
The GM can mark an action resolved without a roll or automatic damage. Attack options use
weaponId, targetId (Combatant ID), pointBlank, impactPoint, GM-only gmModifier/override, and
messageMode. The GM returns the handoff; remote requests return it inside `result`.
Convenience APIs `combat.attack(combat, combatantId, options)` and
`combat.nextPhase(combat, options)` reuse that coordinator. GM damage adjudication uses
`request(null, "damage", {messageId, baseDamageNumber?, manualResult?, targetUuid?})`.

## Files and verification (2026-09-30)

Created `module/combat/damage.mjs`, `templates/combat/damage.hbs`,
`tests/combat-integration.test.mjs` and `tests/damage-service.test.mjs`.
Modified combat rules/state/service/requests/dialogs/tracker/register and this README;
combat tracker/declaration/attack-dialog/attack-chat templates; RollService; DamageService
and its chat template; health recovery service; rolls/health documentation; combat tests.
No Actor or Item source schema was redesigned.

Foundry 14.367 live tests used a fresh isolated world with a GM and player client:
four-phase progression and resets; no initiative; A killing B followed by B's valid
player-controlled return attack killing A; exclusion of a pre-incapacitated participant;
repeat attack and player phase/NPC/override denials; combined 12−4+4−4+2=10 preview/roll;
ND 8 versus L4 producing ND 4 in DamageService; null ND with manual result; temporary ND
without editing the Weapon; area hits staying manual; Sprint rejection; movement warning,
cancel and owner completion; stun N+2 keeping wounded/healthy states; native attack dialog;
creation, catalogues, clone replacement and old-body damage rejection; end-combat cleanup
preserving every Actor. Final browser checks had no console errors.

Automated suite: 56 tests, 55 passing. The unchanged creation reroll test still expects
lower-only replacement while the current creator always replaces. All combat, damage,
health, clone, identity and inventory tests pass. Syntax checks pass.

Deferred: optional burst/suppression/aimed/localized/disarm rules, automatic ammunition
and reloads, grenade scatter, area templates/multi-target effects, path enforcement,
vehicles, robots and missing Annex B columns. No source statistics were invented.
