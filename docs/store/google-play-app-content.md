# Google Play: app content declarations

Play Console → the app → "Configurer votre application" → "Décrire le contenu de votre application" (in English
consoles: Policy → App content). One section per task, in the console's order. Each gives the proposed answer and
why, from the code as of 2026-10-30 (store build: `EXPO_PUBLIC_WALLET=off`, see `eas.json`). When the app changes
what it sends or asks for, update the matching section here and the form in the console.

## What the app does with data (reference for every form)

Sent off the device:

| Data | Where it goes | When | Code |
|---|---|---|---|
| Random install id (`X-Bid`, 16 hex, kept in the secure store) | gno.world | every off-chain call | `src/offchain/http.ts` |
| Presence id (random per launch) and paired-device group | gno.world `/presence` | every 20 s in the foreground | `src/state/app-services.tsx` |
| IP address (implicit); the server answers the visitor's country | gno.world | every call | `src/offchain/presence.ts` |
| Chat name, messages, edits, reactions, poll votes | gno.world `/api/chat*` | when the user posts | `src/offchain/chat/client.ts` |
| Reserved name + gno.land address, name-proof signature | gno.world `/api/name` | when the user reserves a name | `src/offchain/chat/client.ts` |
| Avatar photo (picked by the user, resized) | gno.world `/api/avatar` | when the user sets one | `src/screens/chat/avatar.ts` |
| Boop report (address, pool, boop number) | gno.world `/api/bubble/boop` | after each boop | `src/offchain/chat/boop-report.ts` |
| Rooms list and name key, encrypted with a key the server never sees | gno.world `/api/sync` | when the user pairs a device | `src/offchain/sync/` |
| Signed transactions (boop, claim, withdraw, create pool) | gno.land RPC (public blockchain) | when the user plays | `src/chain/` |

Kept only on the device: settings (AsyncStorage), session key and name key (secure store), chat cache.

Not used: ads SDKs, analytics, crash reporting, advertising ID, contacts, camera, microphone, precise location,
files. Android permissions of the store build (`npx expo config --type introspect`, 2026-10-30): `INTERNET`,
`VIBRATE`, `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE` up to Android 12 (from expo-image-picker); `CAMERA`
and `RECORD_AUDIO` are removed. Photos go through the system photo picker, so no `READ_MEDIA_IMAGES` declaration.
`SYSTEM_ALERT_WINDOW` is not used by the app; it needs no Play declaration, but could be dropped with
`android.blockedPermissions` in `app.json`.

## 1. Règles de confidentialité (privacy policy)

Enter a public URL (HTML, not a PDF, reachable without login, not geo-blocked). None exists yet: blocker **B1** in
the [README](README.md).

The policy must name the publisher (the same entity as the Play developer account) and cover, consistently with
section 6:

- what is collected (table above) and why;
- who receives it: the gno.world server and its operator, and the public gno.land blockchain (transactions and
  addresses are public and permanent);
- how long the server keeps it;
- how to get data deleted (taking back a message, releasing a name, and a contact for the rest);
- a contact address for privacy questions;
- that the app is not meant for people under 18.

## 2. Informations de connexion (app access)

Answer: **"Tout ou partie des fonctionnalités sont soumises à des restrictions"** (some functionality is restricted).

What needs nothing: the Home tab (GNOT price, who is here, chat preview), pools and their details, reading the chat,
posting in the chat under a chosen name, Settings.

What is restricted: booping, creating a pool, claiming and withdrawing need a **session** — this app's own key,
authorised once by a funded gno.land account. In the store build this is done with a `gnokey` command run on a
computer (Session tab → the command to copy).

Instructions to give the reviewer (blocker **B4**): the console asks for credentials it can reuse at any time. A
session cannot be shared like a password, so pick one:

1. a dedicated gno.land test account, funded with a little GNOT, and the steps to authorise the reviewer's install
   (needs a computer with `gnokey`; heavy for a reviewer), or
2. describe the restricted part with a short video link (allowed as "other information") and give the reviewer the
   unrestricted paths above.

