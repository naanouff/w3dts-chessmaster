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
pnpm dist
```

`pnpm dist` produit l’installateur NSIS Windows. Les cibles macOS et Linux sont déclarées, sans notarisation ni signature.

Le code source de ce client et les paquets moteur sont sous licence propriétaire. Voir [LICENSE](../LICENSE).

Moteur : [naanouff/w3dts](https://github.com/naanouff/w3dts).
