# Sprint CHESS-B14 — Persistance

Découpage de [docs/persistance.md](../persistance.md). La maquette validée, l’écran Sauvegardes est aussi dans le client.

Ordre : B14a, puis B14b, puis B14c, puis B14d, puis B14e. Chaque ticket de code commence par un test qui échoue. Il se termine par `pnpm test` et `pnpm check`. B14a n’a pas de `pnpm test` : aucun module de `src/` n’est touché.

## CHESS-B14a — Maquette Sauvegardes

Fichiers : `docs/mockup/index.html`, `docs/mockup/mockup.css`, `docs/mockup/mockup.js`, `docs/maquette-ui.md`, `docs/shell-client.md`.

Fait quand :

- L’accueil a un lien « Sauvegardes » à côté de Classements, et un bouton « Reprendre la partie » centré sous Jouer.
- L’écran montre le bandeau d’interruption, puis deux volontaires d’exemple : « Sur cet ordinateur » et « En ligne ». Restaurer, Écarter et Supprimer sont cliquables dans la page. L’état vide ne montre pas de fausse partie.
- Pause a « Sauvegarder », avec une confirmation en une ligne, et « Sauvegardes ». Reprendre ramène à la table.
- Échap ferme l’écran et revient à l’écran précédent.
- `docs/maquette-ui.md` décrit l’écran, le lien d’accueil et les boutons de pause.
- `docs/shell-client.md` décrit l’écran dans le client.

## CHESS-B14b — Habitudes

Fichiers : `src/renderer/shell/shellScreen.ts`, `tests/shellScreen.test.ts`.

Fait quand :

- `parseShellPrefs` relit le mode, la couleur, le niveau et l’ECO.
- Un mode, une couleur, un niveau ou un ECO inconnu, ou un JSON illisible, retombe sur l’ordinateur, les blancs, le niveau 2 et la première ouverture.
- Les volumes et la langue déjà lus ne changent pas.

## CHESS-B14c — Casier

Fichiers : `src/chess/play/savedGames.ts`, `tests/savedGames.test.ts`.

Fait quand :

- Un JSON illisible donne un casier vide.
- Une position de départ intacte et une partie finie ne deviennent pas une fiche.
- Écrire une interruption ne retire pas une volontaire. Écrire une volontaire ne retire pas l’interruption.
- `local` et `online` sont acceptés, comme `cpu`, `hotseat` et `learn`.
- La vingt-et-unième volontaire retire la plus ancienne. L’interruption ne compte pas dans ce plafond.

## CHESS-B14d — Pendule, leçon, fil

Fichiers : `src/chess/play/chessClock.ts`, `src/chess/learn/OpeningTrainer.ts`, `src/chess/net/chessWire.ts`, `src/renderer/host/ChessDemoProject.ts`, `tests/chessClock.test.ts`, `tests/openingTrainer.test.ts`, `tests/chessWire.test.ts`.

Fait quand :

- `stepChessClock` ne bouge pas quand la table est couverte, ni quand une partie `p2p` n’a pas encore de pair.
- `OpeningTrainer.seek` pose le curseur sans dépasser la fin de la ligne.
- `decodeChessWire` accepte `restore` avec les deux pendules. Un `sync` sans pendules reste valable.
- `reset` remet toujours les pendules à 10:00. `restore` applique les temps reçus.

## CHESS-B14e — Fenêtre

Fichiers : `src/main/windowBounds.ts`, `src/main/index.ts`, `tests/windowBounds.test.ts`.

Fait quand :

- `clampWindowBounds` ramène une fenêtre hors écran ou trop petite sur le bureau visible, en 1280×800.
- Une fenêtre entièrement visible et assez grande est reprise telle quelle, y compris agrandie.
- Le processus principal lit et écrit `userData/window-bounds.json`.

## CHESS-B14f — Écran dans le client

Fichiers : `src/renderer/shell/ChessShell.tsx`, `src/renderer/shell/shell.css`, `src/renderer/shell/copy`, `src/renderer/host/ChessDemoProject.ts`, `src/renderer/main.tsx`.

Fait quand :

- L’accueil a le lien « Sauvegardes », le bouton « Reprendre la partie » sous Jouer, et un panneau assez large pour les cinq liens.
- L’écran liste l’interruption et les volontaires. Restaurer, Écarter et Supprimer agissent sur le casier. L’état vide ne montre pas de fausse partie.
- Pause a « Sauvegarder », avec une confirmation en une ligne, et « Sauvegardes ».
- Une partie en cours s’écrit dans l’interruption. Une nouvelle partie l’efface. Restaurer une partie locale ouvre la seconde fenêtre. Restaurer une partie en ligne ouvre le salon et envoie `restore` à la connexion.

## Hors de ce sprint

- Un relais entre deux machines. La restauration en ligne reste le salon et le message `restore` sur le canal déjà là.
