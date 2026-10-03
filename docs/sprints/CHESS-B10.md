# Sprint CHESS-B10 — Shell dans le client

Découpage de [docs/shell-client.md](../shell-client.md). La maquette [docs/mockup](../mockup/index.html) ne change pas. Le plateau 3D, le grab et les règles non plus.

Ordre : B10a, puis B10b, puis B10c, puis B10d, puis B10e. Chaque ticket commence par un test qui échoue. Il se termine par `pnpm test` et `pnpm check`.

## CHESS-B10a — Réducteur d’écran

Fichiers : `src/renderer/shell/shellScreen.ts`, `tests/shellScreen.test.ts`.

Fait quand l’état initial est l’accueil, `chessPeer=1` ouvre la partie, Jouer va aux modes, Commencer va à la partie sauf en ligne, Échap ferme le tiroir puis ouvre la pause, un code refusé reste au salon, et un écran plein bloque la saisie.

## CHESS-B10b — Coque et accueil

Fichiers : `src/renderer/shell/shell.css`, `src/renderer/shell/ChessShell.tsx`, `src/renderer/main.tsx`.

Fait quand l’accueil montre le blason, Jouer, Classements, Options et Paramètres, et que la fenêtre pair n’affiche pas l’accueil.

## CHESS-B10c — Modes et partie

Fichiers : `ChessShell.tsx`, `src/renderer/ui/ChessGameplayHud.tsx`, `src/renderer/host/ChessDemoProject.ts`.

Fait quand Commencer émet `apply-session`, la barre porte le blason, le trait, la pendule, Assistant et Pause, et les boutons Mode et Options ont quitté le HUD.

## CHESS-B10d — Options et paramètres

Fait quand Options applique les préréglages graphiques tout de suite, et Paramètres mémorise volumes et langue, français par défaut.

## CHESS-B10e — Salon, classements, assistant

Fait quand créer une table ouvre la seconde fenêtre, un code refusé reste au salon, les classements ont deux onglets marqués exemple, et le tiroir dit qu’aucun modèle n’est branché tant que le pont coach n’est pas publié.

## Hors de ce sprint

Relais entre deux machines, compte, scores réels, Stockfish, et une carte Training.
