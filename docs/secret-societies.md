
# Secret societies — Foundry VTT 14

## Source and registry

`module/societies/registry.mjs` is the single canonical source for definitions and the d20 creation table. Creation, NPC generation, reference views and pack generation consume it.

The 16 entries are Antifrankenstein, Antimutantes, Club Sierra, Comunistas, Córpore Metal, Humanistas, Iluminados, Iglesia Primitiva de Cristo Programador, Leopardos de la Muerte, Libre Empresa, Místicos, Piratas Informáticos, Protecnos, Psiónicos, Purgadores and Románticos. Stable English keys are separate from Spanish labels. Legacy aliases include “Leopardo de la Muerte”, “Iglesia Primitiva” and “Purgadores Cristo Programador”.

Descriptions, directed relationships, structure, advancement, Computer relations, benefits and private GM notes now summarize the authoritative extracts supplied in the Compendium-content task. The canonical content is `module/societies/definitions.mjs`, consumed only through the existing registry. Unspecified fields remain empty and no reciprocal relationships are inferred. Death Leopards resolve eight titles through `rankLabel`. Club Sierra exposes Survival's 0.5 cost multiplier; Phreaks and Romantics expose initial-development access metadata. No Development Point spending or global Skills were added.

Legacy custom definitions remain on the membership. World definitions use the World-scoped `customSocieties` setting and stable `world-…` keys, managed by GM-only `saveWorldDefinition(key, definition)`. `getDefinition` resolves both sources; assignment stores a `custom.worldKey` reference and a name fallback. The assignment dialog includes World definitions. Editing an individual custom definition detaches that reference. Concurrent multiple primary memberships remain deferred; former affiliations are preserved.

## Membership model and migration

Character and NPC models share `module/data/models/society.mjs` through CitizenData. Robots and vehicles are unchanged.

`secretSociety` now contains:

- `id`, `societyKey`, custom definition, `rank.level` / `rank.label`, status, notes, joinedAt and exposed; Psionics records new-level instruction entitlements in `psionicLevels`.
- Structured missions: ID, title, instructions, status, organizational category, assigner, reward/consequence/member notes, creation/resolution times.
- Contacts: ID, name, optional Actor UUID, role, notes and trust notes.
- Favors/obligations: title, description, type (`favor` / `obligation`), status (`pending` / `resolved`), and the preserved legacy resolved flag, without a points economy.
- `membershipHistory`, retaining former affiliation data, missions, contacts and favors.
- `gmData`, an GM-only data object containing membership-specific GM notes, rank audit, mission notes and contact notes.

Known old `name` values become keys; canonical names are no longer redundantly stored. Unknown names become custom memberships. Numeric old ranks become levels; descriptive ranks remain labels. Notes are preserved. Partial notes-only updates do not reset rank or affiliation. Foundry applies this idempotent migration when loading legacy data; normal saves persist the normalized shape. No production-world bulk rewrite was performed.

Creation now assigns level 1 with a blank title. Recreating/changing a character's affiliation archives previous membership instead of discarding its notes. New NPCs default to no society; advanced generation supports None / Random / Choose, using the same registry/table. Psionics reuses the existing psychic-power review and never changes powers automatically.

## Privacy and permissions

**Membership uses normal Foundry owner/GM sheet visibility.** Character owners see member-facing society data on the Secret tab. Observers and other players receive no society panel or society reference action. NPC society views are GM-only even if an NPC has a player ownership grant. Member notes remain editable through normal form submission. GM controls manage affiliation, status, rank, missions, contacts and favors. The service also checks these roles; normal form updates reject owner changes to managed fields outside character creation.

GM notes and rank history are ordinary Actor data shown only in GM contexts. See [the native tabletop model](native-privacy-audit.md).

No mission or membership details are automatically posted to public Chat. Mission assignment is silent. The explicit reveal action can publish only citizen name and affiliation. No private notes appear in that message. The reference compendium is hidden from Player/Trusted roles through Foundry's normal pack ownership; bundled source/reference text is not cryptographically secret.

## Workflows and integrations

The Secret tab supplies member reference, missions, contacts, favors and former affiliations. GM actions assign/change society, promote/demote/correct rank, change status, expel, assign/resolve missions, add contacts/favors, inspect GM-only history and reveal affiliation.

