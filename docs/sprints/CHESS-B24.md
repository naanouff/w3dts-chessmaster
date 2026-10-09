# Sprint CHESS-B24 — Prêt pour l’alpha

Découpage de [Plan QA de l’alpha](../qa-alpha.md), section Décisions alpha. On livre ce qui bloque l’entrée en campagne : crans CPU, fins molles, matériel insuffisant, Objection en prod, guide coach, banc et relais.

Ordre : B24a → B24b → B24c → B24d → (validation maquette) → B24e → B24f → B24g → B24i → B24h (banc en dernier). Chaque ticket de code commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande. Un écran nouveau ou modifié passe d’abord par `docs/mockup` ; le client ne le reçoit qu’après validation explicite.

## CHESS-B24a — Contrats

Fichiers : [fin-partie.md](../fin-partie.md), [shell-client.md](../shell-client.md), [qa-alpha.md](../qa-alpha.md), [maquette-ui.md](../maquette-ui.md) si le parcours change.

Fait quand :

- [fin-partie.md](../fin-partie.md) décrit l’abandon (carte Perdu), la nulle proposée (acceptée / refusée), et la nulle pour matériel insuffisant. Il retire « Pas d’abandon » et « L’objection reste dans la maquette ».
- Contre l’ordinateur : Proposer nulle fait accepter le CPU si l’évaluation heuristique à la profondeur courante est dans ±50 centipions (ni échec subi, ni mat forcé en un coup) ; sinon il refuse. En hotseat, l’autre camp clique Accepter ou Refuser. En `p2p`, le fil porte l’offre et la réponse.
- Pas de règle des 50 coups ni de triple répétition dans ce contrat.
- [shell-client.md](../shell-client.md) dit que Modes n’affiche que les crans 1–3, et que Pause porte Abandon et Proposer nulle.
- [qa-alpha.md](../qa-alpha.md) pointe vers ce sprint.

Pas de code. Pas de maquette dans ce ticket.

## CHESS-B24b — Crans 1–3

Fichiers : `docs/mockup/mockup.js`, `docs/mockup/index.html` si besoin, `tests/shellScreen.test.ts` (ou voisin), `src/renderer/shell/shellScreen.ts`, `src/renderer/shell/ChessShell.tsx`.

Fait quand :

- La maquette Modes ne propose que 1, 2 et 3.
- `parseStoredLevel` ramène 4 et 5 (et toute valeur hors 1–3) au cran 2.
- Le curseur du client a `max={3}`.
- Un ancien `w3dts-chess-shell` avec `level: 5` s’ouvre au cran 2.
- `cpuSearchDepth` reste inchangé.

## CHESS-B24c — Matériel insuffisant

Fichiers : `tests/chessHudState.test.ts` ou `tests/chessMatch.test.ts` (celui qui porte l’issue), `src/chess/rules/ChessMatch.ts` si une aide manque, `src/renderer/shell/shellScreen.ts`, `src/renderer/host/ChessDemoProject.ts`, catalogues `src/renderer/shell/copy/*` (huit langues).

Fait quand :

- Roi contre roi (et les fins `isEnd()` sans mat ni pat) produisent une issue de nulle, cause `insufficient` (ou le nom choisi dans B24a).
- La carte de fin s’ouvre avec le titre Nulle et une ligne du catalogue (ex. « Matériel insuffisant. »).
- Un test Vitest échoue avant le correctif, puis passe.
- La table ne reste plus figée sans carte.

## CHESS-B24d — Maquette : abandon et nulle

Fichiers : `docs/mockup/index.html`, `docs/mockup/mockup.css`, `docs/mockup/mockup.js`, [maquette-ui.md](../maquette-ui.md).

Fait quand :

