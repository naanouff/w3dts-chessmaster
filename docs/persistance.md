# Persistance

Le joueur retrouve ses réglages, sa fenêtre, et ses parties, y compris à deux. Fermer le jeu garde la partie en cours. Cette fermeture n’efface pas une sauvegarde qu’il a demandée.

Déjà enregistrés, et inchangés : le graphisme (`w3dts-chess-graphics`, [`chessGraphicsSettings.ts`](../src/renderer/graphics/chessGraphicsSettings.ts)), le volume des coups, l’ambiance et la langue (`w3dts-chess-shell`, `parseShellPrefs` dans [`shellScreen.ts`](../src/renderer/shell/shellScreen.ts)).

L’écran de gestion est nouveau. Il se valide dans [la maquette](mockup/index.html). Le client ne le reçoit qu’après cette validation.

Sprint : [CHESS-B14](sprints/CHESS-B14.md).

## Habitudes

La même clé `w3dts-chess-shell` retient le dernier mode, la couleur, le niveau 1–5 et le code ECO. La couleur est unique : elle sert à la partie et à l’hôte d’une table.

Un JSON ancien ou illisible retombe sur l’ordinateur, les blancs, le niveau 2 et la première ouverture. L’accueil reste l’accueil. Modes s’ouvre sur ces choix.

## Fenêtre

Taille, position et état agrandi vivent dans `userData/window-bounds.json`, lu par [`src/main/index.ts`](../src/main/index.ts). Une fenêtre hors écran, ou trop petite, revient au 1280×800 centré.

## Deux casiers

Une clé `w3dts-chess-saves`.

- **Interruption.** Un seul emplacement. Il est écrit à la fermeture, en quittant la table, à chaque coup, et au plus une fois par seconde pour la pendule. Ainsi un plantage laisse encore une restauration. La fermeture suivante le remplace. Il ne touche pas aux sauvegardes volontaires.
- **Volontaires.** Une liste, ajoutée depuis Pause par « Sauvegarder ». Le titre est automatique : mode, couleur, date. Plafond de 20. Au-delà, la plus ancienne volontaire part. Supprimer se fait dans l’écran de gestion.

On n’enregistre pas une position de départ encore intacte, ni une partie finie (mat, pat, drapeau, ligne ECO terminée). Commencer une nouvelle partie efface l’interruption. Les volontaires restent.

Chaque fiche porte un identifiant, la sorte, la date, le mode du shell (`cpu`, `hotseat`, `local`, `online`, `learn`), la session, le FEN, les pendules, et pour la leçon l’index de coup. `local` et `online` sont des sessions `p2p`.

## Écran Sauvegardes

- **Accueil.** Lien « Sauvegardes » à côté de Classements. S’il existe une interruption, un bouton « Reprendre la partie », centré sous Jouer. Les pendules ne tournent pas tant que le joueur n’a pas restauré.
- **Gestion.** Bandeau d’interruption en tête : mode, camp, temps, date, Restaurer, Écarter. Puis la liste des volontaires, avec le même résumé, Restaurer et Supprimer. L’état vide ne montre pas de fausses parties. La maquette affiche trois exemples figés : une interruption contre l’ordinateur, une volontaire « Sur cet ordinateur », une volontaire « En ligne ».
- **Pause.** « Sauvegarder » ajoute une volontaire et confirme en une ligne. « Sauvegardes » ouvre la gestion. Reprendre ramène à la table. Ce n’est pas le chargement d’une fiche.

## Restaurer à deux

Le fil ([`chessWire.ts`](../src/chess/net/chessWire.ts)) transporte un FEN. `sync` garde le camp le plus avancé. `reset` réapplique le FEN et remet les pendules à 10:00. Une restauration impose la position sauvée et les deux temps.

Le message `{ v: 1, t: 'restore', fen, whiteSeconds, blackSeconds }` force la position et les pendules, sans le handshake de `sync`. `reset` ne change pas : une nouvelle partie repart à 10:00. Un ancien `sync` sans pendules reste valable.

**Sur cet ordinateur.** Restaurer charge la fiche dans cette fenêtre et rouvre la seconde via `open-peer-window`, couleur opposée, avec un drapeau de reprise. Les deux fenêtres lisent la même fiche. La pendule reste gelée tant que l’autre fenêtre n’est pas connectée.

**En ligne.** Restaurer charge la fiche ici et ouvre le salon. Le joueur crée un nouveau code. L’adversaire rejoint. À la connexion, l’hôte envoie `restore`. L’invité n’a pas le fichier : il reçoit la position et les pendules. La pendule reste gelée tant que personne n’est connecté. L’ancien code de table n’est pas réutilisé.

## Pendule et leçon

La pendule n’avance pas quand un écran plein couvre la table, ni pendant la pause. Une leçon reprend en calant `OpeningTrainer` sur l’index sauvé, puis en rejouant les coups du livre.
