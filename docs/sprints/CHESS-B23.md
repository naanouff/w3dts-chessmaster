# Sprint CHESS-B23 — Survol de la pièce

Découpage de [Survol](../survol.md). Avant le clic, la case de la pièce que le rayon prendrait porte une lueur ivoire. Le dépôt garde ses couleurs.

Ordre : B23a, puis B23b, puis B23c. Chaque ticket commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande.

## CHESS-B23a — La case

Fichiers : `tests/pieceHover.test.ts`, `src/chess/grab/pieceHover.ts`, l’export dans `src/chess/index.ts` à côté des aides de prise.

Fait quand :

- La pièce est de la couleur qui joue, et de la couleur locale hors hotseat : la fonction rend sa case.
- En hotseat, les deux camps rendent leur case quand c’est à eux de jouer.
- Une case vide, une pièce adverse, la partie finie, l’ordinateur qui réfléchit, ou une pièce en vol rendent null.
- Le nom exporté est `pieceHoverSquare`.

## CHESS-B23b — L’ivoire

Fichiers : `tests/chessProceduralLook.test.ts`, `src/renderer/host/chessLook.ts`.

Fait quand :

- La recette du survol est ivoire, et le plus fort canal de son émission est au plus 1.
- Elle n’est pas dans `CHESS_MOVE_GLOW_RECIPES`. Le test qui exige un pic au-dessus de 1 pour ces recettes reste vrai.

## CHESS-B23c — Le plan

Fichiers : `src/renderer/host/ChessDemoProject.ts`.

Fait quand :

- Le pointeur est sur le canvas, le bouton est relâché, et le rayon touche une pièce que B23a accepterait : le plan de dépôt se pose sur sa case, avec la recette de B23b.
- Le rayon est celui du clic : `CHESS_GROUP_PIECE`, la même distance.
- Le bouton enfoncé, ou une pièce déjà tenue : le plan reprend or, bleu ou rouge, comme avant ce sprint.
- Le pointeur sort du canvas : le plan s’éteint.

La page [Survol](../survol.md) est le contrat. On n’y ajoute une phrase que si le code s’en écarte.

## Hors de ce sprint

- Un contour de silhouette, et toute passe nouvelle.
- La maquette et les catalogues de langue.
- Les couleurs du liseré du coach.
- Les lueurs de dépôt, de spline, et le vert des coups légaux.
