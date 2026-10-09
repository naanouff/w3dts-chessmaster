# Plan QA de l’alpha

L’alpha prouve qu’un joueur extérieur installe le jeu, finit une partie dans chaque mode, sauvegarde, reprend et quitte, sans plantage ni partie perdue.

Le sprint qui livre les décisions bloquantes est [CHESS-B24](sprints/CHESS-B24.md).

Cette page dit quoi tester et dans quel ordre. Les comportements attendus restent dans leur page : [Shell](shell-client.md), [Fin de partie](fin-partie.md), [Survol](survol.md), [Ambiances](ambiances.md), [Persistance](persistance.md), [Multijoueur](multijoueur.md), [Coach](coach-ia.md), [Profil graphique](profil-graphismes.md), [Langues](i18n.md).

« Niveau » a deux sens ici : les cinq ambiances, et les cinq crans du CPU.

## Entrée et sortie

Entrée en campagne :

- `pnpm test`, `pnpm check` et `pnpm run docs` passent.
- L’installateur NSIS vient d’une branche `release/X.Y.Z`, avec `docs/releases/X.Y.Z.md`. Voir [Version](semver.md).
- Le build web (`pnpm build:web`) est publié sur Vercel par la CI sur `main` et `release/*`. Voir [Compiler](build.md).
- Le smoke test passe sur deux machines au moins.

Sortie de l’alpha :

- Aucun S1 ni S2 ouvert sur un parcours P1.
- Vingt cycles fermeture–reprise sans partie perdue.
- Fluide tient 30 img/s sur la machine la plus faible de la matrice.

| Sévérité | Sens |
| --- | --- |
| S1 | Plantage, partie perdue, coup illégal accepté, partie impossible à finir |
| S2 | Parcours cassé, contournement possible |
| S3 | Défaut visuel ou texte faux |
| S4 | Cosmétique |

P1 bloque l’alpha. P2 se teste pendant la campagne. P3 si le temps le permet.

## Matrice

| Axe | Valeurs |
| --- | --- |
| GPU | Intégré, milieu de gamme (GTX 1660), haut de gamme (RTX 3070 Ti) |
| Fenêtre | 1366×768, 1920×1080, 2560×1440, 3440×1440, 3840×2160 ; mise à l’échelle Windows 125 % et 150 % |
| Préréglage | Fluide, Équilibré, Qualité, Natif |
| Système | Windows 10, Windows 11, compte non administrateur |
| Réseau | Fibre, 4G partagée, proxy d’entreprise |
| Coach | Ollama avec `llama3.2`, Ollama arrêté, Ollama absent, API distante |

Deux bornes d’abord : GPU intégré en Fluide à 1080p, et RTX en Natif à 4K.

## UI et UX

**Démarrage (P1).** Écran blanc, blason qui se colore, fondu vers l’accueil. Échap ne fait rien pendant ce temps. Premier lancement sur un profil vierge, puis second lancement avec les préférences retrouvées. Fenêtre restaurée ; une fenêtre laissée sur un écran débranché revient en 1280×800 centré.

**Échap (P1).** L’ordre est celui de [Shell](shell-client.md) : tiroir, puis partie finie, puis pause, puis écran précédent. Chaque combinaison se teste, y compris le tiroir ouvert pendant la pause. Le focus se voit, et Tab parcourt chaque écran.

**Fin de partie (P1).** Mat gagné et perdu, drapeau, pat, matériel insuffisant, ligne d’ouverture terminée. Les quatre boutons. Résultat rouvre la carte après Voir le plateau.

**Survol et prise (P1).** La lueur ivoire suit le filtre de [Survol](survol.md). Le cavalier qui déborde sur la case voisine. Or, bleu, rouge au dépôt. Relâcher hors du canvas. Alt-Tab avec une pièce en main.

**Langues (P2).** Un passage complet dans les huit langues. Débordements en allemand et en russe, glyphes en chinois et en japonais, français resté en dur. Endonymes dans le sélecteur.

**Options et Paramètres (P2).** Le préréglage change sans quitter la partie. Les volumes restent après relance. Miniatures d’ambiance : grises, colorées au survol, colorées une fois choisies.

**Accessibilité (P3).** Mouvement réduit : ni claque ni tremblement. Les surbrillances restent lisibles en Fluide, sans bloom.

Chaque écran reçoit une note de 1 à 5 sur la lisibilité, l’action suivante évidente et le retour possible.

## Ambiances

P1 pour l’Atelier, P2 pour les quatre autres. Chaque ambiance passe dans les quatre préréglages.

- Les 64 cases restent la zone la plus claire. Rien ne masque une case. La lampe du Salon laisse la colonne a visible.
- Le plateau repose sur la table, sans flotter ni s’enfoncer. Le Salon ajoute la nappe.
- Cimetière : blancs pris à gauche, noirs à droite, dans le bon contenant. Débordement après une quinzaine de prises.
- Feu, poussière et cigare au Salon, à l’Atelier et au Club. Rien au Jardin ni à la Terrasse. Aucun grain sur les cases.
- Changer d’ambiance en partie ne touche ni la position, ni les pendules, ni le cimetière.
- Un GLB retiré de `public/sets/` laisse la toile et la partie démarre. Une valeur inconnue de `w3dts-chess-ambiance` retombe sur l’Atelier.
- Images par seconde au repos et pendant une prise. Le Jardin, le plus lourd en triangles, passe en premier.

## CPU

P1. Modes n’affiche que les crans 1 à 3. Pour chaque cran : trois parties avec les blancs, trois avec les noirs. On relève le temps de réflexion, le résultat d’un joueur moyen et les coups absurdes.

Le CPU ne joue ni en pause ni sous un écran plein.

