# Native tabletop privacy

Foundry-native privacy is intended to prevent accidental/table-level disclosure, not to defend against an authorized player deliberately inspecting synchronized client data.

The standard Foundry V14 desktop application works over LAN/HTTP. No additional deployment or browser secure-context dependency is required.

Public accusations and Computer requests use ordinary ChatMessages. Private submissions and private Computer results whisper to all GM users and the submitting player. Public results are public. Results contain the request and accepted/rejected outcome, without PT or hidden calculations.

ChatMessage is the sole persistent record for submissions; review status is a flag on that message. TreasonService retains its ordinary gameplay ledger in the native World setting treasonLedger: PT, traitor state, history, trust calculations, publication receipts and resumable Final Mission Report/clearance operations. No duplicate submission database exists.

The GM dashboard opens immediately and offers normal gameplay controls. Society/power member information is rendered only for the owner and GM; NPC secrets, robot internals, vehicle hidden flaws and GM notes retain GM-only interface rules. Society GM notes and private credit details are ordinary Actor data excluded from player-facing contexts.

The previous native version-2 gameplay records are transferred once into the normal ledger and the obsolete source setting is deleted only after successful transfer. Older opaque records are ignored and left untouched; there is no importer or recovery utility in the system. Actor balances, citizen data and existing gameplay histories are not deleted.
