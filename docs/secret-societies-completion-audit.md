# Completion audit — 2026-10-03

## Initial checklist

- DONE at that implementation pass: one 16-society registry and d20 table; registered service and shared Citizen membership model; four membership statuses; ranks; encrypted GM audit/notes; missions, contacts, legacy favors; exposure with optional public message; Treason adjudication; Secret panel and GM-only NPC panel; creation and psychic review; whole-membership clone preservation; former affiliations; existing pack infrastructure. The final release audit subsequently added a localization catalogue; see `final-system-audit.md`.
- PARTIAL: missions lacked editing; favors lacked title/type/status; custom definitions were only actor-local; contact UUIDs had no safe resolution; rank labels and advancement metadata had no society-specific resolver.
- MISSING: rank-change extension hook, supplied Death Leopard titles, Sierra Survival multiplier, string-form migration and key aliases in stored societyKey.
- BROKEN / INCONSISTENT: string memberships would fail object migration; unknown stored keys were unresolved; documentation described unsupported metadata and customs without the new capabilities. No duplicate society registry, service or schema was found.

## Completed without rebuilding

Extended registry, migration, existing service, membership schema, dialog handlers and panel. Missions can be edited without changing IDs, resolution timestamps or status. GM mission notes remain encrypted. Contacts resolve only accessible Actor documents and tolerate deleted references. Favors keep old descriptions/resolution while gaining title/type/status. Rank updates publish a post-save local hook and retain encrypted history. World customs use a setting and reference with a fallback name; canonical source files remain immutable at runtime. Communist discovery highlights traitor declaration through the existing Treason service.

Migration is idempotent and also accepts partial patches: string names, named/aliased keys and unknown names normalize without rerolls or loss of notes/ranks; historical memberships and favors normalize recursively. Foundry invokes CitizenData migration on load; subsequent saves persist it. No live Actor database or pack database was rewritten.

## Verification and limits

Full Node regression suite: 133 tests passed, zero failures; syntax checks passed for all society modules and the membership schema. Coverage includes creation, powers, Treason, clones, NPCs, combat, Items, robots and vehicles. Added tests cover strings/unknown keys, ranks/metadata, encrypted mission edits, unavailable contact UUIDs, favor resolution, World custom persistence/permissions and the post-save rank hook. The unit services use Foundry mocks; they do not establish browser rendering or live-world behavior.

No live existing Actor was opened or changed during this pass. The earlier live-test record in secret-societies.md remains historical. Repeat GM/owner/observer sheet, creation, mission, clone and console checks in Foundry before treating the UI verification as complete.

The existing architecture suppresses secret data from public sheet contexts and denies service access to observers/other players, but Foundry still transmits member-facing Actor source data to clients with document access. GM notes/history are encrypted. Consequently the strict requirement that observers must not receive membership data at the transport level is not satisfied by this existing architecture. That requires a dedicated owner/GM encrypted storage or server-side document access design; do not equate hidden markup with transport confidentiality.

Compendium content, Development Points and automatic additional psionic powers were intentionally left for their separate tasks. Existing packs and pack builders were preserved.

## Files in this pass

Modified: module/societies/{registry,migration,service,dialogs,register}.mjs; module/data/models/society.mjs; templates/societies/panel.hbs; tests/societies.test.mjs; docs/secret-societies.md.

Created: docs/secret-societies-completion-audit.md.
