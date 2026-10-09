# Multijoueur

Deux joueurs sur deux machines se retrouvent avec un code de table. ChessMaster est un client. Le relais est [w3dts-relay](https://github.com/naanouff/w3dts-relay), un autre dépôt, un autre process.

Le salon en ligne ouvre `WebSocketRelayTransport` sur le code de table. Sur cet ordinateur reste une seconde fenêtre, via `BroadcastChannel`.

## Rendez-vous

Le code à quatre lettres est l’identifiant de salle. L’hôte le crée, le copie, le dit. L’invité le saisit. Même règle qu’aujourd’hui : quatre caractères, et pas `0000`.

Sur cet ordinateur ne change pas : seconde fenêtre, canal local.

En ligne, pas de seconde fenêtre. L’hôte reste au salon, code visible, jusqu’à l’invité. L’invité reste au salon le temps du hello. Les deux passent en partie quand les sièges sont d’accord. Les pendules restent gelées tant que le second joueur n’a pas rejoint.

La couleur de l’hôte fait foi. L’invité prend l’autre. Il n’ouvre pas la partie jouable avant ce hello. Quitter la table ferme la liaison. L’autre voit le départ, les pendules gèlent, le salon se rouvre.

Restaurer une partie en ligne reste le parcours de [persistance.md](persistance.md) : salon, nouveau code, message `restore` à la connexion. L’ancien code n’est pas réutilisé.

## Relais

Le service n’est pas dans ce dépôt, ni dans l’installateur. Il parle le protocole déjà figé par `WebSocketRelayTransport` dans `@naanouff/w3dts-multiplayer-p2p`. Plusieurs applications partagent le même déploiement. L’espace de noms est le chemin, parce que le `join` du paquet n’a pas d’identifiant d’application :

`wss://relay-production-01c1.up.railway.app/v1/chessmaster`

Le binaire est opaque. ChessMaster y met le fil d’échecs. Un autre client y met autre chose. Le serveur ne le décode pas.

À l’ouverture le client envoie `join` (`peerId`, `room`). Il parle avec `broadcast` ou `send`. `data` est du base64. Il attend `welcome` (les autres déjà là), `peer-joined`, `peer-left`, et `data`. `broadcast` ne part qu’une fois qu’un pair est connu : le serveur envoie `welcome` ou `peer-joined` avant toute donnée, sinon le premier hello est jeté chez l’émetteur.

La salle vit dans le service :

- Le premier `join` crée la salle et répond `welcome` avec une liste vide.
- Le deuxième `peerId`, sous le plafond, reçoit `welcome` avec l’autre. Celui qui attend reçoit `peer-joined`. Pour `chessmaster` le plafond est 2. C’est une politique du service, pas une règle d’échecs.
- Le même `peerId` qui revient remplace le socket. Pas un joueur de plus, pas de `peer-left`. Il reçoit `welcome` et renvoie sa position.
- Au-delà du plafond, le socket est fermé sans `welcome`.
- Le dernier départ retire la salle. Un JSON illisible est ignoré. L’identifiant de salle est une chaîne opaque, plafonnée en longueur. La charge utile est plafonnée.

L’hôte et l’invité sont indistinguables pour le relais. L’ordre d’arrivée ne choisit pas la couleur. Tout code valide crée une salle : il n’y a pas de « salle inconnue ». « Table introuvable ou pleine » est un délai chez l’invité, dans le client. L’hôte attend sans délai. Le code est une capacité partagée, pas un compte.

## Déploiement

Railway, un service Node, une réplique, un domaine public. Le process écoute `0.0.0.0` et `PORT`, et répond `GET /health` sur le même port. Le TLS du domaine donne le `wss://`. Les sockets ne sont pas coupées pour inactivité.

Une réplique tient les salles en mémoire. Plusieurs répliques sans bus partagé séparent les joueurs. Redis n’entre que lorsque cette réplique ne suffit plus.

Vercel ne porte pas ce service. Une connexion y meurt à la durée maximale de la Function, et une reconnexion peut tomber sur une instance qui n’a pas la salle.

Le client ouvre `wss://relay-production-01c1.up.railway.app/v1/chessmaster`. `VITE_CHESS_RELAY_URL` remplace cette adresse, par exemple `ws://127.0.0.1:4471` pour un relais sur cette machine. L’application Electron est servie en `app://` : l’adresse publiée est déjà en `wss://`. `GET /health` sur l’origine répond `ok`.

Redémarrer le process vide les salles. Les deux clients qui se reconnectent (dix essais, toutes les trois secondes) rattrapent la position.

## Partie

Chaque client garde `ChessMatch`. On ne réplique pas les transforms. Le fil reste [`chessWire.ts`](../src/chess/net/chessWire.ts).

- `hello` : hôte ou non, couleur, FEN, deux pendules. Deux hôtes sur le même code : refus.
- `move` et `sync` emportent les deux pendules. L’instantané de celui qui vient de jouer fait foi.
- `restore` inchangé. À la reconnexion, le plus avancé en demi-coups répond, avec les pendules.
- Un coup illégal localement est ignoré. Un FEN en avance reconstruit la table, comme aujourd’hui.

Ce n’est pas un serveur anti-triche. Pas de compte, pas de classement en ligne. Abandon et nulle proposée voyagent sur le fil (`resign`, `draw-offer`, `draw-accept`, `draw-refuse`) ; le contrat est [fin-partie.md](fin-partie.md). Le mat, le pat, le drapeau et le matériel insuffisant finissent aussi la partie.

## Alpha : charge et astreinte

Avant d’ouvrir les testeurs en ligne ([CHESS-B24](sprints/CHESS-B24.md) i) :

1. `GET https://relay-production-01c1.up.railway.app/health` répond `ok`.
2. Smoke de charge : au moins trois tables de deux joueurs, cinq coups chacune, sans perte de salle.
3. Une personne d’astreinte tient la fenêtre d’ouverture. Un redémarrage du process Railway vide les salles : le brief testeurs le rappelle.

**Résultat (2026-10-09).** `health` = `ok`. Smoke `tmp/smoke-relay.ps1` : 3 tables × 2 pairs, hello + 5 coups, `ok: true`, aucune salle perdue. Astreinte ouverture : **Cyril TARRIET**.
