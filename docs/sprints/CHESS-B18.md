# Sprint CHESS-B18 — Objection et fin de partie

Découpage de [docs/fin-partie.md](../fin-partie.md). La page statique `docs/mockup/` change. Le client, le HUD, le grab et les règles ne changent pas.

Ordre : B18a, puis B18b. Ouvrir `docs/mockup/index.html` dans un navigateur suffit pour relire un ticket. Pas de `pnpm test` : aucun module de `src/` n’est touché.

## CHESS-B18a — Objection

Fichiers : `docs/mockup/index.html`, `docs/mockup/mockup.css`, `docs/mockup/mockup.js`.

Fait quand :

- En entraînement, « Jouer le coup » fait trembler le studio, tomber le blason, et claquer « Objection ! » sur la dalle ambre.
- Une seconde ligne dit « Ce n’est pas le coup le plus net. »
- Le cri tient environ 1,6 s, puis se réduit vers le cadre rond du tiroir. Stop prend le focus.
- Le cri n’a pas de bouton. Le pointeur le traverse.
- Avec un mouvement réduit, il n’y a ni claque ni tremblement. La phrase est seulement dans le tiroir.

## CHESS-B18b — Carte de fin

Fichiers : les trois de B18a, et `docs/maquette-ui.md`.

Fait quand :

- Une carte en verre, au centre, laisse voir le plateau. Trois états d’exemple : Gagné, Perdu (mat et drapeau), Nulle.
- Les boutons sont Voir le plateau, Recommencer, Changer de mode, Retour à l’accueil. Pas de Sauvegarder.
- Voir le plateau referme la carte, laisse le résultat dans la barre, et un bouton Résultat la rouvre.
- Recommencer relance le même mode. Échap ramène à l’accueil et ne reprend pas la partie.
- Trois liens à côté de l’étiquette « Maquette » ouvrent Gagné, Perdu et Nulle. Ils ne sont pas dans la barre de partie.
- `docs/maquette-ui.md` décrit l’objection tenue et la carte de fin, et les ajoute au parcours.

## Hors de ce sprint

Le branchement dans le client. Il attend la validation de cette maquette. Pas d’abandon proposé, pas de compte, pas de Stockfish.
