# Survol d’une pièce

Avant le clic, une lueur ivoire basse marque la case de la pièce que le rayon prendrait. Le cavalier dépasse souvent sur la case voisine : la lueur montre la pièce qui partira.

Sprint : [CHESS-B23](sprints/CHESS-B23.md).

## Qui

Même filtre que le clic. La pièce est de la couleur qui joue. À deux sur le même écran, les deux camps. Sinon, seulement la couleur locale. Rien si la partie est finie, si l’ordinateur réfléchit, ou si une pièce est en vol. Rien sur une case vide, une pièce adverse, ou hors du plateau.

## Quand

Tant que le bouton n’est pas enfoncé, le plan déjà utilisé pour le dépôt se pose sur cette case. Au clic, ce plan reprend les couleurs du dépôt : or sur un coup légal, bleu sur la case de départ, rouge ailleurs. Sorti du canvas, le plan s’éteint.

## Lueur

Ivoire chaud, à part des lueurs de coup. Celles-là ont un pic d’émission au-dessus de 1 et bloom. Le survol reste sous 1 : il se lit en Fluide, sans halo en Qualité. Il n’est pas le vert des coups légaux.

Le liseré du coach reste le sien : vert, bleu, jaune, puis orange et violet sur la pièce à jouer, rouge sur le coup faible. Pas de passe nouvelle. Pas d’écran : la maquette ne reçoit pas ce plan.
