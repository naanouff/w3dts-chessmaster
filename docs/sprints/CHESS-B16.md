# Sprint CHESS-B16 — Ambiances dans la partie

Découpage de [docs/ambiances.md](../ambiances.md). Atelier, salon et club. Atelier est le défaut. Jardin et terrasse restent dehors. L’arrivée caméra reste dans la maquette 3D.

La ligne visible passe d’abord par la maquette. B16d ne commence qu’après « applique en prod ». B16b et B16c ne dessinent pas le shell : ils peuvent avancer pendant que la feuille Options est encore en maquette.

Ordre : B16a, puis B16b, puis B16c. B16d après la validation. B16a n’a pas de `pnpm test` : aucun module de `src/` n’est touché. Chaque ticket de code commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`.

## CHESS-B16a — Maquette du choix

Fichiers : `docs/mockup/index.html`, `docs/mockup/mockup.js`, `docs/maquette-ui.md`.

Fait quand :

- Options a une section « Choix de l’ambiance » au-dessus des préréglages.
- Trois boutons : Atelier, Salon, Club. Atelier est sélectionné à l’ouverture.
- Le choix reste dans la session de la maquette. Pas de `localStorage`, pas de scène 3D.
- `docs/maquette-ui.md` ne dit plus qu’Options ne contient que le rendu.

## CHESS-B16b — Préférence

Fichiers : un module sous `src/`, `tests/` pour ce contrat. Pas `ChessShell`.

Fait quand :

- L’identifiant est `atelier`, `salon` ou `club`. Le défaut est `atelier`.
- La clé est `w3dts-chess-ambiance`. Elle n’est pas dans `w3dts-chess-graphics` ni dans `w3dts-chess-shell`.
- Une valeur absente ou inconnue retombe sur Atelier.
- Lire ou écrire cette préférence ne change pas le préréglage graphique.

## CHESS-B16c — Décor dans la scène

Fichiers : `src/renderer/host/ChessDemoProject.ts`, le chargement des props, `public/sets/<scène>/<taille>/`. Les tests nomment le décor, l’HDRI et le palier, sans GPU.

Fait quand :

- Au démarrage, et quand la préférence change, le décor affiché est celui demandé. La partie en cours n’est pas recommencée.
- `ChessStudioCloth` n’est pas créé quand les GLB du décor sont là. Le dessus de table laisse la surface de jeu en y = 0.
- Le plateau, les pièces et la caméra de partie ne changent pas.
- Les fichiers lus sont `public/sets/<scène>/<taille>/<prop>.glb`. La taille est 256, 512 ou 1024, la même que `pieceTextureSize`. Pas de passe GPU nouvelle.
- Le cyclorama d’atelier et la table de verre du club sont procéduraux. `cyclorama.glb` et `table.glb` du club ne sont pas chargés. Le rail cyan n’est pas posé.
- L’HDRI est Kontrast pour l’atelier, monochrome pour le salon, néon pour le club. Le soleil directionnel change d’intensité. Les spots de la maquette three.js ne sont pas ajoutés.
- Si un GLB manque, le plan de toile actuel reste et la partie démarre. La préférence n’est pas réécrite.

## CHESS-B16d — Options dans le client

Ne pas commencer avant « applique en prod » sur B16a.

Fichiers : `src/renderer/shell/ChessShell.tsx`, `src/renderer/shell/copy/` (les huit catalogues).

Fait quand :

- La section validée en maquette est dans Options, au-dessus des préréglages, avec les mêmes trois boutons. Atelier est le défaut.
- Le libellé vient des catalogues. Aucune chaîne visible en dur.
- Choisir une ambiance écrit `w3dts-chess-ambiance` et le décor change sans quitter la partie.

## Hors de ce sprint

- Terrasse et jardin.
- L’arrivée caméra de `docs/mockup/ambiances.html`.
- Spots, rect area, SSR, HBAO et DOF de cette maquette three.js.
- Un `.wmesh` par prop.