Rank changes record old/new rank, reason, timestamp, world time, GM and private note. Expulsion requires UI confirmation and retains history. Mission completion offers optional rank correction, favor notes or a Treason proposal; none is applied automatically. Equipment rewards continue to use normal catalogue drag-and-drop and existing Credits under GM control, not a second reward economy.

Discovery offers no PT change, chosen additional PT, a separately confirmed traitor declaration, or a custom adjustment. These call the existing TreasonService. Mere membership, mission completion and society changes never affect PT, Computer Trust, health, clearance, Items or Credits automatically. Communist exposure does not execute the citizen.

CloneService already preserves Citizen system data; a real clone replacement was verified to retain rank, missions, contacts, favors, exposed state and GM-only GM history. No clone reroll or reset was added.

The namespaced API is `game.paranoia.SecretSocietyService`, including `getDefinition`, `worldDefinitions`, `saveWorldDefinition`, `getMembership`, `assignMembership`, `changeRank`, `assignMission`, `editMission`, `resolveMission`, `addContact`, `resolveContact`, `addFavor`, `markExposed`, `setStatus`, `removeMembership`, `proposeDiscovery`, `areAllies` and `areEnemies`. `paranoiaSocietyRankChanged` fires after persistence with the Actor and `{societyKey, previousRank, newRank, hooks}`. A Psionics promotion records an instruction entitlement in that same membership transaction. The GM then uses `MutantPowerService.learnPsionicPower(actor, key, level)` or the panel action to choose a new appropriate power. The original remains at `mutantPower.name`; additional powers live in `mutantPower.learned`. A level is granted once across the Actor's learned-power ledger, even after demotion/re-promotion. Selecting learned powers reuses the original Attribute, PM, GM approval, combat and private-chat paths. CloneService preserves both arrays. Legacy levels receive no retroactive invented grants.

## Bundled compendium

`paranoia-2-edition.societies` ships **16 JournalEntries**, each with one reference page. IDs derive deterministically from the canonical society key; `flags.paranoia-2-edition.societyKey` and `catalogId` identify entries. No World documents or import step are required.

Maintainer build (with Foundry's `resources/app` path in `FOUNDRY_APP`):

```text
node scripts/build-packs.mjs societies
```

The builder validates 16 definitions and every relationship, then uses installed Foundry's ClassicLevel dependency and V14's `journal` / `journal.pages` storage. Source definitions remain in version control, not opaque databases. The pack and member dialog share `module/societies/reference.mjs`; GM-only notes are excluded from member rendering. Player, Trusted and Assistant pack permissions are NONE. The distributed `packs/societies/` directory is built; no import is required. `SOCIETY_PACK_OUTPUT` optionally selects a staging directory while installed databases are locked.

## Files

Created:

- `module/societies/{registry,migration,service,dialogs,register}.mjs`
- `module/data/models/society.mjs`
- `templates/societies/panel.hbs`, `styles/societies.css`
- `scripts/build-societies.mjs`, `packs/societies/`
- `tests/societies.test.mjs`, this document

Modified:

- `module/data/models/citizen.mjs`, `module/paranoia-2-edition.mjs`
- `module/creation/{config,session,wizard,commit}.mjs`
- `module/npc/{generation,generator-dialog}.mjs`
- `module/sheets/{character-sheet,npc-sheet}.mjs`
- `templates/character-creation.hbs`, `templates/character-sheet.hbs`, `templates/npc/{sheet,generator}.hbs`
- `system.json`, `scripts/build-packs.mjs`
- `tests/{creation,npc,clone-service}.test.mjs`

## Validation

The earlier pass reported 130 passing tests and the live checks below. This completion pass reran the entire automated suite and extends migration, mission editing, contact/favor and metadata coverage. Live checks below are historical evidence, not checks repeated in this pass.

Live isolated Foundry **14.367** checks: fresh-world pack discovery; all 16 Journals load with their pages; GM promotion; mission/contact/favor creation; owner member notes and mission view; no observer panel/Secret tab; no NPC society view for a player even with ownership; Player compendium hidden; GM notes absent from raw Actor plaintext; mission-resolution follow-up; explicit Communist discovery and Treason declaration without damage; real clone transition; canonical Psionics creation with the original validation and three issued Items; persisted membership/private history after reload. No console errors were observed.

See `society-compendium.md` for the current content-pass report and fresh-World validation. Society-specific outcomes, hacking, resources, politics, equipment, drugs and cybernetics remain narrative or GM-adjudicated. Development rules remain metadata; additional psionic-power instruction is integrated with the existing service.
