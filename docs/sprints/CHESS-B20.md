# Sprint CHESS-B20 — Filtre par palier et key projetante

Découpage de [docs/ombres.md](../ombres.md). Révise [CHESS-B19](CHESS-B19.md), qui avait mis l’ombre dure sur les quatre préréglages et coupé tous les projeteurs de pièce. L’emprise, les casters plateau et pièces, et le retrait du curseur de cascades restent acquis. Le shader ne change pas : le PCSS est resté derrière `frame.shadowFilter`.

Ordre : B20a, puis B20b, puis B20c, puis B20d. Chaque ticket commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande.

## CHESS-B20a — Trois modes, une emprise

Fichiers : `tests/chessGraphics.test.ts`, `src/renderer/graphics/chessGraphicsSettings.ts`.

Fait quand :

- `ChessShadowMode` vaut `off`, `hard` ou `soft`.
- `applyChessShadowMode` garde `csmFit: 'extent'` et une seule couche dans les deux modes, et ne fait varier que `shadowFilter`.
- `csmCascadeSplits` garde un premier plan à 1,2 m, pour que la retombée sans emprise ne s’étale pas sur les 15 m du moteur.
- `ChessShadowCascades`, `ChessCascadeCount`, `chessCascadeSplits`, `applyShadowCascades`, `SHADOW_CASCADE_OPTIONS` et le champ `shadowCascades` n’existent plus.
- Fluide est en `hard`. Équilibré, Qualité et Natif sont en `soft`.
- Un profil enregistré en `cascade` se relit en `soft`.

## CHESS-B20b — La carte suit le mode

Fichiers : `tests/chessGraphics.test.ts`, `src/renderer/graphics/chessGraphicsSettings.ts`, `src/renderer/host/ChessDemoProject.ts`.

Fait quand :

- `shadowMapSize` rend 1024 en `hard` et 2048 sinon.
- `applyChessGraphics` l’applique, donc changer de préréglage en partie refait l’atlas.
- `configureRenderGraph` lit le même helper. `CHESS_SHADOW_MAP_SIZE` n’existe plus.

## CHESS-B20c — Une key qui projette

Fichiers : `tests/chessAmbiance.test.ts`, `src/renderer/host/chessAmbiance.ts`.

Fait quand :

- Le spot de l’atelier et la lampe du salon projettent. Le plafonnier du club projetait déjà et ne change pas.
- Le remplissage derrière la caméra ne projette pas, dans aucune pièce.
- La softbox reste non projetante : le type `rect` force le drapeau à faux.
- Les points de néon du club et le feu du salon ne projettent pas.
- Aucun garde par préréglage : le mode Sans coupe déjà la passe au niveau du moteur.

## CHESS-B20d — Le client et les huit langues

Fichiers : `src/renderer/shell/ChessShell.tsx`, `src/renderer/shell/copy/types.ts` et les huit catalogues, `src/renderer/ui/ChessGraphicsMenu.tsx`, `src/renderer/graphics/graphicsBench.ts`, `docs/mockup/mockup.js`.

Fait quand :

- Options montre Sans, Dure, Douce. La rangée « Cascades d’ombres » n’est plus là.
- `shadowCascade` devient `shadowSoft` dans les huit catalogues et dans `types.ts`. `shadowCascades` en sort.
- Le menu graphique de dev montre les trois mêmes modes.
- Le banc et la maquette ne citent plus un nombre de cascades.

La rangée d’ombres est déjà validée et déjà dans le client : ce ticket est un correctif, il ne repasse pas par la maquette.

## Hors de ce sprint

- L’éclairage d’environnement. La partie ne charge aucune carte, le marbre et l’acier sont sans reflet. C’est [Ambiances](../ambiances.md), pas une ombre.
- Le PCSS de `fetchShadow`, l’emprise du plateau, les casters plateau et pièces : acquis en B19, conservés tels quels.
- Changer l’occlusion, les reflets, le bloom, l’anticrénelage ou la silhouette d’un préréglage.
- La caméra de partie, la terrasse et le jardin.
- Relancer la campagne de [Profil graphique](../profil-graphismes.md). Les chiffres attendent ce sprint.
