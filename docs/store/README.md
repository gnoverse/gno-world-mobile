# Store setup

What the stores need before gno.world can leave the "unreviewed" draft state, and where each answer comes from.
Update the status columns as items are done. No credentials, keys or personal contacts here: they live in the
team's password manager.

- [Google Play: app content declarations](google-play-app-content.md) ("Décrire le contenu de votre application")
- [Google Play: category, contact details and store listing](google-play-listing.md) ("Gérer l'organisation et la présentation de votre application")
- `assets/`: store graphics (see the listing page for how each one is made)

## Status (Google Play)

Package `world.gno.app`. State on 2026-10-30: draft app, internal testing track active with 1.0.0, temporary name
"world.gno.app (unreviewed)", no icon on the Play page.

| Task (Play Console) | Status | Blocked by |
|---|---|---|
| Règles de confidentialité (privacy policy) | todo | a public privacy policy URL (B1) |
| Informations de connexion (app access) | todo | a reviewer account (B4) |
| Annonces (ads) | ready | — |
| Classification du contenu (content rating) | todo | gambling answer (B2) |
| Cible (target audience) | ready | — |
| Sécurité des données (data safety) | todo | server-side answers (B3) |
| Applis gouvernementales | ready | — |
| Fonctionnalités financières | todo | crypto answer (B2) |
| Santé | ready | — |
| Catégorie et coordonnées | todo | category (B2), support email |
| Fiche Play Store (store listing) | ready (texts, icon, feature graphic, 5 screenshots) | category (B2) to pick in the same page |

"ready" = the answer is written down in these pages and only needs to be entered.

## Blockers to settle first

- **B1. Privacy policy URL.** Required for every app, and the data safety form must match it. `gno.world/privacy`,
  `/privacy-policy`, `/legal` and `/terms` all answered 404 on 2026-10-30. Someone has to host one (on gno.world by
  its operator, or on the publisher's site). What it must say: see
  [app content → privacy policy](google-play-app-content.md#1-règles-de-confidentialité-privacy-policy).
- **B2. Is a boop real-money gambling under Play's rules?** Players pay GNOT (a token with a market price) to boop, and
  a pool's pot is paid out to players when the bubble pops, and an optional paid "shot" has a stated chance of popping
  it (`oddsBps` in `src/game/shots.ts`). Play treats "pay to enter + element of
  chance + prize of real-world value" as real-money gambling, which is only allowed in some countries, for approved
  apps, and with an 18+ rating; its blockchain policy also forbids promoting earnings. The app already blocks play
  from the US for regulatory reasons. This answer drives the content rating, the category, the financial features
  form and the target countries, so it needs a decision (legal advice if possible) before those forms are filled.
- **B3. Who operates the gno.world server, and what it keeps.** The app sends chat, names, avatars, presence and
  boop reports to `https://gno.world`, which the app's publisher does not run. The data safety form needs: what the
  server stores and for how long, how it derives location from the IP (the presence reply carries the visitor's
  country, and the chat lines it serves to everyone carry the poster's country `cc` and coordinates `pos`, see
  `src/offchain/chat/__fixtures__/`), whether anything is passed to third parties, and how
  a user asks for deletion. If the operator is not the publisher, data sent there counts as **shared**.
- **B4. Reviewer access to play.** Booping needs a session key authorised by a funded gno.land account, through a
  `gnokey` command on a computer. Reviewers need a way in (see
  [app access](google-play-app-content.md#2-informations-de-connexion-app-access)).
- **B5. Chat moderation in the app.** Play's user-generated content policy asks apps with chat for terms that forbid
  objectionable content, an in-app way to **report** content and users, and a way to **block** users. The app has
  none of these today (the line menu offers reply, edit, take back, reactions). Expect a rejection without them; this
  is app work, tracked here until it has its own plan.
