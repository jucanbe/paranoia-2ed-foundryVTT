# Mutant Powers — Foundry VTT 14

## Architecture and use

`registry.mjs` is the only list of the twenty powers. Creation's d20 table and clone
replacement consume its names in the original order. Stable English keys identify
handlers. Existing names remain valid, including Hipersentido/Supersentido,
Adaptación metabólica/Supermetabolismo, Telekinesis/Telequinesis and Rayos-X variants.
Actor `mutantPower.name`, notes and registration are preserved; the key is resolved,
not duplicated as a second editable identity.

The Secret tab offers **Usar Poder Mutante**, **Recuperar PM**, the current/max pool,
and active effects. A player proposes intent, cost, difficulty and modifier in a
private request. The active GM opens **Revisar y aprobar**, adjusts those values,
then commits the attempt. No PM are spent or dice rolled before approval. GM uses
can commit directly. An active GM is required to serialize document changes.

Small public API:

```js
await game.paranoia.MutantPowerService.usePower(actor); // dialog
await game.paranoia.MutantPowerService.usePower(actor, {
  intent: "Levantar una bandeja", target: "Bandeja", approxWeightKg: 10,
  distanceMeters: 3, difficulty: "normal", modifier: 0, cost: 2
}); // GM commits; owner creates a private proposal
await game.paranoia.MutantPowerService.recover(actor, 3);
```

`requests.mjs` authenticates the requester through the Foundry message author and
Actor ownership, then serializes all requests on the elected active GM. A request
is marked processing before any mutation; it cannot deduct or roll twice. Failures
after commitment require GM review, not automatic retries or refunds. The request
records the clone, power and combat round, so stale approvals are rejected.

`service.mjs` uses the existing RollService for PM and resistance checks. Optional
natural 1/20 interpretations follow the existing world setting; otherwise normal
roll-under comparison applies. GM result correction retains the original native
die, changes only the interpretation, and never repeats PM spending or effects.

## PM and compatibility

`system.attributes.mutantPower.value` remains the Attribute. New resource fields:
`system.mutantPower.points.value` and `.max`. Creation initializes both from the PM
Attribute. Legacy null fields are initialized once by the GM; zero is expenditure,
never a missing value. Merely opening a sheet never replenishes PM. Existing notes,
names, registration and Attribute values are not replaced.

Cost is an integer 1–5, paid on commitment even on failure or critical failure.
Insufficient points block normal use. An explicit GM exception can authorize an
involuntary/narrative attempt; the pool never becomes negative. Recovery adds one
point per complete hour of peaceful uninterrupted sleep, capped at max. It does not
run a timer or infer sleep from elapsed world time.

CloneService preserves the power by default and restores current PM to max. It
removes only effects bearing this subsystem's `powerEffect` flag, preserving other
effects. Its existing random/manual power options and history remain intact.

## Effects and adjudication

The private result card opens a GM adjudication dialog:

- **Control de Adrenalina:** GM-entered Strength/Agility bonuses and a separate
  GM-entered increase to dependent learned Agility skills. Base data are untouched.
  Existing capacity/Basic Skill tables see the temporary Attribute increases where
  their defined domains apply; no beyond-table capacity values are invented.
- **Empatía:** +5 to Cynicism skills while the GM-approved contextual effect is
  active. End it when that context no longer applies. Identical active power bonuses
  do not stack.
- **Adrenalina/Campo de Energía:** ending the effect creates a separate temporary
  exhaustion effect, equivalent to Wounded for checks, without writing a wound.
  Repeated adrenaline after exhaustion escalates to temporary incapacity. The GM
  confirms adequate rest to remove exhaustion; PM recovery alone does not certify it.
- **Carisma/Rayo mental:** native Cynicism/Endurance resistance checks with a
  GM-set modifier. Failed Rayo Mental resistance permits canonical HealthService
  stun; the caster is excluded. Electroshock can also hand off an explicit stun.
  This uses the existing N+2 combat stun/recovery rule, not an invented stunner ND
  or newly assumed power-specific duration. The GM can clear stun as usual.
