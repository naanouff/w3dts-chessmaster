# Sprint CHESS-B27 — Décors des deux côtés de la caméra

Suite de [CHESS-B26](CHESS-B26.md). Le miroir Z de la caméra de partie laisse le décor et les lumières calés pour le côté blanc : côté noir, l’atelier montre un vide derrière les blancs et un softbox trop proche.

Ordre : B27a, puis B27b, puis B27c. Chaque ticket de code commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`.

## CHESS-B27a — Double cyclo atelier ✅

Fichiers : `chessAmbiance.ts` (`chessSetCovePoses`), `spawnChessSet.ts`, `tests/chessSetCove.test.ts`, [ambiances.md](../ambiances.md).

Fait quand l’atelier pose deux cyclos procéduraux (yaw 0 à +Z, yaw π à −Z), et que salon / club / jardin / terrasse restent sans cove.

## CHESS-B27b — Éclairage atelier des deux côtés ✅

Fichiers : `chessAmbiance.ts` (`LIGHTS.atelier`), `tests/chessAmbiance.test.ts`.

Fait quand :

- Softbox et projecteur restent latéraux, softbox un peu plus loin en +Z.
- Deux fills sans ombre à `z ± 1,15` éclairent les faces vues de chaque caméra de partie.

## CHESS-B27c — Miroir des props et bande derrière la caméra ✅

Fichiers : `chessAmbiance.ts` (`chessSetPlacementsBothSides`, view side), `spawnChessSet.ts` (`applyChessSetView`), `ChessDemoProject.ts`, `tests/chessSetViewSide.test.ts`.

Fait quand :

- Chaque prop de fond à +Z (|z| ≥ 1 m, pas latéral) a une copie mirroirée en −Z (tabouret atelier, cheminée, bar, banc, balustrade…).
- Les dalles de sol ne sont pas doublées.
- Blanc montre seulement `plusZ` (+ shared) ; noir seulement `minusZ` (+ shared) — y compris les cyclos.
- Un changement de `localColor` (session, hello online) met à jour la visibilité sans recharger les GLB.

## Hors de ce sprint

- Recaptures README.
- Retouche fine des lumières salon / club / jardin / terrasse au-delà des fills déjà posés.
