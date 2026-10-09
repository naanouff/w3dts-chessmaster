# Sprint CHESS-B17 — Profil graphique

Découpage de [docs/profil-graphismes.md](../profil-graphismes.md). Mesure seulement. Aucun préréglage, aucune passe, aucun plafond ne change. Le rapport chiffré s’écrit dans cette page, pas dans ce sprint.

Ordre : B17a, puis B17b, puis B17c, puis B17d. B17e après la campagne. Chaque ticket de code commence par un test qui échoue et se termine par `pnpm test` et `pnpm check`. B17e n’a pas de test : il consigne les temps déjà mesurés.

## CHESS-B17a — Combinaisons

Fichiers : `tests/graphicsBench.test.ts`, `src/renderer/graphics/graphicsBench.ts`.

Fait quand :

- Les 768 combinaisons existent et sont uniques. L’anticrénelage est le sixième interrupteur.
- Sur une fenêtre 1920×1080 en DPR 1, les quatre résolutions ont le même framebuffer.
- Deux réglages de même surface, mêmes passes et mêmes textures partagent une clé.
- Le module ne lance pas Electron et n’écrit pas de fichier.

## CHESS-B17b — Fenêtre de banc

Fichiers : `src/main/index.ts`, le test du contrat de lancement.

Fait quand :

- `CHESS_GRAPHICS_BENCH=1` ouvre `?bench=graphics` dans une fenêtre dont la taille est imposée.
- Cette fenêtre n’écrit pas `window-bounds.json`.
- Les drapeaux de lancement incluent `--disable-gpu-vsync`. `--disable-frame-rate-limit` fait tomber le processus GPU, il n’est pas passé. Le temps d’image est la médiane jusqu’à la fin de la file GPU.
- Sans la variable, la fenêtre de jeu habituelle ne change pas.

## CHESS-B17c — Matrice au repos

Fichiers : le branchement `?bench=graphics` dans le rendu, `scripts/profile-graphics.mjs`, `.gitignore`, [docs/build.md](../build.md).

Fait quand :

- Après le plateau prêt, chaque clé au repos attend environ 45 images puis relève la médiane sur environ 90 : temps d’image, images/s, passes, triangles, draw calls, mémoire, taille interne.
- Les clés de même coût ne sont chronométrées qu’une fois. Les 768 lignes reprennent cette mesure.
- Le script enchaîne 1366×768, 1920×1080, 2560×1440, 3440×1440 et 3840×2160.
- Fluide et Qualité sont comparés avant le reste. Des temps égaux arrêtent la campagne et le disent.
- La sortie est `tmp/graphics-bench.json`. `tmp/` est ignoré par git.
- [Compiler](../build.md) nomme la commande.

## CHESS-B17d — Déplacement

Fichiers : le même banc, un pilote du trajet et de la prise déjà dans l’hôte. Pas d’écran, pas de catalogue.

Fait quand :

- Le second passage ne multiplie pas les 768. Fenêtres : 1920×1080, 3440×1440, 3840×2160.
- Réglages : les quatre préréglages, plus Qualité avec les ombres coupées.
- États : repos, pion en boucle sur e2→e4, pièce tenue qui traverse le plateau. Le trajet est `samplePieceTravelWorld`. La prise reste le ressort cinématique.
- Chaque état enregistre la médiane et, si elle est tracée, `01_Shadows`, en écart contre le repos du même réglage.
- Une pose non finie, couchée ou éjectée est un échec de ligne, pas un temps.
- Le corps dynamique soudé n’est pas réintroduit.

## CHESS-B17e — Rapport

Fichier : [docs/profil-graphismes.md](../profil-graphismes.md).

Fait quand la page porte, pour cette carte, les médianes au repos par taille de fenêtre, l’écart de chaque option prise seule, et l’écart repos / trajet / prise. Les seuils 16,7 ms et 33 ms sont affichés. Un GPU non lancé est nommé comme non mesuré. Les préréglages restent ceux d’avant la campagne.

## Hors de ce sprint

- Modifier Fluide, Équilibré, Qualité, Natif, une passe ou un plafond.
- Décider des optimisations.
- Chronométrer une carte autre que celle qui lance le banc.
