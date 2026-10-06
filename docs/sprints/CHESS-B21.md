# Sprint CHESS-B21 — Upscale spatial et demi-résolution de l’occlusion

Découpage de [docs/upscale.md](../upscale.md). La 4K fait souffler la carte : le travail par pixel descend, la sortie garde la taille du canvas. Prend la suite de [CHESS-B20](CHESS-B20.md), dont les trois modes d’ombre et l’emprise au plateau restent acquis.

Ordre : B21a, puis B21b, puis B21c, puis B21d, puis B21e. Chaque ticket commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande. Aucun banc lancé dans ce sprint.

## CHESS-B21a — L’échelle est un réglage

Fichiers : `tests/chessGraphics.test.ts`, `src/renderer/graphics/chessGraphicsSettings.ts`.

Fait quand :

- `ChessUpscale` vaut `off`, `quality` ou `performance`, et `ChessGraphicsSettings` porte le champ `upscale`.
- `upscaleRenderScale` rend 1, deux tiers, un demi.
- `scaleChessGraphResources` multiplie les textures `relative`, laisse les `absolute` seules, et garde chaque fraction sous `1 - 1e-5` pour échapper à la recréation du moteur à la taille de `FINAL_OUTPUT`.
- La même fonction applique le demi à `hbaoRaw`, `hbaoBlurred` et `ssrBuffer`, échelle comprise.
- `gamePassNames` contient `08_Upscale` dans tous les cas, anticrénelage coupé compris.
- Fluide et Équilibré sont en `off`, Qualité et Natif en `quality`. `performance` n’est dans aucun préréglage.
- Un profil enregistré sans `upscale` se relit en `off`.

## CHESS-B21b — Le graphe et le shader

Fichiers : `public/graphs/StandardLitGraphChess.json`, `public/shaders/post-processing/spatial_upscale.frag.wgsl`.

Fait quand :

- La cible `ldrAntialiased` existe, en `rgba8unorm`, relative 1.0.
- `07_FXAA` écrit `ldrAntialiased` et plus `FINAL_OUTPUT`.
- `08_Upscale` est la dernière passe : entrée `ldrAntialiased`, sortie `FINAL_OUTPUT`, shader `/shaders/post-processing/spatial_upscale.frag.wgsl`, uniforme `sharpness` à 0.
- `hbaoRaw`, `hbaoBlurred` et `ssrBuffer` sont déclarées à 0.5, et `blurParams` de `04c_HBAO_Blur` passe de 12 à 6.
- Le shader prend un `f32` nu au binding 2, comme `threshold` dans `bright.frag.wgsl`, et son en-tête est en anglais.

## CHESS-B21c — La scène pose l’échelle

Fichiers : `tests/chessGraphics.test.ts`, `src/renderer/host/ChessDemoProject.ts`, `src/renderer/graphics/chessGraphicsSettings.ts`.

Fait quand :

- `configureRenderGraph` relit le JSON du graphe pour la vue `game`, réenregistre les cibles mises à l’échelle par `registerResource`, et écrit l’affûtage sur la passe lue par `getPasses`.
- L’affûtage vaut 0 en `off`, une valeur non nulle sinon. Elle reste un uniforme : elle se règle sans recompiler.
- `applyChessGraphics` retient la dernière échelle appliquée, et n’appelle `reloadGameRenderGraph` que lorsqu’elle change.
- Après ce rechargement, la liste de `gamePassNames` et le mode d’ombre sont réappliqués : le moteur venait de réactiver toutes les passes.
- Le canvas garde la taille rendue par `gameSurfacePixels`. L’échelle ne le touche pas.

## CHESS-B21d — La maquette

Fichiers : `docs/mockup/index.html`, `docs/mockup/mockup.js`.

Fait quand :

- La feuille des options montre la rangée « Upscale » sous « Résolution interne », avec Sans, Qualité, Performance.
- Le choix se retient dans la maquette comme les autres rangées.

Le client attend la validation explicite de cette maquette. Ce ticket ne touche pas `src/renderer/shell`.

## CHESS-B21e — Le client et les huit langues

Fichiers : `src/renderer/shell/ChessShell.tsx`, `src/renderer/shell/copy/types.ts` et les huit catalogues, `src/renderer/ui/ChessGraphicsMenu.tsx`, `src/renderer/graphics/graphicsBench.ts`, `tests/chessGraphics.test.ts`.

Fait quand :

- Options montre la rangée Upscale, sur le modèle de celle des ombres.
- `upscale`, `upscaleOff`, `upscaleQuality` et `upscalePerformance` sont dans `types.ts` et dans les huit catalogues.
- Le menu graphique de dev montre les trois mêmes valeurs, libellés en dur comme ses voisins.
- `graphicsBenchKey` porte l’échelle, et `enumerateGraphicsConfigurations` ajoute l’axe.

## Hors de ce sprint

- Le temporel. Sans vecteur de mouvement par pixel, ni DLSS, ni FSR2, ni TAA.
- Les plafonds de `gameSurfacePixels` et la liste des résolutions.
- La carte d’ombre, son filtre, ses casters : acquis en B20.
- Le rayon de bloom de `StandardLitGraphChess.json`, dont le test échoue déjà.
- Relancer la campagne de [Profil graphique](../profil-graphismes.md). La matrice gagne un axe ; les chiffres attendent ce sprint.
