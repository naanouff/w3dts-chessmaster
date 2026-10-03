# Sprint CHESS-B12 — Vitrine

Découpage de [docs/vitrine.md](../vitrine.md). Le client, les catalogues de langues et les pages techniques ne changent pas. Pas de `pnpm test` : aucun module de `src/` n’est touché.

Ordre : B12a, puis B12b.

## CHESS-B12a — Le README vend la partie

Le mode d’emploi quitte le README. Il tient dans `docs/build.md` : prérequis, `pnpm install`, `pnpm test`, `pnpm dev`, `pnpm dist`, licence, lien vers le moteur.

Fichiers :

- `README.md`
- `docs/build.md`

Fait quand :

- La première phrase parle d’une table 3D où l’on saisit les pièces.
- Les modes tiennent en langage joueur : ordinateur, même souris, seconde fenêtre sur ce poste avec un code de table, courte ouverture.
- Le salon n’est pas présenté comme une partie entre deux machines.
- Les classements sont nommés comme des exemples.
- Les huit endonymes sont listés, français en premier. Pas de reprise du contrat de [docs/i18n.md](../i18n.md).
- L’assistant est un commentaire, pas un joueur.
- L’image réglable tient en une phrase, sans preset ni résolution.
- La liste des sprints, Node, pnpm, WebGPU, Electron, les paquets et `BroadcastChannel` ont quitté le README.
- `docs/build.md` porte les commandes et le lien moteur.

## CHESS-B12b — Captures

Quatre WebP, grand côté 1280, dans `docs/media/`. Les prendre dans le client lancé par `pnpm dev`, une fois le plateau affiché. Pas depuis `docs/mockup/`.

Fichiers :

- `docs/media/accueil.webp`
- `docs/media/modes.webp`
- `docs/media/partie.webp`
- `docs/media/langues.webp`
- `README.md` — les quatre images, dans cet ordre, sous la phrase d’ouverture

Fait quand :

- L’accueil montre le blason et Jouer, Classements, Options, Paramètres.
- Les modes montrent les cinq cartes.
- La partie montre le plateau et la barre de trait.
- Paramètres montre les huit endonymes.
- Le README affiche ces fichiers, pas des liens vers la maquette.

## Hors de ce sprint

- Traduire le README. La documentation reste en français.
- Changer un catalogue, le shell, le coach ou un preset.
- Reprendre [docs/i18n.md](../i18n.md).
- Publier des scores réels ou un relais entre deux machines.
