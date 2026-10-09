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
pnpm build:web
```

`pnpm bench:graphics` mesure les combinaisons graphiques et écrit `tmp/graphics-bench.json`. Ce dossier n’est pas versionné.

`pnpm dist` produit l’installateur NSIS Windows. Avant le build, `pnpm prune:public` retire les GLB de pièces, les WebP hors contrat de densité et les props de scène aux paliers inutiles. Les props d’ambiance livrés sont dans `public/sets/` (`pnpm ship:set-props` après un `pnpm clean:set-props` local). Les cibles macOS et Linux sont déclarées, sans notarisation ni signature. Le numéro, la note et la release GitHub sont dans [Version](semver.md).

`pnpm build:web` produit le rendu statique dans `out/renderer` (Vite, sans Electron). Sur `main` et `release/*`, la CI le déploie sur Vercel (projet `w3dts-chessmaster`) en plus de l’installeur NSIS. Secrets GitHub : `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, et `VERCEL_TOKEN` ([créer un token](https://vercel.com/account/tokens)). Sans `VERCEL_TOKEN`, le job `deploy-web` s’arrête sans erreur. `pnpm compress:audio` réencode les clips en Ogg Opus.

Le code source de ce client et les paquets moteur sont sous licence propriétaire. Voir [LICENSE](../LICENSE).

Moteur : [naanouff/w3dts](https://github.com/naanouff/w3dts).

La partie entre deux machines est [multijoueur.md](multijoueur.md). Le relais est [w3dts-relay](https://github.com/naanouff/w3dts-relay), à `wss://relay-production-01c1.up.railway.app/v1/chessmaster`. `VITE_CHESS_RELAY_URL` remplace cette adresse.
