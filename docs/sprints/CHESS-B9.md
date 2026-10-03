# Sprint CHESS-B9 — Sources 3D

Découpage de [docs/assets-3d.md](../assets-3d.md). Les maillages des pièces, leurs cartes 4K et leurs paliers WebP ne changent pas. Le client, les presets graphiques et le repli GLB de `hdChessPieces.ts` non plus.

Ordre : B9a, puis B9b, puis B9c. Pas de test nouveau : aucun module de `src/` n’est touché. La preuve est le hash des fichiers de pièces déjà bakés.

## CHESS-B9a — Maîtres sur disque

Poser les liens durs. Ne pas copier : `docs/raw_assets` et `c:/Local/Travail/Print/Models/Echecs` sont sur le même volume. Si le lien dur échoue, s’arrêter.

Fichiers :

- `docs/raw_assets/pieces/pieces.blend` — lien dur, pas `pieces.blend1`
- `docs/raw_assets/pieces/glb/*.glb` — les douze exports
- `.gitignore` — `*.blend`, `*.blend1`, `*.glb` sous `docs/raw_assets/`

`docs/raw_assets/README.md` existe déjà. Ne pas y recopier le contrat.

Fait quand :

- Chaque maître partage l’inode du fichier dans `Print/Models/Echecs`.
- `pieces.blend1` est absent de `docs/raw_assets`.
- `git status` ne liste ni le blend ni les GLB.

## CHESS-B9b — Import, bake, runtime allégé

Brancher les scripts sur le dossier du dépôt, puis prouver que le résultat baké des pièces est le même.

Avant de relancer quoi que ce soit, hasher les `.wmesh` et les WebP de pièces déjà dans `public/models/chess/`.

Fichiers :

- `scripts/import-hd-pieces.mjs` — `sourceDir` = `docs/raw_assets/pieces/glb`. Ne plus poser de lien dur du GLB dans `public/`.
- `scripts/bake-piece-textures.mjs` — lire ces GLB. Qualité WebP, tailles 256 / 512 / 1024 et pipeline des normales : inchangés.

Ensuite :

```bash
node scripts/import-hd-pieces.mjs
pnpm bake:piece-textures
```

Retirer les douze `public/models/chess/*.glb` par unlink du nom. Ce sont des liens durs : effacer ce chemin ne doit pas effacer le maître dans `Print/Models/Echecs` ni celui de `docs/raw_assets`.

Fait quand :

- Les deux scripts lisent `docs/raw_assets/pieces/glb`.
- `public/models/chess/` ne contient plus de GLB de pièce.
- Chaque `.wmesh` et chaque WebP de pièce a le même hash qu’avant les deux commandes.
- Si un WebP de pièce change alors que les réglages de bake n’ont pas bougé, s’arrêter.

## CHESS-B9c — Plateau

Premier maître ajouté. Même contrat que les pièces, cartes à 512, 1024 et 2048.

Fichiers :

- `docs/raw_assets/board/chess_board_B.glb` — lien dur vers le GLB d’apport
- `scripts/import-hd-board.mjs` — Y-up, côté ramené à `CHESS_BOARD_MESH_EXTENT`, face supérieure en y = 0
- `scripts/bake-piece-textures.mjs` — mêmes qualités, tailles 512 / 1024 / 2048

Fait quand :

- Le GLB partage l’inode de la source et n’est pas copié dans `public/`.
- `chess_board_B.wmesh` et `tex/{512,1024,2048}/chess_board_B-{color|normal|orm}.webp` existent.
- Les hashs des pièces restent ceux de B9b.

## Hors de ce sprint

- Décimer les maillages, ou quantifier le `.wmesh`.
- Réencoder les PNG et JPEG 4K, ou passer les normales en WebP lossy.
- KTX2, meshopt, ou un second format de mesh.
- Déplacer les HDRI, ou créer `monochrome_studio_04_2k.hdr`.
- Changer un preset dans `chessGraphicsSettings.ts`.
- Remplacer le fetch de repli dans `hdChessPieces.ts`.
- Afficher `chess_board_B` à la place du plateau procédural.
