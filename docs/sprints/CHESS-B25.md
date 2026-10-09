# Sprint CHESS-B25 — Son du plateau ✅

Découpage de [docs/audio.md](../audio.md). WAV sous `public/audio/chess/`, prises par ambiance, tension dynamique, maquette Son.

Ordre livré : B25a → B25b → B25c → B25d → B25e.

Packs NAS : `J:\_assetsLibrary\` (Music, SFX, Chessmaster). Revue : `docs/raw_assets/audio-review/`.

## CHESS-B25a — Contrats ✅

Fichiers : [audio.md](../audio.md), [vitrine.md](../vitrine.md), pointeurs, `.gitignore` WAV sous `docs/raw_assets`.

## CHESS-B25b — Maquette Son ✅

Fichiers : `docs/mockup/*`, [maquette-ui.md](../maquette-ui.md), `docs/raw_assets/audio-review/`.

Écran Son : ambiance, tension Neutre / Avantage / Pression, coups, volumes. Lien depuis Paramètres.

## CHESS-B25c — Pack runtime ✅

Fichiers : `public/audio/chess/` (~6 Mo).

Noms : `drop-{ambiance}`, `capture-{ambiance}`, `check` / `win` / `lose`, `bed-{ambiance}-calm`, `bed-edge`, `bed-pressure`.

## CHESS-B25d — Coups et lits par ambiance ✅

Fichiers : `tests/chessAudioClips.test.ts`, `chessAudioClips.ts`, `chessTableAudio.ts`, `ChessDemoProject.ts`.

Chargement URL + fallback synth. Changement d’ambiance recharge hits et beds.

## CHESS-B25e — Tension dynamique ✅

Fichiers : `tests/chessAudioTension.test.ts`, `chessAudioTension.ts`, `ChessAmbienceBeds`.

Score local (matériel coach), hystérésis ±80 / ±40, couches calm / edge / pressure. Mat et drapeau → calm.

## Hors de ce sprint

- SFX UI (Objection stamp, clicks) et tick d’horloge.
- Canal volume « musique » séparé.
- Stockfish pour la tension.

Musique de menu en boucle : livrée après B25 (`menu-music.wav` + `chessMenuMusic.ts`).
