# Sprint CHESS-B14 — Persistance

Découpage de [docs/persistance.md](../persistance.md). Ce sprint ne branche pas l’écran Sauvegardes dans le client.

Ordre : B14a, puis B14b, puis B14c, puis B14d, puis B14e. Chaque ticket de code commence par un test qui échoue. Il se termine par `pnpm test` et `pnpm check`. B14a n’a pas de `pnpm test` : aucun module de `src/` n’est touché.

## CHESS-B14a — Maquette Sauvegardes

Fichiers : `docs/mockup/index.html`, `docs/mockup/mockup.css`, `docs/mockup/mockup.js`, `docs/maquette-ui.md`, `docs/shell-client.md`.

Fait quand :

- L’accueil a un lien « Sauvegardes » à côté de Classements, et une ligne « Partie interrompue » avec Restaurer.
- L’écran montre le bandeau d’interruption, puis deux volontaires d’exemple : « Sur cet ordinateur » et « En ligne ». Restaurer, Écarter et Supprimer sont cliquables dans la page. L’état vide ne montre pas de fausse partie.
- Pause a « Sauvegarder », avec une confirmation en une ligne, et « Sauvegardes ». Reprendre ramène à la table.
- Échap ferme l’écran et revient à l’écran précédent.
- `docs/maquette-ui.md` décrit l’écran, le lien d’accueil et les boutons de pause.
- `docs/shell-client.md` dit que le client attend cette maquette.

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

## Hors de ce sprint

- L’écran React dans `src/renderer/shell`, le lien d’accueil et les boutons de pause du client. Ils attendent un « applique en prod » sur la maquette de B14a.
- Un relais entre deux machines. La restauration en ligne reste le salon et le message `restore` sur le canal déjà là.