Also tell the reviewer that play is not offered from the United States (the app shows "Due to US regulations, play
is not offered to visitors from the United States."), since reviewers may be located there.

Credentials, if any, go in the console and the password manager, never in this repo.

## 3. Annonces (ads)

Answer: **Non, mon application ne contient pas d'annonces**. No ad SDK, no `AD_ID` permission. If the console also
asks about the advertising ID, answer that the app does not use it.

## 4. Classification du contenu (content rating)

IARC questionnaire. Category: **Jeu** (game) if the app is listed as a game (see the listing page), otherwise "All
other app types". Proposed answers:

| Topic | Answer | Why |
|---|---|---|
| Violence, fear, sexuality, crude humour, drugs, alcohol, tobacco | No | none in the app's own content |
| Language | No for the app's content; user chat is covered below | |
| **Gambling** | **decision needed (B2)** | paid boops, pots paid out in GNOT, paid shots with odds |
| Users can interact or exchange content | **Yes** | public chat, rooms, avatars |
| Shares the user's location with other users | Yes if the server shows the user's country or `pos` to others (B3); the boop flag defaults to the country and is shown on the pool | |
| Digital purchases | Yes if spending GNOT inside the game counts; no Google Play billing | |
| Unrestricted internet access | No (the app only talks to gno.world and gno.land) | |

Whatever the gambling answer, re-run the questionnaire when it changes: the rating follows it.

## 5. Cible (target audience)

Answer: **18 ans et plus** only. Real-value tokens and a public chat; the app must not appeal to children
("Non" to the question about content that may attract children). This also keeps the app out of the Families policy.

## 6. Sécurité des données (data safety)

Blocker **B3** for the server-side parts. Proposed form, to confirm with the server operator:

- Does the app collect or share user data? **Yes.**
- Is all data encrypted in transit? **Yes** (HTTPS to gno.world and rpc.gno.land; plain HTTP only for a local
  developer node chosen in Settings).
- Can users request deletion? Partially in the app (take back a message, release a name, forget the session on the
  phone); for the rest, the contact given in the privacy policy. Confirm what the server can delete.

| Data type (Play's names) | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Position → Position approximative | Yes, derived from the IP by the server (confirm) | B3 | No | App functionality (US play block, "who is here" by country) |
| Informations personnelles → ID utilisateur | Yes: chat name, gno.land address | B3 | Yes | App functionality (chat identity, name reservation) |
| Informations financières → Autres informations financières | Yes: on-chain boops and payouts, address | Public blockchain | Yes | App functionality |
| Messages → Autres messages dans l'application | Yes: chat lines, rooms | B3 | Yes | App functionality |
| Photos et vidéos → Photos | Yes: avatar | B3 | Yes | App functionality |
| Activité dans les applications → Autre contenu généré par l'utilisateur | Yes: reactions, poll votes | B3 | Yes | App functionality |
| Activité dans les applications → Interactions avec l'application | Yes: presence heartbeat, boop reports | B3 | No | App functionality, analytics only if the server uses it so (confirm) |
| ID de l'appareil ou autres ID | Yes: random install id (`X-Bid`) | B3 | No | App functionality, fraud prevention if the server uses it so (confirm) |

"Shared" is **Yes** for everything sent to gno.world if gno.world is operated by someone other than the publisher.
Data the user knowingly makes public (chat lines, name, avatar) may still be declared collected only; check Play's
help for the exemptions when filling the form.

Not collected: contacts, calendar, health, audio, files, web history, precise location, crash logs, diagnostics.

## 7. Applis gouvernementales

Answer: **Non**.

## 8. Fonctionnalités financières (financial features)

Decision needed (**B2**). Facts to answer with:

- no banking, loans, payments, insurance, trading or exchange;
- the app holds a **session key** that can spend the user's GNOT, limited by the hourly budget and expiry the user
  signed, on gno.world realms only; the user's main account key never enters the app (the store build has no wallet);
- the user's funds stay on the gno.land blockchain; nobody holds them on the user's behalf.

If the form lists a cryptocurrency / software wallet item, read its definition: a non-custodial key used only for
gno.world play is the closest description. Otherwise answer that the app provides none of the listed features.

## 9. Santé

Answer: **none of the health features**.
