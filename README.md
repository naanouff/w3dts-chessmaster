# W3DTS ChessMaster

Client Electron de la table d’échecs W3DTS. Le moteur 3D vient des paquets publiés `@naanouff/w3dts-*`. Les règles, les maillages Staunton, le grab et le HUD vivent dans ce dépôt.

## Prérequis

- Node.js 22 ou plus récent
- pnpm
- Un GPU qui expose **WebGPU** (Direct3D 12 sous Windows). L’application n’active pas `--enable-unsafe-webgpu`.

## Modes

- CPU : heuristique locale
- Hot-seat : deux joueurs, une souris
- Learn : ligne ECO courte
- P2P : une deuxième fenêtre du **même** processus (`BroadcastChannel`). Deux installations du système d’exploitation ne se voient pas.

## Documentation

- [Coach IA](docs/coach-ia.md) — commentaire de position via Ollama ou une API compatible OpenAI. Le coach ne joue pas.
- [Sprint CHESS-B7](docs/sprints/CHESS-B7.md) — tickets d’implémentation du coach.
- [Maquette UI](docs/maquette-ui.md) — accueil, modes, salon en ligne, assistant, options, paramètres, classements.
- [Sprint CHESS-B8](docs/sprints/CHESS-B8.md) — génération de la maquette dans `docs/mockup/`.
- [Assets 3D](docs/assets-3d.md) — maîtres Staunton dans `docs/raw_assets`, `.wmesh` et WebP au runtime.
- [Sprint CHESS-B9](docs/sprints/CHESS-B9.md) — liens durs des maîtres, import, et plateau `chess_board_B`.

## Scripts

```bash
pnpm install
pnpm test
pnpm dev
pnpm dist
```

`pnpm dist` produit l’installateur NSIS Windows. Les cibles macOS et Linux sont déclarées, sans notarisation ni signature.

Le code source de ce client et les paquets moteur sont sous licence propriétaire. Voir [LICENSE](LICENSE).

Moteur : [naanouff/w3dts](https://github.com/naanouff/w3dts).
