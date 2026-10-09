# Sprint CHESS-B22 — Vie de revue

Découpage de [Ambiances](../ambiances.md), section Vie de revue. La revue gagne un feu, des poussières et un cigare. Une partie n’en a pas.

Ordre : B22a, puis B22b, puis B22c. Chaque ticket commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande.

## CHESS-B22a — Le paquet

Fichiers : `package.json`, `pnpm-lock.yaml`.

Fait quand :

- `@naanouff/w3dts-particles` est en `0.1.5`, depuis npmjs.
- Le core reste `0.0.37`, le logger `0.0.22`.
- Le premier import de `ParticleEmitterComponent` passe. Le bundle importe `ComputeTargetComponent` depuis le core. Si ce symbole manque au `dist` du 0.0.37, le ticket s’arrête : on ne fabrique pas de quads, on ne change pas de registre. C’est un core à republier.

## CHESS-B22b — Le contrat, sans scène

Fichiers : `tests/chessSceneLife.test.ts`, un module à part de `ChessDemoProject`.

Fait quand :

- Le multiplicateur du feu de l’âtre reste entre 0,75 et 1,25, n’est pas constant, ne vaut jamais 0.
- Chaque émetteur de revue a un `graphId` du catalogue (`fire-realistic` ou `smoke-realistic`) et un `maxParticles` d’au plus 400.
- La liste d’une partie est vide.
- La liste de la revue, Vie allumée, couvre le salon, l’atelier et le club, et rien d’autre. Jardin et terrasse n’y sont pas.
- Vie coupée, la liste de la revue est vide.
- Le bout du cigare avance le long du bâton et reboucle. La fumée reste sur ce bout.

On ne reteste pas le paquet.

## CHESS-B22c — La revue

Fichiers : `src/renderer/review/SetReviewBar.tsx`, `src/renderer/host/ChessDemoProject.ts`, le module de B22b, les graphes et les cartes copiés depuis le viewer (`public/particles/`, `ParticleInstanceColorGraph`, `soft_ember`, `soft_smoke`).

Fait quand :

- L’interrupteur Vie est sur la barre, à côté de Volume, allumé au départ. Il n’entre pas dans `ChessGraphicsSettings`, ni dans Options, ni dans les catalogues de langue. Les libellés de cette barre sont déjà en dur.
- `isChessSetReview()` faux : aucun émetteur, le compute ne s’enregistre pas.
- Vie allumée en revue : l’âtre a sa lumière qui vacille et ses deux émetteurs, l’atelier a un émetteur par cône (projecteur, softbox), orienté le long du faisceau, le bar a la boîte, la braise qui avance et la fumée collée au bout.
- Vie coupée : ces entités ne sont pas là. Les lumières de pièce reviennent à leur intensité écrite.
- Pas d’ombre, pas de collision, pas de texture de feu sur `cheminee.glb`.
- `ember_particles.compute.wgsl` n’est pas modifié.

La section Vie de revue de [Ambiances](../ambiances.md) est déjà le contrat. On n’y ajoute une phrase que si le code s’en écarte.

## Hors de ce sprint

- Jardin et terrasse.
- Une partie, Fluide compris, et tout champ dans `ChessGraphicsSettings`.
- Les néons du club, la lanterne, le soleil du jardin.
- Un graphe de poussière écrit ici. L’orientation de l’émetteur suffit.
- Relancer un banc graphique.
