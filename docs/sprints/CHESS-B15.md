# Sprint CHESS-B15 — Assistant évolutif

Découpage de [docs/coach-ia.md](../coach-ia.md). La maquette d’abord. Le CPU heuristique ne change pas de rôle : il joue, la recherche commente, le modèle ne pose pas de coup.

[CHESS-B7](CHESS-B7.md) reste l’archive du premier découpage. Son panneau HUD ne se fait pas.

Ordre : B15a, puis B15b, puis B15c, puis B15d. B15a n’a pas de `pnpm test` : aucun module de `src/` n’est touché. Chaque ticket de code commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`.

## CHESS-B15a — Maquette du tiroir

Fichiers : `docs/mockup/index.html`, `docs/mockup/mockup.css`, `docs/mockup/mockup.js`, `docs/maquette-ui.md`.

Fait quand :

- Le tiroir a un cadre de présence en tête, avec le blason au repos. Le texte de la réponse est sous ce cadre.
- En partie ordinaire : Expliquer, Indice, question libre, bandeau « commentaire, pas un coup ».
- Une carte Entraînement mène à la partie. « Jouer le coup » déclenche l’intervention : blason, tremblement court, « Objection ! », puis le tiroir et l’arrêt de la partie. Stop reste possible sans ce cri.
- Le tiroir d’entraînement montre Stop ou Reprendre, Annuler mon coup, un curseur de 1 à 5, Expliquer mon erreur et Stratégie. Le plan est dessiné sur le plateau par des pièces fantômes, sans nom de case. Le premier est le plus net.
- Sans modèle, les fantômes restent et le texte ouvre Paramètres. En Apprendre, l’exemple ne nomme pas le coup du livre.
- Les réponses sont des phrases de la page. Pas de réseau.
- Échap ferme le tiroir avant d’ouvrir la pause.
- `docs/maquette-ui.md` décrit le cadre, les deux états et la carte Entraînement.

## CHESS-B15b — Photo, recherche, prompts

Fichiers : `src/chess/coach/coachContext.ts`, `src/chess/coach/coachPlan.ts`, `src/chess/coach/coachPrompt.ts`, `src/chess/coach/trainingReview.ts`, exports depuis `src/chess/index.ts`, `tests/coachTraining.test.ts`.

Fait quand :

- La photo contient FEN, trait, échec, mat, pat, matériel (barème du moteur heuristique), au plus 48 SAN, et l’historique.
- L’historique grandit sur un coup réussi et se vide au reset, au changement de mode et au rechargement FEN.
- Annuler mon coup retire le dernier coup de l’étudiant, et la réplique CPU qui l’a suivi. Stop empêche la réplique tant que la partie est tenue.
- `planAhead` rend une ligne légale de 1 à 5 demi-coups. Au-delà, la profondeur est ramenée à 5. La recherche s’arrête sur un budget de nœuds.
- Le prompt d’erreur cite le coup joué et le premier coup de la ligne. Le prompt de stratégie demande de garder ce premier coup. En quiz, aucune ligne ne désigne le coup du livre.
- Le message système répond dans la langue de la question, en anglais si elle est vide, et dit que la ligne est une recherche courte, pas une évaluation finale.
- Un tour de coach porte le texte, la ligne SAN et le drapeau « en train de parler ». Pas d’avatar.

## CHESS-B15c — IPC

Fichiers : `src/chess/coach/coachClient.ts`, `src/main/coachIpc.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/chessMaster.d.ts`, `tests/coachClient.test.ts`.

Fait quand :

- Local par défaut : `http://127.0.0.1:11434/v1`, sans clé. Distant : URL, modèle et clé.
- `coachSettings` renvoie le fournisseur, l’URL, le modèle et `hasKey`. Jamais la clé.
- `GET /v1/models` et `POST /v1/chat/completions` passent par le processus main. Timeout 60 s. L’annulation coupe la requête.
- Les tests passent avec un `fetch` simulé, sans Electron.

## CHESS-B15d — Tiroir et mode Entraînement

Fichiers : `src/renderer/shell/ChessShell.tsx`, `src/renderer/host/ChessDemoProject.ts`, `src/chess/play/parseChessDemoQuery.ts`, `docs/shell-client.md`. Pas de second panneau HUD.

Fait quand :

- `chess=training` est le mode Entraînement. `chess=train` reste l’alias Apprendre.
- La carte Entraînement de la coque émet `apply-session`.
- Quand l’assistant coupe de lui-même, le client joue le même temps : blason, tremblement court, « Objection ! », puis le tiroir. Stop, demandé par l’étudiant, fige sans ce cri.
- Stop annule la réplique en cours et fige les pendules. Reprendre les relance. Annuler mon coup reconstruit la position d’avant et laisse la partie en pause.
- Expliquer, Indice, question libre, Expliquer mon erreur et Stratégie appellent `coachChat` avec le tour de B15b. Sans pont, le tiroir dit qu’aucun modèle n’est branché. La ligne de la recherche est montrée par des pièces fantômes sur le plateau, pas par des noms de cases.
- `coachBusy` n’est pas réutilisé.
- `docs/shell-client.md` décrit ce branchement.

## Hors de ce sprint

- Avatar, voix, visème.
- Stockfish, ou un modèle branché sur `IChessEngine`.
- Streaming SSE.
- Fil de plus d’un échange.
