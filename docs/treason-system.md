# Treason system (Foundry VTT 14)

## GM setup and privacy

Open **Traición · panel del DJ** in the Actor Directory, or **Desbloquear registro** in a citizen sheet's Secret tab. The coordinating GM creates a secret passphrase (at least 12 characters), confirming it once. Unlock again after reloading Foundry. Other GMs who need access must know this passphrase; only Foundry's active GM writes changes. Players never enter it.

Keep the passphrase securely: it cannot be recovered. Back up the Foundry world, which contains the encrypted ledger. The browser must have Web Crypto available (HTTPS or localhost). No extra module, server patch or dependency is required.

Foundry's `gmOnly` field option restricts writes, not disclosure to clients. Consequently **no points/history field was added to Actor.system**, owned Actor flags, plain Chat flags or plain world settings. The private record is keyed by Actor UUID inside a single encrypted World setting, `paranoia-2-edition.treasonVault`. This is deliberately separate from existing owner-visible character secrets.

The setting contains a version, random salt, public report-encryption key and AES-GCM ciphertext. PBKDF2-SHA-256 (310,000 iterations) derives the AES-256 key from the passphrase. Keys remain in GM memory. Private player reports use a fresh AES-GCM key wrapped by RSA-OAEP-3072; the RSA private key is inside the encrypted ledger. Native Chat author identity authenticates the sender; an encrypted packet alone does not authorize acting for a citizen. Exact points, audit records and adjudications are never returned to players.

This protects stored/transmitted data from ordinary player clients, not a compromised GM browser, leaked passphrase or malicious code running with GM access. Ciphertext timing/size is visible; trust outcomes and explicitly public accusations/declarations are intentionally visible. Existing unrelated secret-society/power storage is unchanged.

## Record and rules

Each private citizen record contains `enabled`, integer `points`, `declaredTraitor`, nullable `bounty`, append-only `history` and private `trust` results. Characters start at 1; NPC tracking is disabled until enabled. Robots and vehicles are rejected. Older characters without a record receive the same safe default. Inspection found no pre-existing equivalent Treason fields in this checkout. Existing encrypted records are never reset by initialization or character creation.

Changes clamp to 0–20 and record previous/requested/applied/current values, real/world time, GM, reason, organizational category, related Actor, notes and declaration/bounty changes. Corrections append another transaction. Reaching 20 declares a traitor and queues an optional public announcement. Lowering points does not revoke the declaration. Revocation is explicit. No damage, execution, targeting, disposition, promotion or reward is applied.

Pending declarations can be published from the sheet/dashboard. Each transition has a stable notice ID, preventing repeat publication. Revocation cancels an unpublished declaration. A bounty is optional and never invented. Public messages omit points.

Computer Trust uses native `Roll("1d20")` and **die > points**; equality fails. Normal special-result settings do not apply. Players submit a request; the GM reviews and rolls. Public output includes only the request and accepted/denied response. The private history retains the complete native Roll serialization and comparison; the public card deliberately omits the die/threshold. Requests grant no equipment automatically.

## Workflows and API

The GM sheet supports add/remove, history, immediate declaration, revocation, bounty and trust. The dashboard sorts citizens by PT, enables NPC tracking, reviews reports and offers **Informe Final de misión**. Survivors are preselected but every citizen can be included. Suggested success −1/failure +1 values remain editable. Every included record and its ledger are saved in one encrypted setting update; validation or save failure changes none of them.

Players can submit public/private accusations. Submission never changes PT. GM review supports note, dismiss or a chosen adjustment. The ledger records the accuser and private evidence. Private reports survive reload in encrypted Chat packets and the encrypted inbox; **Revisar buzón** imports pending authenticated reports after unlocking.

The existing power result card gains a GM **Registrar como traición** action. Above-clearance inventory produces a GM warning/action. Neither ownership, power use nor secret society membership adds points automatically. CloneService keeps the same Actor UUID, so replacement preserves the entire citizen record, declaration and history without copying it into clone data.

The small API is available as `game.paranoia.treason` and `game.paranoia.TreasonService`:

```js
await game.paranoia.treason.adjustPoints(actor, 2, {
  reason: "Actividad sospechosa", category: "other", notes: "Nota privada"
});
await game.paranoia.treason.propose({actor, category: "equipment", reason: "Revisar autorización"});
game.paranoia.treason.getPoints(actor); // GM + unlocked ledger only
game.paranoia.treason.checkTraitorStatus(actor); // GM only; never kills/targets
await game.paranoia.treason.rollComputerTrust(actor, {request: "Solicito asistencia"});
```

Read APIs require an unlocked GM session. Mutation APIs require the coordinating GM. Player callers use `submitReport`/`propose`, never adjustment APIs. Only the current session serializes mutations; use one coordinating GM browser session to avoid simultaneous edits from duplicate sessions of the same account. Multi-character report state is one database record; public Chat publication is a separate retryable action with stable IDs.

`treasonOffenses` is an empty configurable registry. Annex B is unavailable: no purported official offense list or fixed power/equipment/accusation penalty is shipped.

## Files

Created: `module/treason/{rules,crypto,store,service,dialogs,register}.mjs`, `templates/treason/dashboard.hbs`, `styles/treason.css`, `tests/treason.test.mjs`, this document.

Modified: `module/paranoia-2-edition.mjs`, `module/sheets/character-sheet.mjs`, `module/sheets/npc-sheet.mjs`, `templates/character-sheet.hbs`, `templates/npc/sheet.hbs`, `system.json`.

No combat, damage, clone, power, catalogue, Item or character-creation rules were rewritten.

## Verification

All **120 automated tests pass**. Tests cover defaults, boundaries, audit entries, declaration/revocation, strict trust comparisons, encryption/reload/wrong-key/tampering, player read/write denial, authenticated accusation handling, no automatic penalties, report atomicity, failed persistence and duplicate trust submissions. The complete existing regression suite is included. All **95 source modules** pass syntax validation; manifest references resolve.

Live isolated Foundry **14.367** world: GM/player sessions; character Secret-tab controls; player raw Actor/Chat/setting inspection; private accusation followed by explicit +2; native trust roll with redacted public response; three-character final report; threshold without damage and one public declaration; real CloneService replacement preserving PT/history/status; server restart and passphrase unlock; native Attribute/Skill rolls; mutant-power use with no automatic PT, followed by the optional card action; above-clearance Item warning without penalty; character-creation commit retaining PT 1 and three issued Items.

Production-world data is not modified by validation.