- Pause montre Abandon et Proposer nulle.
- Abandon ouvre la carte Perdu (ligne d’abandon).
- Proposer nulle : en hotseat, l’autre camp voit Accepter / Refuser ; Accepté ouvre la carte Nulle ; Refusé revient à la partie.
- Contre l’ordinateur : une courte confirmation, puis acceptation ou refus selon la règle de B24a (la maquette peut simuler les deux).
- [maquette-ui.md](../maquette-ui.md) décrit ces contrôles.

Le client n’est pas touché. Ce ticket s’arrête à la validation explicite de la maquette.

## CHESS-B24e — Client : abandon et nulle

Fichiers : ceux de la pause et de la fin dans `src/renderer/shell/`, `src/chess/net/chessWire.ts` si l’offre part en `p2p`, tests `tests/shellScreen.test.ts` / `tests/chessWire.test.ts`, catalogues des huit langues.

Fait quand :

- Après validation de B24d, Pause porte les deux actions.
- Abandon termine la partie : carte Perdu, pas de sauvegarde d’interruption nouvelle pour une partie finie.
- Proposer nulle suit le contrat B24a (CPU, hotseat, `p2p`).
- Les huit catalogues ont les clés nouvelles.
- Échap et la carte de fin restent ceux de [fin-partie.md](../fin-partie.md).

## CHESS-B24f — Objection en prod

Fichiers : `src/renderer/shell/ChessShell.tsx` (et CSS voisin), éventuellement le bus / l’hôte qui signale le coup faible en entraînement. Contrat déjà dans [fin-partie.md](../fin-partie.md) et la maquette B18.

Fait quand :

- En entraînement, quand l’assistant coupe de lui-même, le cri suit la maquette : tremblement, blason, « Objection ! », seconde ligne, ~1,6 s, réduction vers le cadre du tiroir.
- Pas de bouton sur le cri. Le pointeur le traverse.
- Mouvement réduit : ni claque ni tremblement ; la phrase est seulement dans le tiroir.
- Stop garde le focus.
- « Jouer le coup » vert (recommandé) ne déclenche pas le cri.

## CHESS-B24g — Guide Ollama

Fichiers : [coach-ia.md](../coach-ia.md) (section Installation), [qa-alpha.md](../qa-alpha.md) (lien), éventuellement une page courte si le guide dépasse une section.

Fait quand :

- Un testeur Windows lit la section et sait : installer Ollama, tirer `llama3.2`, lancer le service, ouvrir Paramètres dans ChessMaster, vérifier que le coach répond.
- Le cas sans modèle reste le nominal de l’alpha.
- Pas de nouvelle dépendance npm.

## CHESS-B24h — Banc graphique ✅

Fichiers : [profil-graphismes.md](../profil-graphismes.md) (relevé), `pnpm bench:graphics:presets`, garde vsync (période d’écran), `tmp/graphics-bench.json` hors git.

Fait :

- Machine de campagne : RTX 3070 Ti seule (pas de GPU intégré PnP). Passe iGPU : non mesurable ; arbitrage ouverture sur RTX.
- `pnpm bench:graphics:presets` (2026-10-09) : Fluide 7,3 ms @ 1080p, 7,8 ms @ ~3440×1440 — largement sous 33 ms.
- Médianes des quatre préréglages dans le relevé. Pas de changement de préréglage.

## CHESS-B24i — Relais ✅

Fichiers : [multijoueur.md](../multijoueur.md) (Alpha : charge et astreinte), [qa-alpha.md](../qa-alpha.md) (brief + tableau).

Fait :

- Smoke prod `tmp/smoke-relay.ps1` (2026-10-09) : 3 tables × 2 pairs, 5 coups, `ok: true` ; `health` = `ok`.
- Astreinte ouverture : Cyril TARRIET.
- Brief testeurs : redémarrage du relais vide les salles.

## Hors de ce sprint

- Règle des 50 coups, triple répétition, Stockfish.
- Avatar du coach, streaming SSE.
- Nouvelle ambiance, nouveaux props.
- Classements réels, comptes.
- Publier une release GitHub (ça reste le flux `release/X.Y.Z` après ce sprint).
