# Sprint CHESS-B29 — Suite playtest

Découpage de [docs/playtest-suite.md](../playtest-suite.md). Signaux [PT-004 à PT-007](../qa-alpha.md#retours-playtest).

Ordre : B29a → B29b → B29c → B29d → B29e → B29f. Chaque ticket de code commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande. Écran nouveau : maquette validée avant le client (B29e). Correctifs d’écrans déjà en prod : pas de maquette (B29a, B29b, B29d).

Branche : `fix/playtestv2` depuis `develop`.

## CHESS-B29a — Plus de navette au cran 1 ✅

Fichiers : `src/chess/rules/HeuristicChessEngine.ts`, `tests/heuristicChessEngine.test.ts`.

Fait :

- Un test échoue d’abord : depuis la position de départ, depth 1 contre le premier coup noir légal ne doit plus annuler son propre ply (a1↔b1).
- À la racine, inverser le coup précédent coûte `UNDO_PENALTY` (1) : assez pour casser une égalité, pas assez pour refuser un mat ou une prise.
- L’instance garde `lastMove`. Mats en un et parties finies inchangés.
- Pas de table de transposition. Pas de changement de `cpuSearchDepth`.

## CHESS-B29b — Upscale moins flou ✅

Fichiers : `src/renderer/graphics/chessGraphicsSettings.ts`, `src/renderer/review/reviewPostControls.ts`, `tests/chessGraphics.test.ts`, `tests/chessSetReview.test.ts`, [docs/upscale.md](../upscale.md).

Fait :

- Un test échoue d’abord : `upscaleSharpness` Qualité / Performance ≥ 0,85.
- `UPSCALE_SHARPNESS_ON = 0,85` ; la revue part de la même constante.
- L’échelle Qualité reste aux deux tiers. Fluide et Équilibré restent en `off`.
- Pas de FSR2, pas de TAA.

## CHESS-B29c — Source de saisie ✅

Fichiers : `src/chess/grab/grabPointer.ts`, `src/chess/index.ts`, `src/renderer/host/ChessDemoProject.ts`, `tests/grabPointer.test.ts`.

Fait :

- Un test échoue d’abord : `sampleChessGrabPointer` + `chessGrabSelectIntent` sans `InputManager`.
- Le chemin souris de l’hôte construit un échantillon puis down / hold / up / hover. Le ressort et `tryMove` inchangés.
- Le rayon reste valide hors canvas pour suivre une pièce tenue. Pas de geste tactile dans ce ticket.

## CHESS-B29d — Touch et orbit ✅

Fichiers : `src/chess/grab/chessOrbitGrab.ts`, `src/renderer/host/ChessDemoProject.ts`, `tests/chessOrbitGrab.test.ts`, [docs/playtest-suite.md](../playtest-suite.md).

Fait :

- `chessOrbitInputActive(grabbing)` : l’orbit est désactivée tant qu’une pièce est tenue, réactivée au dépôt / annulation.
- Le touch du `InputManager` du moteur alimente déjà `pointer` + `select` : même chemin que la souris via `sampleChessGrabPointer`.
- Pas de WebXR. Pas de HUD VR.

## CHESS-B29e — Analyse en fin de partie (tranche A) ✅

Fichiers : `ChessShell.tsx`, `copy/types.ts` + huit catalogues, `tests/shellEndAnalyze.test.ts`, [docs/fin-partie.md](../fin-partie.md).

Fait :

- Bouton Analyser sur la carte de fin : referme la carte, ouvre l’assistant (`open-assistant`).
- Clé `analyze` dans les huit catalogues. L’historique coach n’est vidé que par reset / changement de mode (inchangé).
- Pas de scrubber. Pas d’archive. Pas de maquette (bouton sur la carte existante).

## CHESS-B29f — Replay en session (tranche B)

### Maquette ✅

Fichiers : `docs/mockup/index.html`, `mockup.js`, `mockup.css`, [docs/maquette-ui.md](../maquette-ui.md), [docs/fin-partie.md](../fin-partie.md).

Fait :

- Analyser ouvre la relecture : barre Précédent / Suivant, label `n/N · SAN`, plateau figé, tiroir coach sur le ply.
- ← → naviguent. Échap ferme le tiroir, puis quitte la relecture.
- Ligne d’exemple `REVIEW_PLIES`. Pas encore dans le client.

**Attente :** validation explicite « applique en prod » avant le code ci-dessous.

### Client (après validation)

Fichiers : shell / hôte, journal ply tous modes, tests, catalogues, [docs/fin-partie.md](../fin-partie.md), [docs/coach-ia.md](../coach-ia.md).

Fait quand :

- Le client journalise `fenBefore` + SAN (et from/to si besoin) pour tous les modes joués, pas seulement l’entraînement.
- Naviguer un ply repose la position ; le coach commente ce ply / ce FEN.
- Pas d’enregistrement des parties finies. Pas de PGN. Pas de rapport multi-appels (tranche C).

## Hors de ce sprint

- Archive des parties finies, PGN, analyse batch (tranche C).
- WebXR, locomotion, HUD en VR.
- FSR2 / DLSS / TAA.
- Remplacer le CPU par Stockfish ou faire jouer le modèle.
- Terrasse / jardin hors de leur contrat actuel.
