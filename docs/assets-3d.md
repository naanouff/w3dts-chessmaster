# Assets 3D Staunton

Les pièces jouées viennent de maîtres locaux. Le client charge le `.wmesh` et les WebP copiés dans le dépôt. Les GLB et le fichier Blender restent la source, à pleine définition, hors git. Les photos de référence du jeu marbre et bois sont dans [pieces.md](pieces.md).

Sprint d’implémentation : [CHESS-B9](sprints/CHESS-B9.md). Le dossier des binaires est [docs/raw_assets](raw_assets/README.md).

[scripts/import-hd-pieces.mjs](../scripts/import-hd-pieces.mjs) lit `docs/raw_assets/pieces/glb`, décode le Draco et écrit un `.wmesh` aux hauteurs Staunton (les exports font 0,12 m). Les noirs sont tournés de 180° : les blancs regardent +Z, les noirs −Z. [scripts/bake-piece-textures.mjs](../scripts/bake-piece-textures.mjs) en extrait les cartes. [src/renderer/host/hdChessPieces.ts](../src/renderer/host/hdChessPieces.ts) sert le `.wmesh` et le WebP du palier graphique ; le GLB n’est lu que si le WebP manque.

```mermaid
flowchart LR
  blend["pieces.blend"]
  glb["raw_assets/pieces/glb"]
  board["raw_assets/board"]
  wmesh["public/models/chess/*.wmesh"]
  webp["tex WebP"]
  blend --> glb
  glb --> wmesh
  glb --> webp
  board --> wmesh
  board --> webp
```

## Ce qui reste à pleine qualité

Douze GLB, 21 à 29 Mo chacun, liens durs vers `Print/Models/Echecs`. Chaque mesh joué tient autour de 30 000 triangles (pion blanc 30 476). Les cartes WebP et le `.wmesh` doivent venir du même maître : un atlas d’une autre export casse les UV. Le reste du fichier est une carte unique par pièce, sans fichier partagé d’une pièce à l’autre :

- normale 4096, PNG, environ 12 à 16 Mo
- couleur 4096, JPEG, environ 8 à 11 Mo
- ORM 2048, JPEG, environ 1,1 à 1,6 Mo

Le sujet (pion) garde une densité haute : 256 / 512 / 1024. Reine, roi et plateau prennent un cran de plus (512 / 1024 / 2048). Les props de scène partent au huitième de cette densité, plafonnés à 2048 ; seuls les paliers réellement demandés de Fluide à Qualité sont versionnés dans `public/sets` (`pnpm ship:set-props`). Couleur et ORM sont lossy (qualité 82 et 80). Les normales restent en WebP lossless. Voir [texelDensity.ts](../src/renderer/graphics/texelDensity.ts). `pnpm prune:public` retire le reste avant `pnpm dist` et `pnpm build:web`.

On ne décime pas les maillages Staunton : le cavalier et les profils tournés se lisent dans la silhouette. On ne réencode pas les maîtres 4K.

Les douze pièces jouées sont les GLB marbre, bois et or (Draco dans le maître). L’import décode, mesure la hauteur et pose chaque rôle à sa hauteur Staunton : roi 9,2 cm, reine 7,8 cm, fou et cavalier 6,2 cm, tour 6 cm, pion 5,4 cm, base en y = 0. Les noirs sont tournés de 180°. Les normales qui se rencontrent sous 60° sont lissées, comme la coupe du jardin.

La couleur Meshy est en 8 192. Le bake sert 256 / 512 / 1024 pour le sujet, et 512 / 1024 / 2048 pour reine, roi et plateau. Une carte 8K n’est pas servie.

`pieces.blend` (~575 Mo) est le fichier Blender. `pieces.blend1` est une sauvegarde du même ordre de taille : elle ne entre pas dans `docs/raw_assets`.

## Plateau

