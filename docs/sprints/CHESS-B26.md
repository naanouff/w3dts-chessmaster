# Sprint CHESS-B26 — Vitrine 0.2.1 et caméra du joueur local

Correctif post-alpha 0.2.0. Livré par `fix/chess-b26-readme-camera` → `develop`, puis `release/0.2.1` → `main`.

Constat : les captures README sont encore en 0.1.0 sans décor ; la caméra de partie reste toujours côté blanc (`[0, 0.55, -0.72]`), même quand `localColor` est noir ou après un hello online qui adopte le noir.

Ordre : B26a, puis B26b, puis B26c, puis B26d, puis B26e. B26b commence par un test qui échoue. Chaque ticket de code se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande.

## CHESS-B26a — Contrats ✅

Fichiers : [vitrine.md](../vitrine.md), [ambiances.md](../ambiances.md), [multijoueur.md](../multijoueur.md), ce sprint.

Fait quand :

- La vitrine autorise une phrase README sur les cinq ambiances, et pointe ce sprint pour le rafraîchissement des captures.
- [ambiances.md](../ambiances.md) dit que le plateau reste en monde fixe (blanc −Z), et que la caméra de partie miroite Z quand le joueur local est noir.
- [multijoueur.md](../multijoueur.md) dit que chaque siège voit ses pièces au premier plan.
- Hotseat : pas de flip au trait ; la vue suit la `localColor` de session.

## CHESS-B26b — Pose caméra selon la couleur ✅

Fichiers : `src/renderer/host/chessGameCamera.ts`, `tests/chessGameCamera.test.ts`, `tests/chessCameraArrival.test.ts`, `chessCameraArrival.ts`.

Fait quand :

- `chessGameCameraPose('game', 'white')` reprend `CHESS_REVIEW_POSES.game`.
- `chessGameCameraPose('game', 'black')` nie `eye[2]` et `target[2]` (œil ≈ `+0.72`).
- L’arrivée caméra (`chessCameraArrival` / `chessCameraArrivalPose`) prend `localColor` et miroite chaque keyframe pour le noir ; la fin tombe sur la pose de partie de cette couleur.
- La revue auteur (`reviewing`) reste sur les poses blanches.

## CHESS-B26c — Branchement partie et online ✅

Fichiers : `ChessDemoProject.ts`.

Fait quand :

- `aimChessCamera` et le travelling d’arrivée passent `this.localColor`.
- Après un `adopt` online (`onOnlineHello`), la caméra est réorientée (ou l’arrivée relancée) pour le noir.
- Le mesh du plateau ne tourne pas ; grab et FEN restent valides. Les labels de bord restent color-aware.

## CHESS-B26d — README et captures ✅

Fichiers : `README.md`, `docs/media/*.webp`, [vitrine.md](../vitrine.md).

Fait quand :

- Le README mentionne les cinq ambiances dans « Jouer ».
- Les quatre WebP (grand côté 1280) sont reprises dans le client (`pnpm dev`) : accueil, modes, partie avec ambiance visible et version 0.2.x, langues.
- Pas de Node / pnpm / WebGPU dans le README.

## CHESS-B26e — Release 0.2.1

Fichiers : `docs/releases/0.2.1.md`, `package.json` (déjà `0.2.1` sur `develop`), [semver.md](../semver.md).

Fait quand :

- `release/0.2.1` part de `develop` avec la note française À propos.
- PR vers `main`, CI publie `v0.2.1` et l’installateur NSIS.
- Merge retour dans `develop`, bump vers `0.2.2`.

## Hors de ce sprint

- Flip caméra à chaque trait en hotseat.
- Refonte HUD / horloges « mon côté en bas ».
- Nouvelle ambiance ou nouveau mode de jeu.