## Gameplay

**Règles (P1).** Une liste de FEN de référence : roque des deux côtés, roque à travers un échec, prise en passant, promotion, échec double, pat, matériel insuffisant. La promotion est automatique en dame. La QA vérifie le rendu et le cimetière ; [`chessMatch.test.ts`](../tests/chessMatch.test.ts) porte les règles.

**Pendule (P1).** 10:00 au départ. Drapeau à zéro. Gelée en pause, sous un écran plein, et tant qu’une restauration à deux attend l’autre joueur.

**Abandon et nulle proposée (P1).** Depuis la pause (ou la barre) : Abandon ouvre la carte Perdu. Proposer nulle : en hotseat / local / en ligne l’autre camp accepte ou refuse ; contre l’ordinateur, accepter ou refuser selon une règle simple documentée. Pas de règle des 50 coups ni de triple répétition dans l’alpha.

**Modes (P1).**

| Mode | À casser |
| --- | --- |
| Contre l’ordinateur | Couleur, crans 1–3, partie avec les noirs |
| À deux, même écran | Les deux camps jouent, le survol suit le trait, abandon / nulle |
| Sur cet ordinateur | Seconde fenêtre, synchro, fermeture d’une fenêtre, abandon / nulle |
| En ligne | Code de quatre caractères, `0000` refusé, table pleine, coupure 4G, reconnexion, départ de l’adversaire, abandon / nulle |
| Apprendre | Les neuf ouvertures, un coup hors livre, progression, fin de ligne |
| Entraînement | Stop, Annuler, fantômes, liseré rouge, cri Objection (maquette → prod), coach absent, arrêté ou distant |

**Persistance (P1).** Tuer le processus en partie, relancer, Reprendre : position et pendules à une seconde près. Vingt et une sauvegardes volontaires : la plus ancienne part. Une partie finie ou intacte ne s’enregistre pas. Restaurer à deux, sur cet ordinateur et en ligne. Un `w3dts-chess-saves` corrompu ne plante pas.

**Robustesse (P2).** Clics répétés pendant un vol de pièce. Prise pendant la réflexion du CPU. Trente minutes de partie, mémoire relevée au début et à la fin. Veille de Windows en pleine partie.

## Smoke test

À chaque build, environ quinze minutes.

1. Installer, lancer.
2. Cinq coups contre l’ordinateur, une prise.
3. Changer d’ambiance, puis de préréglage, sans quitter la partie.
4. Pause, Sauvegarder, quitter, relancer, Reprendre.
5. Mat du berger à deux sur le même écran : carte Gagné.
6. Une leçon d’ouverture, un coup hors livre.
7. Passer en anglais, puis en japonais.
8. À propos : la version est celle de `package.json`.

## Déroulé

- Semaine 1 : sessions exploratoires d’une heure, une section de cette page par session, trois machines.
- Semaines 2 et 3 : parcours P1 scriptés, puis cinq à dix testeurs extérieurs. Questionnaire court : score SUS et trois questions ouvertes.
- Une fiche de bug porte le build, la machine, le préréglage, l’ambiance, le mode, le FEN, les étapes et une vidéo.
- Tri chaque jour. Un S1 ou un S2 corrigé arrive avec le test Vitest qui le reproduit.

## Décisions alpha

Tranchées avant campagne. Le découpage est [CHESS-B24](sprints/CHESS-B24.md). Un ticket ouvert de ce sprint bloque l’entrée en alpha.

| Point | Décision | Ticket |
| --- | --- | --- |
| Contrats | fin-partie, shell, règle CPU ±50 cp pour la nulle | B24a |
| Crans CPU | Modes n’affiche que 1–3 | B24b |
| Matériel insuffisant | Carte Nulle + test Vitest | B24c |
| Fins molles | Abandon + proposer nulle (maquette puis client) | B24d, B24e |
| Objection | Maquette → prod | B24f |
| Coach | Sans modèle = nominal ; [guide Ollama](coach-ia.md#installation-ollama-windows) | B24g |
| Relais | Smoke OK (2026-10-09) ; astreinte **Cyril TARRIET** | B24i |
| Banc graphique | RTX OK (Fluide ≪ 33 ms) ; **pas d’iGPU** sur la machine de campagne — arbitrage ouverture | B24h |

### Banc sur laptop hybride

Beaucoup de portables ont une RTX et un GPU intégré (Intel ou AMD). Windows peut forcer l’un ou l’autre pour Electron / le banc. Les cases du relevé sont dans [Profil graphique](profil-graphismes.md#relevé).

1. Fermer tout `pnpm dev` (le banc prend le port 5173).
2. Paramètres → Système → Affichage → Graphiques.
3. Ajouter l’exécutable du banc (ou `electron.exe` / le `.exe` installé selon le lancement).
4. Options → **Économie d’énergie** (GPU intégré), pas Performances élevées (RTX).
5. `pnpm bench:graphics`. Vérifier dans le Gestionnaire des tâches → Performances que le GPU intégré travaille.
6. Remettre Performances élevées, relancer le banc sur la RTX.
7. Recopier les médianes dans [profil-graphismes.md](profil-graphismes.md).

Si l’entrée Graphiques n’apparaît pas, le panneau NVIDIA → Gérer les paramètres 3D → Programme → Processeur graphique préféré → Processeur intégré.

### Brief testeurs (extrait)

- Sans Ollama, le coach reste utilisable (fantômes, phrases fixes). Pour brancher un modèle : [Installation Ollama](coach-ia.md#installation-ollama-windows).
- En ligne : un redémarrage du relais vide les salles. Rejoindre avec un **nouveau** code si la table disparaît.
- Astreinte relais pendant l’ouverture : **Cyril TARRIET**.
