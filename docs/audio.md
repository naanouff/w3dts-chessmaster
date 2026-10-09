# Son du plateau

Les coups et les lits viennent de `public/audio/chess/` (Ogg Opus) via [`chessTableAudio.ts`](../src/renderer/host/chessTableAudio.ts). Paramètres règle deux volumes (coups, ambiance). Le choix de pièce (`w3dts-chess-ambiance`) change la famille de prises et le lit calm. La tension suit l’avantage local (matériel + échec). Le sprint est [CHESS-B25](sprints/CHESS-B25.md). Réencode depuis les WAV maîtres avec `pnpm compress:audio`.

La revue d’écoute (équivalent de `pnpm review` pour le son) est [docs/mockup/audio.html](mockup/audio.html) : `pnpm review:audio`, puis [http://localhost:3000/mockup/audio.html](http://localhost:3000/mockup/audio.html).

Si un fichier manque ou refuse le decode, un synthèse de secours garde le même id de clip.

## Bibliothèque hors dépôt

Les packs achetés restent sur le NAS, hors git :

| Dossier | Contenu |
| --- | --- |
| `J:\_assetsLibrary\Music\Ultimate Game Music Collection\` | John Leonard French (~505 WAV) |
| `J:\_assetsLibrary\SFX\Universal Sound FX\` | Imphenzia (~10 100 WAV) |

Licence Asset Store (usage dans le jeu). Ce n’est pas du CC0.

La shortlist d’écoute du projet (beds, hits, state, music) est dans [`docs/raw_assets/audio-review/`](raw_assets/audio-review/) (hors git), comme les GLB maîtres.

## Coups

Même ids qu’aujourd’hui : `drop`, `capture`, `check`, `win`, `lose`. La famille de `drop` / `capture` suit la pièce :

| Ambiance | Prise (doc décor) |
| --- | --- |
| Atelier | Clic sec |
| Salon | Bois feutré |
| Club | Métal / feuille discrète |
| Jardin | Bois sec, plus léger que le salon |
| Terrasse | Pierre |

`check`, `win` et `lose` restent partagés. Un coup dure 50–150 ms.

## Lits et tension

Couches crossfadées, master = volume d’ambiance :

1. **Calm** — bed SFX de la pièce (HVAC, feu, néon, forêt, vent).
2. **Music** — une mélodie par pièce et par bande de tension (`bed-{ambiance}-music.ogg`, `-music-edge`, `-music-pressure`). Une seule stem mélodique joue à la fois. Neutre : pads / music box / metal / forêt / lunar pads. Avantage : mélodie plus ouverte (loading, piano casual, funky bass, lighthearted, lunar short). Pression : ambiance plus sombre (draughty, lonely house, metal deep, moonlit forest, frozen). Gain un peu plus bas sous pression.
3. **Edge** — avantage local (hum clair SFX).
4. **Pressure** — désavantage (hum sombre SFX). Pas de heartbeat, pas de drums combat.


Le signal V1 est l’éval locale déjà utilisée par le coach (matériel + échec), centrée sur le joueur local. Hystérésis pour éviter le pompage. L’échec one-shot peut pousser un peu la tension. Mat ou drapeau : stinger win/lose, puis silence ou lit de menu.

## Menu

Boucle piano partagée (`menu-music.ogg`, Casual Menu Piano, ~32 s) via [`chessMenuMusic.ts`](../src/renderer/host/chessMenuMusic.ts). Elle joue sur les écrans shell (accueil, modes, options…) après le premier geste, sur le volume d’ambiance. Elle s’arrête en partie, pause et offre de nulle. Pas de canal volume « musique » séparé.

## Revue audio

Page dédiée [mockup/audio.html](mockup/audio.html) : pièce, tension, lits (play/stop + VU-mètre), coups, volumes. WAV depuis `docs/raw_assets/audio-review/`.

```bash
pnpm review:audio
# → http://localhost:3000/mockup/audio.html
```

L’écran Son dans la maquette UI (Paramètres → Écouter les lits) reste un raccourci ; la revue audio est la référence d’écoute.

## Hors contrat

- Pas de canal volume « musique » séparé (menu et lits partagent Ambiance).
- Pas de Stockfish pour piloter la tension.
- Pas de redistribution des packs hors du binaire du jeu.