- **Regeneración:** allows a check while Wounded or Incapacitated. GM-confirmed
  recovery calls HealthService (Incapacitated → Wounded → Healthy); ordinary success
  is not automatically instant. Dead and Vaporized cannot be regenerated.
- **Teleportación:** no Token moves on the roll. The GM must choose the source
  Token, enter scene coordinates and explicitly confirm the destination.
- **Levitación/Polimorfismo/other ongoing powers:** managed descriptive effect,
  duration, targets and notes. Portraits and token appearance are not replaced.
- **Manual consequences:** GM-selected HealthService result or descriptive effect,
  without inventing a damage number. Adjudications are marked per operation/target
  to avoid applying the same consequence twice.

ActiveEffects use V14 `start` and `duration.value/units`, with no public token icon.
Flags store source Actor/clone, power key, start time/round, duration, target UUIDs,
notes and typed modifier records. Dot-bearing UUIDs/skill paths are values in lists,
not object keys: Foundry expands dotted keys during document updates. Expiration
uses world-time/combat hooks, never a real-time timer. Turns also retain a five-second
world-time fallback if the encounter ends. Effects can be ended manually by the GM.

Narrative powers remain GM-mediated: mind reading, telepathy, precognition,
mechanical empathy/intuition, super senses, X-ray vision, metabolism, fire,
transformation and telekinetic consequences. All twenty entries include four result
descriptions and source guidance. No hidden Actor notes or Scene information are read.
Missing boost/protection/damage magnitudes are never invented. Levitation's critical
`1d20 turns` is guidance for the GM's duration selection, not an automatic duration roll.

## Combat and secrecy

Declare **OTRO** with non-revealing public text, then use the Secret-tab action during
Resolution. Detailed intent goes only in the private approval request. The existing
start-of-resolution snapshot authorizes a valid simultaneous action even after later
same-phase injury/death. A generic `otherAction` reservation limits it to one use in
that turn; an explicit GM exception remains possible. A replacement clone cannot
inherit the old body's declaration.

Full result cards, approvals, PM and resistance details are whispered through native
Foundry Chat to Actor owners and GMs. Other users have no Secret tab or power controls;
private chat content respects Foundry visibility. No power name/resource is inserted
into public sheet markup or token effect icons. The optional public message contains
only text deliberately entered by the GM as observable consequences. As with existing
secret Actor fields, this uses Foundry ownership/UI visibility, interface privacy only or a
separate server-side field-permission system.

## Files

Created: `module/powers/{registry,rules,service,requests,effects,dialogs,register}.mjs`,
this README, `templates/powers/{use,request,result,adjudicate}.hbs`,
`tests/powers.test.mjs`, `tests/power-service.test.mjs`.

Modified: character DataModel; creation config/session; clone service; roll
service/rules/dialogs; health rules/service/register; combat rules/service/tracker;
system initialization; Character sheet class/template; check/duel chat templates;
character-sheet CSS; creation and clone-service tests.

## Verification (2026-10-01)

Automated: 71 passing tests, including all pre-existing regression tests. Added
coverage for twenty registry entries/aliases, PM initialization/spending/recovery,
zero/GM override, critical classification, duplicate requests, simultaneous Other
actions, regeneration, resistance/stun, confirmed teleportation, temporary modifiers,
repeated exhaustion/rest, GM result correction, creation pools and clone restoration.

Live testing: Foundry 14.367 in a fresh isolated world with GM, owner and observer
clients. Private use/approval with GM cost/difficulty changes; failed roll spending;
7→10→12 recovery; native private Roll records; observer sheet/chat visibility;
adrenaline bonuses and expiration without persistent wounds; empathy +5; mental
resistance/stun; regeneration from incapacity; simultaneous use after death and repeat
rejection; clone restoration/effect cleanup; creation with 100 credits/three bundled
Items; teleport destination confirmation; optional critical failure. No console errors
in those checks. Development-world documents were not modified.

Deferred: narrative adjudication and unspecified magnitudes remain GM decisions.
No Treason Points, society rules, progression, robots or vehicles were introduced.
