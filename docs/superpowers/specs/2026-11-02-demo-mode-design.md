# Mode démo (sans réseau, éphémère, avec un guide en bulles) — design

Brainstorming du 2026-11-02. Maquette validée (style B, « bulle pointée ») :
`.superpowers/brainstorm/10749-1793633549/content/guide-bubbles.html` (git-ignoré).

## 1. Pourquoi

- Quelqu'un qui installe gno.world sans wallet ni ordinateur à côté ne peut rien essayer : booper demande une session,
  le chat demande un nom. Il faut lui montrer **quelles informations l'app fournit** et le laisser **interagir avec les
  pools et le chat** pour comprendre comment elle marche.
- Les stores bloquent : la Play Console (« Informations de connexion », docs/store B4) refuse des instructions sans
  accès complet, et Apple a rejeté la build le 2026-11-01 (guideline 2.1). Un mode démo atteignable en un tap, sans
  identifiants, répond aux deux.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs (décidés par l'utilisateur) :**

1. Un **mode démo** qu'on active depuis **Réglages**, ou depuis une **modale au premier lancement** (« Essayer la
   démo » / « Ignorer »).
2. **Aucun accès à un serveur** pendant la démo : ni gno.world, ni le RPC de la chaîne, ni rien d'autre.
3. **Rien n'est gardé** une fois la démo quittée.
4. Au lancement de la démo, un **guide pas à pas**, qu'on peut ignorer, en **bulles qui pointent** vers une action à
   faire ou une donnée à lire (style B de la maquette : bulle blanche avec flèche, point jaune qui pulse sur l'élément,
   le reste de l'écran reste utilisable).
5. **Pas d'autres joueurs simulés** : la démo n'a pas à paraître vivante, elle sert à **tester l'app**. Seules les
   actions de l'utilisateur changent quelque chose (plus le temps qui passe, voir §6).
6. Un bouton, en démo seulement, pour **mettre le compte à rebours d'une bulle à zéro**.
7. **Quitter la démo demande toujours une confirmation.**
8. **Tout est simulé, rien n'est désactivé** — y compris **/pair** (important) et **les partages** : là où l'app
   parle à un tiers (navigateur appairé, ordinateur ou wallet qui accorde une session, serveur), un faux tiers répond
   (§8). Partager un lien de démo par le menu du téléphone est sans risque.

**Non-objectifs :**

- Reproduire fidèlement l'économie du realm (dividendes, parrainage, équipes au centime près) : la démo doit être
  cohérente à l'écran, pas exacte.
- Faire de la démo un environnement de test pour les développeurs (gnodev existe pour ça).

**Anti-objectifs (ce qui serait un échec même si « ça marche ») :**

- Une seule requête réseau partie pendant la démo.
- Une trace de la démo après l'avoir quittée (message, nom, session, room, réglage), ou une donnée réelle de
  l'utilisateur (vraie session, nom réservé, rooms, réglages réseau/serveur) modifiée ou perdue par la démo.
- Confondre démo et réel : un écran de démo qui pourrait passer pour les vraies données.
- Du contenu de démo tiré de la production (vrais noms, vraies adresses, vrais messages des fixtures).

## 3. Entrer dans la démo

**Modale du premier lancement.** Titre et texte du genre « Try gno.world in demo mode? Everything is simulated: nothing
is sent, nothing is kept. » ; boutons **Try the demo** et **Not now**. Elle ne s'affiche **qu'une fois**, quel que soit
le choix ; le drapeau « déjà proposée » est une donnée normale de l'app (AsyncStorage), pas une donnée de démo. Les
installations existantes qui passent à cette version la voient aussi, une fois (pas de détection « nouvelle
installation »).

**Réglages.** Une section « Demo mode » :
- hors démo : « Try demo mode » → même modale (sans le « une seule fois ») ;
- en démo : « Restart the guide » et « Leave demo mode » (→ confirmation, §7). « Restart the guide » **remet aussi la
  démo à son contenu de départ** (ce que l'utilisateur y a fait est effacé, après confirmation), pour que les étapes
  5–7 retrouvent une bulle en cours.

**Chemin des reviewers** : premier lancement → « Try the demo ». Les instructions de la Play Console et la réponse à
Apple (hors de ce document, voir docs/store) diront : « au premier lancement, touchez Try the demo, ou Settings → Demo
mode ».

## 4. Pendant la démo

- Un **badge « DEMO »** reste visible sur tous les écrans (en haut, dans la safe area, sans masquer de contenu). Le
  toucher propose de quitter (§7).
- L'utilisateur a d'office une **session active fictive** avec un **solde fictif** (ordre de grandeur : 100 GNOT) et un
  plafond de dépense assez large pour ne pas bloquer les essais.
- **Le blocage États-Unis est levé** (`isPlayBlocked`, `src/offchain/presence.ts`) : tout est fictif, et les
  reviewers Apple sont surtout aux États-Unis. L'utilisateur de démo a un **pays inventé fixe** (ex. FR) pour Here now
  et les suggestions de drapeau ; son vrai pays n'est ni lu ni utilisé.
- Le guide démarre (§5).
- Tout le reste de l'app marche comme d'habitude, sur les données simulées (§6).

## 5. Le guide

Bulles style B : une bulle blanche avec flèche vers l'élément, un point jaune qui pulse dessus, **Skip** / **Next** et
des points d'avancement. Textes **en anglais** comme le reste de l'app.

**Avancer** : « Next ». Sur une étape d'action, faire l'action fait aussi avancer. **Skip** ferme le guide : on reste
en démo et on explore librement ; le guide se relance depuis Réglages.

**Étapes, dans l'ordre :**

1. Home : le **prix du GNOT** (lire).
2. Home : **Here now**, qui est connecté et d'où (lire).
3. Chat : **envoyer un message** (action), puis **réagir** à un message (action).
4. Chat : **appairer avec un navigateur** (action) — la bulle donne le code de démo à taper ; le nom réservé et une
   room arrivent (§8).
5. Pools : la **liste** (lire), puis **ouvrir une bulle** (action).
6. Pool : **booper** (action) — le compte à rebours repart.
7. Pool : **⏩ mettre le temps à zéro** (action) → la bulle éclate, tu es le dernier booper donc tu gagnes →
   **réclamer** le gain (action ; Claim et, si l'écran l'exige, Withdraw).
8. Session : le **solde fictif** a augmenté, et les **gains** (lire).
9. Fin : comment **quitter la démo** (le badge, ou Réglages).

Le guide change d'onglet ou d'écran par l'action de l'utilisateur (la bulle pointe l'onglet à toucher), pas tout seul.

## 6. Le monde simulé

**Contenu de départ fixe**, inventé pour la démo (aucun nom, adresse ou message de production) :
- Public : quelques messages de quelques pseudos, avec des réactions ;
- Pools : quelques bulles en cours avec leurs boops passés, dont celle que le guide fait ouvrir, plus une ou deux
  terminées ;
- un prix GNOT et un historique (1 j / 7 j / 30 j) ;
- Here now : un compte et quelques points sur la carte.

**Rien ne bouge tout seul** : pas de faux joueurs, pas de messages ou de boops qui arrivent. Seules les actions de
l'utilisateur changent l'état (message, réaction, vote, nom, avatar, boop, claim, création de pool, création de room).

**Exception : le temps passe.** Les comptes à rebours défilent en temps réel.

**Bouton ⏩** (démo seulement, sur la fiche d'un pool en cours, marqué comme démo, ex. « ⏩ End now · demo ») : amène la
fin de la bulle à maintenant. Elle éclate ; si l'utilisateur est le dernier booper, il gagne.

## 7. Quitter la démo

- Depuis le badge ou Réglages, **toujours** une confirmation : « Leave demo mode? Everything you did here will be
  erased. ».
- Après : l'app est **exactement** comme avant la démo — vraie session, nom, rooms, réglages intacts.
- Si l'app est fermée ou tuée pendant la démo, elle **redémarre en mode normal** : rien de la démo n'est sauvegardé,
  pas même le fait d'être en démo. Passer en arrière-plan et revenir garde la démo (elle vit en mémoire).

## 8. Comment (ce qui est décidé, et ce qui est laissé au développeur)

**Point d'injection unique.** Toute l'app reçoit ses dépendances dans `AppServices` (`src/state/app-services.tsx`) :
`ChainApi`, `Offchain` (`src/offchain/http.ts`), le stockage clé-valeur (AsyncStorage), les secrets (SecureStore),
`randomHex`, `now`. En démo, on construit le même objet `Services` avec :
- une **chaîne simulée** qui implémente `ChainApi` (renders JSON v6, `call` pour Bid / Claim / Cancel / Withdraw /
  CreatePool, comptes, sessions, keybase) — en mémoire ; `src/chain/fake-api.ts` (tests) est un point de départ ;
- un **gno.world simulé** qui implémente `Offchain` (chat, réactions, votes, nom, avatar, rooms, prix, where,
  presence) — en mémoire ;
- un **KV et un SecretStore en mémoire**.

Basculer démo ↔ réel remplace l'objet `Services` et remonte l'arbre sous `AppServices` (par ex. une `key`), pour
qu'aucun état d'écran ne passe d'un monde à l'autre.

**Ce que la démo ne doit jamais toucher** : `settingsStore` (persisté, global) — y compris `setFlag` (au boop) et
`setRefOnce` (liens) ; en démo, les champs réseau/serveur de
Réglages sont masqués ou en lecture seule, et les abonnements de `AppServices` aux changements de réglages ne
s'appliquent pas ; `presenceStore` et autres stores globaux doivent être remis à zéro en sortant. La lib native
gnonative reste montée (`GnoNativeProvider`) mais la démo ne l'appelle jamais.

**Simulé plutôt que désactivé** (décision de l'utilisateur : rien n'est caché en démo) :
- **/pair** : « Get a code » affiche un faux code avec son compte à rebours (une bulle explique qu'on le taperait sur
  gno.world dans un navigateur). Taper un code — le code de démo que donne le guide, et n'importe quel code bien formé —
  appaire avec un **faux navigateur**, qui envoie ce qu'un vrai enverrait : un **nom réservé** (ex. `demo-you`) et une
  **room** avec quelques messages ; l'écran passe à « Paired ». **Stop** désappaire ; le nom et la room restent, comme en
  vrai.
- **Session** demandée à un ordinateur ou au wallet : un **faux ordinateur / wallet** l'accorde tout de suite.
- **Nom** : la réservation et sa preuve (boop de 3 min, défi signé) aboutissent tout de suite.
- **Rejoindre une room par lien** : un lien d'invitation de démo, prêt à l'emploi (par ex. dans un message de Public).
- **Partages** (pool, room, invitation) : le vrai menu de partage du téléphone, avec le lien de démo. L'utilisateur
  juge que continuer le partage est sans risque.
- **Avatar** : le sélecteur d'image marche (local) ; l'image reste en mémoire.
- Les liens qui ouvrent le navigateur du système hors de l'app (politique de confidentialité) restent tels quels : ce
  n'est pas l'app qui contacte un serveur.

**Laissé au développeur :**
- l'implémentation du guide (composant maison qui mesure la position des éléments, ou une bibliothèque si une
  convient — vérifier les skills Expo et l'existant avant d'ajouter une dépendance) ;
- le niveau de fidélité du realm simulé, tant que les écrans restent cohérents (prix suivant via `src/game/pricing.ts`,
  pot, dernier booper, échéance, gains) ;
- le contenu de départ exact (§6), dans l'esprit de la maquette ;
- les versions de realm anciennes (v1–v5) : la démo ne doit pas faire apparaître d'erreur « realm injoignable » ;
- la session fictive dans l'onglet Session (renouveler/révoquer aboutissent tout de suite, sans wallet ni ordinateur).

## 9. Tests

- Chaîne simulée et gno.world simulé : tests unitaires des transitions (boop, ⏩, claim, création de pool ; message,
  réaction, nom, room ; /pair : code offert, code tapé → nom + room, Stop ; session accordée par le faux ordinateur).
- **Zéro réseau** : un test qui construit les services de démo, déroule les actions du guide et vérifie qu'aucun
  `fetch` ni appel gnonative n'a lieu.
- **Zéro trace** : même parcours, puis sortie ; AsyncStorage et SecureStore réels n'ont reçu aucune écriture (hors le
  drapeau « modale déjà proposée »), et l'état réel (session, nom, réglages) est identique.
- Guide : machine d'étapes (Next, action qui fait avancer, Skip, relance).
- Écrans (RNTL) : modale du premier lancement (une seule fois), section Réglages, confirmation de sortie, badge.
- `npx expo lint` et `npx tsc --noEmit` propres.

## 10. Décisions

| Décision | Par |
|---|---|
| Entrées : Réglages + modale au premier lancement (Essayer / Ignorer) | utilisateur |
| Aucun serveur ; rien de gardé après la démo | utilisateur |
| Guide pas à pas, ignorable, en bulles style B | utilisateur |
| Blocage États-Unis levé en démo ; pays de démo inventé et fixe | utilisateur (pays fixe : Claude) |
| Pas d'autres joueurs simulés ; la démo sert à tester, pas à paraître vivante | utilisateur |
| Bouton pour mettre le temps à zéro | utilisateur |
| Confirmation avant de quitter | utilisateur |
| Tout simuler, rien désactiver, y compris /pair et les partages | utilisateur |
| Liste et ordre des 9 étapes (dont /pair) ; Next + action qui fait avancer ; Skip reste en démo | Claude (validé dans la discussion) |
| Badge DEMO permanent, qui permet de quitter | Claude (validé dans la discussion) |
| Modale affichée une seule fois ; app tuée → redémarre en normal | Claude (validé dans la discussion) |
| Textes en anglais | Claude |
| Session fictive active d'office, solde ~100 GNOT | Claude |
| Contenu de départ inventé, jamais tiré de la production | Claude |
| /pair simulé : faux code, n'importe quel code accepté, nom `demo-you` + une room ; Stop garde nom et room | Claude |
| Liens externes (politique de confidentialité) inchangés en démo | Claude |
| Injection par un second objet `Services` + remontage de l'arbre | Claude |
| « Restart the guide » remet aussi la démo à zéro (avec confirmation) | Claude |
| Modale montrée une fois aussi aux installations existantes | Claude |
