# Sprint CHESS-B19 — Ombre dure

Découpage de [docs/ombres.md](../ombres.md). Fluide garde les ombres. Aucun autre drapeau de préréglage ne change. La carte 1024 et l’unique couche sont le moteur, pas ce dépôt.

Ordre : B19a, puis B19b, puis B19c. Chaque ticket de code commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`. B19c est la maquette.

## CHESS-B19a — Une lecture

Fichiers : `tests/chessGraphics.test.ts`, `public/shaders/shared/pbr_functions.wgsl`.

Fait quand :

- `fetchShadow` fait un seul `textureSampleCompareLevel`.
- La boucle de bloqueurs et la grille 5×5 n’y sont plus.
- Le brouillard volumétrique et le terrain ne changent pas.

## CHESS-B19b — Plateau et pièces

Fichiers : `src/renderer/host/ChessDemoProject.ts`, `src/renderer/host/spawnChessSet.ts`, `src/renderer/host/chessAmbiance.ts`, le test du contrat.

Fait quand :

- L’emprise d’ombre est `CHESS_BOARD_MESH_EXTENT` en XZ, et la hauteur des pièces en Y. Les 4,2 m de la table n’y sont plus.
- Les meubles ne projettent pas. Aucun spot ni point d’ambiance ne projette, y compris le spot du plafond du club.
- Le corps du plateau et les pièces projettent encore.
- Le jeu ne raccourcit pas `shadowLayerViews`.

## CHESS-B19c — Le curseur sort de la maquette

Fichiers : `docs/mockup/index.html`, `docs/mockup/mockup.js`.

Fait quand :

- La rangée « Cascades d’ombres » n’est plus dans Options.
- Un préréglage ne se compare plus sur un nombre de cascades.

## Hors de ce sprint

- Le client (`ChessShell`, le menu graphique, les huit catalogues). Il attend la validation de la maquette.
- Carte 1024, une couche ajustée à l’emprise seule, les sept autres non dessinées. C’est `@naanouff/w3dts-core`, après 0.0.36.
- Détacher les vues d’ombre depuis le jeu.
- Changer l’occlusion, les reflets, le bloom, l’anticrénelage ou la silhouette d’un préréglage.
