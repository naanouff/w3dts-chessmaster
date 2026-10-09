# Vitrine et documentation

Le README vend la partie. Les autres pages disent comment c’est fait, une fois, et court.

Avant un commit : si le diff change un comportement visible, un pipeline ou un contrat déjà cité, mettre à jour la page qui porte ce fait, dans le même commit. Sinon laisser la doc.

La règle [`.cursor/rules/docs-min.mdc`](../.cursor/rules/docs-min.mdc) renvoie ici. Elle ne répète pas ce texte.

## Une fait, une page

- `README.md` — la partie, les captures, les langues.
- [Compiler](build.md) — prérequis et scripts.
- [Coach](coach-ia.md) — dont installation Ollama
- [Maquette](maquette-ui.md)
- [Shell](shell-client.md)
- [Langues](i18n.md)
- [Assets 3D](assets-3d.md)
- [Pièces](pieces.md)
- [Survol](survol.md)
- [Ambiances](ambiances.md)
- [Son](audio.md) — revue : `pnpm review:audio` → `/mockup/audio.html`
- [Version](semver.md)
- [Persistance](persistance.md)
- [Multijoueur](multijoueur.md)
- [Profil graphique](profil-graphismes.md)
- [Ombres](ombres.md)
- [Upscale](upscale.md)
- [Plan QA de l’alpha](qa-alpha.md)

Les fichiers de `docs/sprints/` sont des archives. On ne les rallonge pas quand le code bouge.

Pas de nouveau fichier sans une surface nouvelle. Pas de copie du JSDoc. `docs/api/` est produit par `pnpm run docs` et ignoré par git. Phrases courtes. Un schéma seulement si la prose ne tient pas en quelques lignes.

## README

1. Une phrase : une table d’échecs en 3D, on saisit les pièces et on les pose.
2. Quatre captures.
3. Ce que l’on peut jouer.
4. Les huit langues, par leur endonyme.
5. L’assistant commente la position et ne joue pas.
6. Une phrase : l’image se règle, du plus fluide au plus détaillé.
7. Une ligne vers `docs/build.md`, la licence, le moteur.

### Captures

WebP, grand côté 1280, dans `docs/media/`. Prises dans le client (`pnpm dev`), pas dans [la maquette](mockup/index.html).

- `accueil.webp` — blason, Jouer, Classements, Options, Paramètres
- `modes.webp` — les cinq cartes
- `partie.webp` — plateau, barre de trait
- `langues.webp` — Paramètres, les huit endonymes

### Ce que le texte a le droit de dire

- Contre l’ordinateur.
- À deux, la même souris.
- Une seconde fenêtre sur ce poste.
- Deux machines, avec un code de table. Le relais est [multijoueur.md](multijoueur.md).
- Apprendre une courte ouverture.
- Les classements sont des exemples.
- Langues : Français, English, Deutsch, Italiano, Español, Русский, 中文, 日本語. Le français est celle du départ. Le détail est dans [Langues](i18n.md).

### Ce qui quitte le README

Node, pnpm, WebGPU, Electron, les paquets, `BroadcastChannel`, la liste des sprints, les noms de fichiers du code.

Sprint : [CHESS-B12](sprints/CHESS-B12.md).
