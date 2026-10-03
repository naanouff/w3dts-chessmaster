# Sprint CHESS-B8 — Maquette du shell

Découpage de [docs/maquette-ui.md](../maquette-ui.md). Le client Electron, le HUD et le moteur ne changent pas. La maquette est une page statique dans `docs/mockup/`.

Ordre : B8a, puis B8b, puis B8c, puis B8d. Ouvrir `docs/mockup/index.html` dans un navigateur suffit pour relire un ticket. Pas de `pnpm test` : aucun module du jeu n’est touché.

## CHESS-B8a — Socle

Page unique, écrans permutés sans rechargement. Verre sombre, ambre `#e8b86d`, fond qui laisse imaginer le studio. Le blason vient de `public/brand/w3dts-chessmaster-logo.png`.

Fichiers :

- `docs/mockup/index.html`
- `docs/mockup/mockup.css`
- `docs/mockup/mockup.js`

Fait quand :

- La page s’ouvre sans serveur et sans WebGPU.
- Échap ferme le panneau courant, et depuis la partie ouvre la pause.
- Le focus clavier suit le bouton principal de l’écran affiché.

## CHESS-B8b — Accueil, modes, salon

Fichiers : les trois du socle.

Fait quand :

- L’accueil montre le blason, Jouer, Classements, Options, Paramètres.
- Modes montre les cinq cartes : ordinateur (couleur et niveau), même écran, sur cet ordinateur, en ligne, apprendre (liste ECO courte).
- Commencer, hors « En ligne », arrive sur la partie avec le mode choisi lisible dans la barre.
- « En ligne » ouvre le salon : créer un code, le copier, attendre, ou rejoindre un code. Les états sont en attente, connexion, connecté, déconnecté.
- La couleur se choisit seulement à la création. Connecté mène à la partie, avec l’état de liaison dans la barre.
- Quitter la table ou un code refusé ramène au salon, pas à une partie fantôme.

## CHESS-B8c — Partie, assistant, pause

Fichiers : les trois du socle.

Fait quand :

- La barre de partie porte le blason réduit, le trait, la pendule, Assistant et Pause. Les touches LMB, RMB / molette et X sont en bas.
- L’assistant est un tiroir à droite : Expliquer, Indice, question libre, bandeau « commentaire, pas un coup ». L’attente reste dans le tiroir. Sans modèle, un lien ouvre Paramètres. En Apprendre, la réponse d’exemple ne nomme pas le coup du livre.
- Pause : Reprendre, Changer de mode, Options, Retour à l’accueil. En ligne, Quitter la table est présent tant que la liaison n’est pas coupée.
- Retour à l’accueil réaffiche l’accueil.

## CHESS-B8d — Options, paramètres, classements

Fichiers : les trois du socle.

Fait quand :

- Options reprend Fluide, Équilibré, Qualité, Natif, la résolution, les textures 256 / 512 / 1024, ombres, occlusion, reflets, bloom, et une ligne « Rendu … ». Le choix reste affiché au retour sur l’écran.
- Paramètres porte le volume des coups, le volume d’ambiance, la langue, le rappel des contrôles, et l’assistant : Ollama local ou API distante (URL, modèle, clé). La clé saisie ne réapparaît pas ; l’écran dit « clé enregistrée ».
- Classements a deux onglets, Local et En ligne, avec victoires, défaites, nuls, série et cinq parties, marqués « exemple ». Pas de formulaire de compte.

## Hors de ce sprint

- Brancher ce shell dans `src/renderer` : c’est [CHESS-B10](CHESS-B10.md), décrit dans [docs/shell-client.md](../shell-client.md).
- Relais réseau entre deux machines, serveur de scores, compte joueur.
- IPC du coach (c’est [CHESS-B7](CHESS-B7.md)), Stockfish, ou un changement de règles.
