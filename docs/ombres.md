# Ombres

Une couche ajustée à l’emprise du plateau. Le filtre est le réglage : dur en Fluide, doux au-dessus. Chaque pièce a une lumière qui projette.

Sprint : [CHESS-B20](sprints/CHESS-B20.md). La première passe, l’ombre dure sur les quatre préréglages, était [CHESS-B19](sprints/CHESS-B19.md).

## Trois modes

Options donne Sans, Dure, Douce. Les trois ajustent la carte sur l’emprise, une seule couche. Seul le filtre change : Dure fait une comparaison, Douce reprend le PCSS. Le curseur 2/3/4 cascades n’existe plus.

Le PCSS est resté dans `fetchShadow` ([public/shaders/shared/pbr_functions.wgsl](../public/shaders/shared/pbr_functions.wgsl)), derrière le test `frame.shadowFilter > 0.5`, au lieu d’être retiré comme B19a l’annonçait. C’est ce qui rend Douce possible sans toucher au shader.

Les cascades sur le frustum plafonnent vers 1,3 mm par texel, sur un plateau de 0,55 m vu à 0,9 m. L’emprise descend à 0,54 mm en carte 1024, et 0,27 mm en 2048. À cette échelle, découper le frustum ne gagne rien.

## Paliers

Fluide est en Dure, carte 1024. Équilibré, Qualité et Natif sont en Douce, carte 2048. Le PCSS et la carte doublée sont le coût ajouté : coupés en Fluide, pris au-dessus. Un profil enregistré en `cascade` se relit en Douce.

## Qui projette

L’emprise est [`CHESS_BOARD_MESH_EXTENT`](../src/chess/board/chessBoard.ts) en XZ, plus la hauteur des pièces en Y. Le corps du plateau et les pièces projettent. Le dessus du plateau, le tapis et les meubles non.

Le soleil de pièce vaut 0,36 à l’atelier, 0,04 au salon, 0 au club : il ne porte aucune ombre. La key de chaque pièce projette donc à sa place, le spot de l’atelier, la lampe du salon, le plafonnier du club. Sans elle les pièces flottent. Le remplissage derrière la caméra ne projette pas : il effacerait le contact. La softbox de l’atelier non plus, c’est une surface rendue en spot.

Sans passe par le moteur : `shadowsEnabled` à faux saute la passe entière, lumières de pièce comprises. Aucun garde par préréglage n’est nécessaire. Le moteur accepte seize couches, deux sont occupées.

## Moteur

`@naanouff/w3dts-core` 0.0.36 porte `shadowFilter` et `csmFit`. `csmFit: 'extent'` ne s’engage que si `csmIncludeAabb` est posée. Sans elle, le moteur retombe sur une cascade de frustum dont le premier plan vaut 15 m, et le plateau redevient quelques texels. La scène pose l’emprise avant d’appliquer le mode, et le premier plan de secours reste à 1,2 m.

On ne détache pas `shadowLayerViews` depuis le jeu : une couche absente laisse la pièce éclairée à fond.

## Hors de ce document

L’éclairage d’environnement. La partie ne charge aucune carte : plus d’irradiance ni de spéculaire, le marbre et l’acier sont sans reflet et le remplissage est un ambiant plat. C’était pour que le salon et le club lisent comme la nuit ; l’atelier le paie aussi. C’est [Ambiances](ambiances.md), pas une ombre.