`chess_board_B.glb` est le premier maître ajouté après les pièces. Même contrat : lien dur, `.wmesh`, WebP, pas de GLB dans `public/`. Les cartes du plateau sont un cran au-dessus du pion : 512, 1024 et 2048. L’encodeur est celui des pièces.

Le fichier est en Z-up, un mètre de côté. [scripts/import-hd-board.mjs](../scripts/import-hd-board.mjs) le pose à plat, à l’encombrement visuel du plateau (`CHESS_BOARD_MESH_EXTENT`), face supérieure en y = 0. Le client dessine encore le plateau procédural : ce maillage n’est pas encore celui de la scène.

## Dossier des maîtres

```
docs/raw_assets/
  README.md
  pieces/
    pieces.blend
    glb/
      b_pion.glb  b_tour.glb  b_cavalier.glb  b_fou.glb  b_reine.glb  b_roi.glb
      n_pion.glb  n_tour.glb  n_cavalier.glb  n_fou.glb  n_reine.glb  n_roi.glb
  board/
    chess_board_B.glb
```

`b_` est le camp blanc, `n_` le camp noir. Les noms de fichiers restent ceux des exports.

Les maîtres ne vont pas dans git : le dépôt n’a pas de LFS. Seuls les textes de `docs/raw_assets` sont versionnés. Sur disque, chaque maître est un lien dur NTFS vers son fichier d’origine, sur le même volume. Une seule copie réelle.

Les pièces pointent vers `c:/Local/Travail/Print/Models/Echecs`. Le plateau pointe vers le GLB d’apport, aujourd’hui `Downloads/chess_board_B.glb`.

## Runtime

`public/models/chess/` ne garde que les `.wmesh` et les WebP runtime demandés par la densité (Fluide → Qualité) : pions/tours/cavaliers/fous en `256/512/1024`, reines/rois et plateau en `512/1024/2048`. Ces fichiers sont dans git, pour que l’installateur et le build web les servent. L’import n’y dépose plus le GLB, et les `.glb` restent ignorés. `pnpm prune:public` (appelé par `pnpm build` / `pnpm build:web`) retire les GLB locaux et les tailles hors échelle. Les pixels des pièces ne changent pas tant que le bake relit les mêmes GLB.

Le repli qui fetch `/models/chess/{fichier}.glb` dans `hdChessPieces.ts` reste. Sans WebP, ce fetch échoue. Pas d’autre chemin de chargement.

Les HDRI 2K de `public/hdri/` restent à leur place (`studio_kontrast_04_2k.hdr`, `neon_photostudio_2k.hdr`). `monochrome_studio_04_2k.hdr` est cité dans le code et absent du disque : on ne le fabrique pas.

## Pipeline

```bash
node scripts/import-hd-pieces.mjs
node scripts/import-hd-board.mjs
pnpm bake:piece-textures
```

La preuve que l’échelle, le yaw des noirs et les cartes des pièces n’ont pas bougé est un hash identique des `.wmesh` et des WebP de pièces, avant et après ces commandes. Les hauteurs sont celles de `stauntonPieceHeight` : roi 9,2 cm, reine 7,8 cm, fou et cavalier 6,2 cm, tour 6 cm, pion 5,4 cm.

## Décors

Les cinq ambiances et les props à modéliser sont dans [ambiances.md](ambiances.md). L’atelier, le salon, le club, le jardin et la terrasse ont leurs GLB Meshy dans `docs/raw_assets/`, hors git. Les cinq ambiances sont dans la scène jouable, dans Options et dans la revue (`pnpm review`).

`pnpm clean:set-props` remet l’échelle de la fiche, réduit les cartes en JPEG 256, 512, 1024 et 2048, et ajoute l’émission des sources. Le résultat est `docs/raw_assets/<ambiance>/baked/<taille>/`. Pas de Draco : l’atelier, le salon et le club sont sous 6 000 sommets, le jardin et la terrasse sous 14 000.
