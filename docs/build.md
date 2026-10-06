# Compiler

## Prérequis

- Node.js 22 ou plus récent
- pnpm
- Un GPU qui expose **WebGPU** (Direct3D 12 sous Windows). L’application n’active pas `--enable-unsafe-webgpu`.

## Scripts

```bash
pnpm install
pnpm test
pnpm dev
pnpm bench:graphics
pnpm dist
```

`pnpm bench:graphics` mesure les combinaisons graphiques et écrit `tmp/graphics-bench.json`. Ce dossier n’est pas versionné.

`pnpm dist` produit l’installateur NSIS Windows. Il embarque l’application, ses ressources et ses dépendances. Les cibles macOS et Linux sont déclarées, sans notarisation ni signature. Le numéro, la note et la release GitHub sont dans [Version](semver.md).

Le code source de ce client et les paquets moteur sont sous licence propriétaire. Voir [LICENSE](../LICENSE).

Moteur : [naanouff/w3dts](https://github.com/naanouff/w3dts).

La partie entre deux machines est [multijoueur.md](multijoueur.md). Le relais est [w3dts-relay](https://github.com/naanouff/w3dts-relay), à `wss://relay-production-01c1.up.railway.app/v1/chessmaster`. `VITE_CHESS_RELAY_URL` remplace cette adresse.
