# Sprint CHESS-B28 — Correctifs playtest

Découpage des retours [PT-001 à PT-003](../qa-alpha.md#retours-playtest). Trois causes confirmées en analyse : dépôt sur le plan de saisie, damier inversé en V, hits trop forts.

Ordre : B28a → B28b → B28c → B28d. Chaque ticket de code commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande. Correctifs d’écrans déjà en prod : pas de maquette.

Branche prévue : `fix/chess-b28-playtest` depuis `develop`. Livraison ensuite via `release/0.2.3` et [docs/releases/0.2.3.md](../releases/0.2.3.md) (semver).

## CHESS-B28a — Dépôt sous le curseur ✅

Fichiers : `src/chess/grab/grabMath.ts`, `src/chess/index.ts`, `src/renderer/host/ChessDemoProject.ts`, `src/chess/grab/MouseGrabController.ts`, `tests/grabMath.test.ts`, `tests/mouseGrab.test.ts`.

Fait :

- Un test échoue d’abord : avec la caméra de partie, le NDC du centre de e4 sur le plateau résout `e4` ; l’ancien chemin (plan de saisie) résolvait `e3`.
- `boardSquareUnderRay(origin, direction, boardY)` intersecte le plan du plateau puis `worldToSquare`. Exporté avec JSDoc.
- `onSelectHold` : la pièce suit encore le plan de saisie ; le survol et un champ `dropSquare` utilisent `boardSquareUnderRay` à `playingY(CHESS_BOARD_SURFACE_Y)`.
- `onSelectUp` lit `dropSquare`, plus `grab.dropXZ()`.
- `MouseGrabController.dropXZ` et son assertion dans `mouseGrab.test.ts` sont retirés (plus d’appelant).

## CHESS-B28b — Damier ancré sur a1 ✅

Fichiers : `src/chess/look/chessAlbedo.ts`, `src/chess/board/chessBoard.ts` (commentaire), `tests/stauntonGeometry.test.ts`.

Fait :

- Un test échoue d’abord : mapping `squareToWorld` → UV du plan (`u = (x + r) / 2r`, `v = (r - z) / 2r`) ; a1 et d8 foncées, h1 et d1 claires. L’ancien cas « UV bas/bas = a1 » est remplacé.
- `boardAlbedoCell` : `light = (fx + fy) % 2 === 0` (v = 0 = rangée 8). Procédural et photo suivent.
- En `pnpm dev`, a1 est foncée ; chaque dame est sur sa couleur.

## CHESS-B28c — Coups plus doux ✅

Fichiers : `src/renderer/host/chessTableAudio.ts`, `tests/chessTableAudio.test.ts`, `scripts/soften-chess-sfx.mjs`, `package.json`, [audio.md](../audio.md), `public/audio/chess/drop-*.ogg` et `capture-*.ogg` après compress.

Fait :

- Un test échoue d’abord : aux curseurs par défaut, `chessSfxGain('drop')` et `chessSfxGain('capture')` restent sous 0,3.
- `CHESS_SFX_VOLUME` : drop `0,3`, capture `0,36`, check `0,3`.
- `pnpm soften:sfx` lit les maîtres `docs/raw_assets/audio-review/hits/<pièce>/{drop,capture}.wav`, applique fade-in 4 ms, passe-bas 7 kHz, coupe à 150 ms avec fade-out 40 ms, pic −12 dBFS ; écrit les WAV sous `public/audio/chess/`, puis `pnpm compress:audio`.
- Validation d’écoute explicite via `pnpm review:audio` avant livraison.
- [audio.md](../audio.md) note la cible hit : ≤ 150 ms, pic −12 dBFS, commande `pnpm soften:sfx`.

## CHESS-B28d — Documentation ✅

Fichiers : [qa-alpha.md](../qa-alpha.md) (statuts PT), ce sprint, [audio.md](../audio.md).

Fait :

- PT-001, PT-002 et PT-003 en `corrigé` (PT-003 : confirmer à l’oreille avec `pnpm review:audio`).
- Pas de second fichier de version : `package.json` reste la seule source (0.2.3 sur `develop`).

## Hors de ce sprint

- Tie-break du CPU (premier coup de la liste → `b1a3` / `a7a5` à tous les crans).
- Recapture README : les quatre WebP (salon, upscale off, grand côté 1280).
- Canal volume musique séparé.
