# Shell du client

La maquette de [docs/maquette-ui.md](maquette-ui.md) devient la coque du client Electron. La page [docs/mockup/index.html](mockup/index.html) reste la référence visuelle. Le client ne l’embarque pas : les écrans sont des composants React dans `src/renderer/shell`, par-dessus le canvas de [`src/renderer/main.tsx`](../src/renderer/main.tsx). Le plateau 3D, le grab et les règles ne changent pas.

Un changement d’écran se voit d’abord dans la maquette. Il n’entre dans le client qu’une fois cette maquette validée.

Le sprint qui réalise ce branchement est [CHESS-B10](sprints/CHESS-B10.md).

Le verre (jetons, bourrelet, glissement des segments, interrupteurs, caustiques) vit dans [`src/renderer/shell/shell.css`](../src/renderer/shell/shell.css). Les couleurs ne sont pas recopiées dans les composants. Le blason est [`public/brand/w3dts-chessmaster-logo.png`](../public/brand/w3dts-chessmaster-logo.png).

Au lancement, un écran blanc couvre le studio. Le blason, grand et centré, est en niveaux de gris et se colore du bas vers le haut tant que le moteur démarre. Une fois le plateau prêt, le blanc disparaît en fondu. En bas à droite : « ChessMaster & W3DTS copyright Cyril TARRIET ». Échap ne fait rien pendant ce temps. Dessous, l’accueil attend. La fenêtre pair (`chessPeer=1`) saute l’accueil et entre en partie.

Un écran plein émet `mode-picker`, déjà lu par [`ChessDemoProject`](../src/renderer/host/ChessDemoProject.ts). La saisie et le CPU s’arrêtent. Le tiroir assistant ne bloque pas le plateau.

Échap ferme le tiroir, sinon, depuis une partie finie, ramène à l’accueil, sinon ouvre la pause depuis la partie, sinon revient à l’écran précédent.

Une partie finie ouvre une carte en verre (gagné, perdu, nulle) par-dessus le plateau. Voir le plateau la referme et laisse Résultat dans la barre. Recommencer relance le même mode. Le contrat est dans [fin-partie.md](fin-partie.md).

Jouer et Commencer émettent `apply-session`. Contre l’ordinateur devient `cpu`, à deux sur le même écran `hotseat`, sur cet ordinateur et le salon `p2p`, apprendre `learn`. Modes n’affiche que les crans 1 à 3. Le niveau du CPU est une profondeur d’heuristique égale au cran. Un ancien cran 4 ou 5 enregistré retombe sur 2.

Options appelle `setChessGraphicsSettings`. Au-dessus des préréglages, le choix d’ambiance écrit `w3dts-chess-ambiance` (Atelier, Salon, Club, Jardin, Terrasse, Atelier par défaut). La pièce change sans quitter la partie. Il n’y a pas d’HDRI. Au démarrage, la pièce enregistrée est déjà là. Chaque bouton a sa miniature. Une miniature non choisie est en gris : elle se colore au survol et reste en couleur une fois choisie. Paramètres mémorise les volumes comme multiplicateurs des constantes de [`chessTableAudio.ts`](../src/renderer/host/chessTableAudio.ts) et la langue, français par défaut. Le contrat son (prises par pièce, tension) est dans [audio.md](audio.md) ; le sprint est [CHESS-B25](sprints/CHESS-B25.md). Les huit langues du shell sont décrites dans [docs/i18n.md](i18n.md) et découpées dans [CHESS-B11](sprints/CHESS-B11.md).

Sur cet ordinateur ouvre la seconde fenêtre sur le canal `BroadcastChannel`. En ligne, le code est la salle du relais : pas de seconde fenêtre, le salon attend l’autre joueur. Le contrat est [multijoueur.md](multijoueur.md). Un code refusé, ou une table introuvable, reste sur le salon.

Les classements restent des exemples. Pas de compte, pas de serveur de scores.

Le tiroir assistant est le présentateur du coach. Le cadre rond porte le blason. En entraînement, Stop fige la partie sans cri, Annuler revient au coup de l’élève, les 10 minutes sont coupées tant qu’on ne les remet pas, et les fantômes sur le plateau montrent seulement les coups de l’élève : vert, puis bleu, puis jaune, avec le même liseré sur sa pièce. La réponse tient dans une bulle collée à gauche du tiroir. Une page ne coupe pas une phrase. Précédent et Suivant n’apparaissent que s’il y a une page de ce côté. À la dernière, Passer devient Fermer. Le rouge entoure le coup faible. Quand l’assistant coupe de lui-même, le mot Objection s’abat, le plateau tremble, puis le tiroir explique la leçon. `chess=training` est ce mode. `chess=train` reste l’alias d’apprendre. Le modèle parle par le processus principal. La clé ne revient pas au rendu. Le détail est [CHESS-B15](sprints/CHESS-B15.md).

À propos est dans la coque, ouvert depuis l’accueil. La version affichée est `app.getVersion()`, donc le champ `version` de `package.json`. La note est le fichier `docs/releases/X.Y.Z.md` de cette version quand il existe. Il n’y a plus de ligne de version flottante dans [`main.tsx`](../src/renderer/main.tsx).

Sauvegardes est dans la coque : le lien d’accueil, le bouton « Reprendre la partie » centré sous Jouer quand une interruption existe, l’écran de gestion, et Pause avec Sauvegarder. Pause porte aussi Abandon et Proposer nulle ; le contrat est [fin-partie.md](fin-partie.md). Le panneau d’accueil est plus large pour que les cinq liens restent dans le cadre. Les sauvegardes sont dans [persistance.md](persistance.md).
