# Clone lifecycle (Foundry V14)

The Secret tab provides **Activar siguiente clon** for dead/vaporized characters.
Living characters have a separately labelled GM exception requiring a checked confirmation.
Cancellation changes nothing. No death event activates a clone automatically.

## Service and transaction

`game.paranoia.CloneService` exposes `canActivate(actor)`,
`prepareReplacement(actor, options)`, `archiveCurrentClone(actor, metadata)` and
`activateNextClone(actor, options)`. The preparation/archive methods return data without
writing it. Activation is GM-only; remote GM requests go through private authenticated
ChatMessage receipts to the active GM. They are not replayed on reload. Receipts remain
private to avoid a Foundry 14 chat-animation race with immediate message deletion.

The active GM serializes requests and shares the health service's per-Actor lock. A SHA-256
fingerprint of canonical gameplay data rejects stale dialogs or competing requests before
and after preparation. Client-local `_stats` fields are excluded because embedded Item
timestamps can differ across V14 clients until reload. Normal ownership rules apply;
this is not a security boundary against modified clients or multiple sessions impersonating
the same GM account.

One parent Actor update writes the history entry, incremented cloneNumber, healthy body,
credits, optional mutation change and exact replacement Item array. All prerequisite
lookups and schema validation occur first. The existing identity lifecycle builds Actor.name;
CloneService does not duplicate formatting. Linked tokens using the previous automatic
name follow the change, while custom aliases and token configuration remain untouched.
Only concrete persisted tokens are updated, excluding V14 preview tokens.

## Policies

- Inventory defaults to standard equipment, explicitly described as a GM workflow choice,
  not guaranteed reissue. Existing system packs supply the three stable starter IDs through
  the existing catalogue/creation inventory helper. New embedded copies are assigned.
- `none` removes physical Items after archiving their summary; `keep` does not write Items
  at all. Dead-body inventory is marked leftWithPreviousBody; vaporized inventory is marked
  destroyed. This is history, not a corpse container or recoverable inventory database.
- Credits default to the current balance, with an explicit override. No additional 100 credits.
- Mutation defaults to keeping name, notes, registration and numeric Attribute. `manual`
  replaces only the name; `random` uses a native d20 and the existing creation power table.
  No power information enters public activation chat.
- All health fields reset to schema defaults. Old health/treatment notes move into history.
  Attributes, skills, Services, society, identity, portrait, unrelated effects and other notes
  remain unchanged. The current health system creates no ActiveEffects to remove.
- Clone numbers have no game-rule cap. Manual number corrections use normal identity
  synchronization and do not add history. Creation defaults to clone 1 and empty history;
  only the GM can change the number inside the creation wizard.

`system.clones.history` is a typed array with clone number, citizen ID, ending health state,
cause, archive timestamp, world time, previous credits, health notes, optional appearance/GM
notes, inventory policy/disposition and compact Item summaries (name/type/catalogId,
quantity/assigned/meters). The timestamp records replacement archival, not an invented
time of death. Old Actors receive an empty array automatically.

History appears only in owner/GM Secret-tab context; GM notes are omitted from owner
template context. Like existing secret character data, this is sheet-level visibility using
Foundry ownership, interface privacy only. Players cannot modify history via the normal
Actor update lifecycle or invoke activation. Public chat contains only old/new citizen IDs
and Sano; silent activation is optional.

## Files

Created: `module/data/models/clones.mjs`, this directory's `rules.mjs`, `service.mjs`,
`requests.mjs`, `dialog.mjs`, this README, `templates/clones/activate.hbs`,
`tests/clones.test.mjs`, `tests/clone-service.test.mjs`.

Modified: `module/data/models/character.mjs`, `module/actors/identity.mjs`,
`module/sheets/character-sheet.mjs`, `module/paranoia-2-edition.mjs`,
`module/creation/wizard.mjs`, `templates/character-sheet.hbs`,
`templates/character-creation.hbs`.

## Validation

Eight focused automated tests pass: preservation, audit summaries, all inventory options,
mutation policies, credits, duplicate requests, living/GM restrictions, missing catalogue,
identity preview and cross-client fingerprint stability. Syntax checks pass.

Foundry 14.367 live checks in a fresh isolated world covered dead/vaporized replacement,
UI confirmation/cancel, all inventory modes, keep-inventory metadata preservation, power
changes, numeric power preservation, credits 37/20, unrelated ActiveEffect preservation,
linked/custom token names, native rolls and DamageService, creation with clone 1/no fake
history, three bundled packs, failed prerequisite rollback, stale dialogs, owner permissions,
non-owner secrecy, reload persistence and simultaneous activation from two separate GMs.
Only one competing activation succeeded. Successful second-GM activation was also tested.
Final browser checks had no errors.

The broader suite retains one pre-existing failure in creation rerolls (expected lower-only
replacement versus the current always-replace implementation). Clone work does not change
that rule. No combat expansion, spawning, corpses, treason, progression or delivery mechanics
were added.
