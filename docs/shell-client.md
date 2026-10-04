# Shell du client

La maquette de [docs/maquette-ui.md](maquette-ui.md) devient la coque du client Electron. La page [docs/mockup/index.html](mockup/index.html) reste la référence visuelle. Le client ne l’embarque pas : les écrans sont des composants React dans `src/renderer/shell`, par-dessus le canvas de [`src/renderer/main.tsx`](../src/renderer/main.tsx). Le plateau 3D, le grab et les règles ne changent pas.

Un changement d’écran se voit d’abord dans la maquette. Il n’entre dans le client qu’une fois cette maquette validée.

Le sprint qui réalise ce branchement est [CHESS-B10](sprints/CHESS-B10.md).

Le verre (jetons, bourrelet, glissement des segments, interrupteurs, caustiques) vit dans [`src/renderer/shell/shell.css`](../src/renderer/shell/shell.css). Les couleurs ne sont pas recopiées dans les composants. Le blason est [`public/brand/w3dts-chessmaster-logo.png`](../public/brand/w3dts-chessmaster-logo.png).

Au lancement, un écran blanc couvre le studio. Le blason, grand et centré, est en niveaux de gris et se colore du bas vers le haut tant que le moteur démarre. Une fois le plateau prêt, le blanc disparaît en fondu. En bas à droite : « ChessMaster & W3DTS copyright Cyril TARRIET ». Échap ne fait rien pendant ce temps. Dessous, l’accueil attend. La fenêtre pair (`chessPeer=1`) saute l’accueil et entre en partie.

Un écran plein émet `mode-picker`, déjà lu par [`ChessDemoProject`](../src/renderer/host/ChessDemoProject.ts). La saisie et le CPU s’arrêtent. Le tiroir assistant ne bloque pas le plateau.

Échap ferme le tiroir, sinon ouvre la pause depuis la partie, sinon revient à l’écran précédent.

Jouer et Commencer émettent `apply-session`. Contre l’ordinateur devient `cpu`, à deux sur le même écran `hotseat`, sur cet ordinateur et le salon `p2p`, apprendre `learn`. Le niveau du CPU est une profondeur d’heuristique plafonnée à 3. Les crans 4 et 5 valent 3.

Options appelle `setChessGraphicsSettings`. Paramètres mémorise les volumes comme multiplicateurs des constantes de [`chessTableAudio.ts`](../src/renderer/host/chessTableAudio.ts) et la langue, français par défaut. Les huit langues du shell sont décrites dans [docs/i18n.md](i18n.md) et découpées dans [CHESS-B11](sprints/CHESS-B11.md).

Le salon ouvre la seconde fenêtre sur le canal `BroadcastChannel` existant et affiche le vrai `p2pStatus`. Le code se copie. Il ne choisit pas un canal. Un code refusé reste sur le salon. Pas de relais entre deux machines.

Les classements restent des exemples. Pas de compte, pas de serveur de scores.

Sans pont `coachSettings` publié, le tiroir dit qu’aucun modèle n’est branché et ouvre Paramètres.

À propos est dans la coque, ouvert depuis l’accueil. La version affichée est `app.getVersion()`, donc le champ `version` de `package.json`. La note est le fichier `docs/releases/X.Y.Z.md` de cette version quand il existe. Il n’y a plus de ligne de version flottante dans [`main.tsx`](../src/renderer/main.tsx).

Sauvegardes est dans la coque : le lien d’accueil, le bouton « Reprendre la partie » centré sous Jouer quand une interruption existe, l’écran de gestion, et Pause avec Sauvegarder. Le panneau d’accueil est plus large pour que les cinq liens restent dans le cadre. Le contrat est dans [persistance.md](persistance.md).
