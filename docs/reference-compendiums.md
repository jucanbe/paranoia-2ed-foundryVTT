# Servicios y poderes mutantes

Two native JournalEntry compendiums provide reference content:

- `paranoia-2-edition.services`: eight Services, stable codes, concise descriptions and source skill lists (Spanish rulebook pp. 43–46 and Annex A).
- `paranoia-2-edition.mutant-powers`: twenty powers generated directly from `module/powers/registry.mjs`, including rules, range, duration and four result categories.

Service reference content resides in `module/creation/service-reference.mjs`; it does not introduce a second mechanical Service table or change character creation skill limits. Power entries do not grant powers or alter Actors when imported. GM and Assistant access is enabled; player visibility is opt-in through Foundry pack permissions.

Spanish source content remains stable. The existing client localization translates names and Journal text into English without rewriting documents.

With `FOUNDRY_APP` set, build only these packs using `node scripts/build-packs.mjs services mutant-powers`. Full builds include both automatically. Stop Foundry before rebuilding already-open databases; `PACK_OUTPUT` can target an isolated directory. Restart Foundry after adding new manifest packs.
