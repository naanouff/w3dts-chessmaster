# Upscale

La scène se rend sous la taille de la fenêtre. Une passe finale agrandit et affûte à la taille du canvas. L’occlusion et les reflets travaillent à la moitié de cette taille réduite.

Sprint : [CHESS-B21](sprints/CHESS-B21.md).

## Pourquoi un upscale spatial

DLSS et FSR2 demandent un vecteur de mouvement par pixel et un SDK constructeur. Aucune API WebGPU ne les expose. Un upscale spatial, façon FSR1, tient dans une passe plein écran : agrandissement bilinéaire puis affûtage à contraste local, le RCAS. Le shader existait déjà sans appelant, [`spatial_upscale.frag.wgsl`](../public/shaders/post-processing/spatial_upscale.frag.wgsl).

Choisir `1440` sur un écran 4K rendait déjà en 1440 : le canvas faisait 2560×1440 et le compositeur l’étirait. Ce qui manquait n’était pas la baisse de charge, c’était l’affûtage après agrandissement et une sortie à la taille de l’écran.

## Trois réglages

Options donne Sans, Qualité, Performance. Sans garde l’échelle 1 et l’affûtage à 0 : la passe est un report, le comportement d’avant. Qualité rend aux deux tiers, Performance à la moitié. L’échelle ne touche pas la résolution choisie : elle divise les cibles internes, le canvas reste à la taille que `gameSurfacePixels` autorise.

Sans et Qualité sont les deux seules valeurs des préréglages : Fluide et Équilibré en Sans, Qualité et Natif en Qualité. Performance ne vient que d’un choix du joueur.

Le gain porte sur le travail par pixel : 0,44 fois aux deux tiers, 0,25 fois à la moitié. Les triangles et la passe d’ombre ne bougent pas. Les 32 pièces font 137 936 triangles ; le décor va de 25 000 à l’atelier jusqu’à 200 000 au jardin. Le détail est dans [Ambiances](ambiances.md). Un poste limité par les appels de dessin ne gagne rien.

## La chaîne

`07_FXAA` n’écrit plus l’image finale. Il écrit `ldrAntialiased`, et `08_Upscale` lit cette cible pour écrire `FINAL_OUTPUT`. La passe d’upscale est donc dans tous les préréglages, comme l’anticrénelage l’était : elle est le seul écrivain de la sortie. Anticrénelage coupé, le graphe alias `ldrAntialiased` sur `ldrBuffer` et l’upscale lit l’image non filtrée.

Le moteur recrée chaque cible `relative` à la taille de `FINAL_OUTPUT` au moment d’exécuter, sauf celles déclarées sous 1. Une fraction est donc le seul moyen de rendre sous la taille du canvas, et c’est aussi pourquoi `ldrAntialiased` ne coûte aucune texture temporaire quand l’échelle vaut 1.

`hbaoRaw`, `hbaoBlurred` et `ssrBuffer` passent à la moitié dans [`StandardLitGraphChess.json`](../public/graphs/StandardLitGraphChess.json), indépendamment de l’échelle. `hbao.frag.wgsl` et `ssr_floor.frag.wgsl` déduisent leurs coordonnées de `textureDimensions(depthTex)` et de l’`uv` : une cible plus petite lit la profondeur pleine au centre de ses pixels. `hbao_apply` et `ssr_composite` relisent le résultat au sampler linéaire. Le rayon du flou d’occlusion descend de 12 à 6 texels, la carte ayant perdu la moitié de sa taille.

## Appliquer en partie

Changer d’échelle veut dire recréer les cibles. Le projet pose les tailles dans `configureRenderGraph` ; `resourceDefinitions` est privé, donc la définition est relue depuis le JSON du graphe et réenregistrée par `registerResource`. Un changement en partie passe par `reloadGameRenderGraph`, qui réactive toutes les passes : la liste de `gamePassNames` et le mode d’ombre sont réappliqués juste après.

Ce rechargement dimensionne le graphe sur le canvas caché de 4×4 du moteur, puisque la vue visible est la surface Game. La boucle d’image redimensionne le graphe du jeu à chaque image : la taille est juste dès l’image suivante.

## Moteur

`@naanouff/w3dts-core` 0.0.37. Rien n’est ajouté au paquet : `registerResource`, `addPassConfig`, `getPasses` et `reloadGameRenderGraph` sont déjà publics.

## Hors de ce document

- Le temporel. Sans vecteur de mouvement, pas d’accumulation ni de TAA.
- Les plafonds de `gameSurfacePixels` et le choix de résolution. Ils restent dans [Profil graphique](profil-graphismes.md).
- La taille de la carte d’ombre et son filtre. C’est [Ombres](ombres.md).
