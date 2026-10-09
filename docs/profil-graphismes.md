# Profil graphique

Mesure du coût des réglages, sur la machine qui lance le banc. Ce passage ne change pas les préréglages, les passes, ni les plafonds de [`chessGraphicsSettings.ts`](../src/renderer/graphics/chessGraphicsSettings.ts). Les optimisations se décident après les chiffres.

La machine de cette campagne est une NVIDIA GeForce RTX 3070 Ti, écran 3440×1440. Un autre GPU n’est pas chronométré ici. Le même banc se relance sur un autre poste Windows.

Sprint : [CHESS-B17](sprints/CHESS-B17.md).

## Combinaisons

Les options sont indépendantes : résolution `1080`, `1440`, `2160` ou `native` ; upscale sans, qualité ou performance ; textures sujet 256, 512 ou 1024 (les props de scène suivent une densité au huitième) ; ombres, occlusion, reflets, bloom, anticrénelage, silhouette. Cela fait 2304 combinaisons. Fluide, Équilibré, Qualité et Natif en sont quatre. Fluide garde les ombres, l’anticrénelage et la silhouette du coach, et coupe l’occlusion, les reflets, le bloom, le volume et la profondeur de champ. Qualité et Natif les gardent, comme la revue. Une sauvegarde antérieure s’ouvre sur Qualité. Le banc ne multiplie pas la matrice par le mode d’ombre. L’ombre visée, une couche ajustée au plateau et un filtre par palier, est dans [Ombres](ombres.md).

`gameSurfacePixels` ne grossit jamais l’image : il donne la taille du canvas. Sous le plafond, `1440`, `2160` et `native` ont le même canvas que `1080`. Sur ce 3440×1440, Qualité et Natif ont le même canvas. L’upscale divise les cibles internes sous ce canvas, qui garde sa taille ; c’est [Upscale](upscale.md). Deux combinaisons de même surface, même échelle, mêmes passes et mêmes textures ne se chronomètrent qu’une fois ; les lignes du rapport reprennent cette mesure.

## Fenêtres

Même carte, cinq tailles. Cela donne le coût en pixels d’un portable ou d’un bureau. Cela ne donne pas le débit d’un circuit intégré.

- 1366×768 et 1920×1080 : les quatre résolutions se confondent.
- 2560×1440 : `1080` est plafonné, le reste est plein.
- 3440×1440 : cet écran. `1080`, puis `1440`, puis `2160` identique à `native`.
- 3840×2160 : fenêtre plus grande que l’écran. Seul cas où le plafond 4K travaille.

## Repos

Les 2304 combinaisons se chronomètrent au repos. Position de départ, HDR studio, caméra orbitale au cadrage initial, aucune pièce en vol, aucune prise. MSAA est à 1. Une couche d’ombre ajustée au plateau. La silhouette compte ses deux passes plein écran, même sans marque du coach.

Le HUD lit `getFPS()`, plafonné par la synchro verticale. `--disable-frame-rate-limit` invalide le tampon de commandes GPU : il n’est pas passé. Le banc garde `--disable-gpu-vsync` et chronomètre chaque image moteur jusqu’à la fin de la file GPU. Ce temps n’inclut pas l’attente de l’écran. Fluide et Qualité doivent différer avant la campagne. Sinon la mesure est plafonnée et la campagne s’arrête.

Chaque clé attend environ 45 images, puis la médiane sur environ 90. Les seuils affichés, pas codés, sont 16,7 ms (60 img/s) et 33 ms (30 img/s).

## Déplacement

Le déplacement n’est pas un corps dynamique. La prise ([`MouseGrabController`](../src/chess/grab/MouseGrabController.ts)) suit le curseur par un ressort et écrit la pose. Elle n’ajoute pas de liaison. Le corps reste cinématique. Le trajet d’une case à l’autre ([`samplePieceTravelWorld`](../src/chess/board/pieceTravel.ts)) écrit la pose. Le solveur n’intègre pas ce trajet.

`createPhysicsSystem` tourne à chaque image. Les pièces au repos sont cinématiques et endormies. Une soudure dynamique éjectait les pièces : ce chemin reste fermé.

Un plateau immobile sous-estime les ombres : la carte se redessine quand un caster bouge. Après la matrice au repos, un second passage, sans multiplier la matrice. Trois fenêtres : 1920×1080, 3440×1440, 3840×2160. Réglages : les quatre préréglages, plus Qualité sans ombres. Trois états : repos, pion en boucle sur e2→e4, pièce tenue qui traverse le plateau.

Chaque état donne la médiane et, si la passe est tracée, le temps de `01_Shadows`. L’écart se lit contre le repos du même réglage. Une pose qui part (valeur non finie, pièce couchée, éjection) est un échec de mesure. Le solveur n’a pas de trace nommée : son coût CPU est cet écart de temps d’image. S’il est noyé dans le bruit, le rapport le dit.

## Banc

Mode dev seulement. `CHESS_GRAPHICS_BENCH=1` ouvre `?bench=graphics` dans une fenêtre de taille imposée, sans mémoriser les bounds. Le profil Electron du banc est `tmp/bench-userdata`, séparé du profil du joueur, pour ne pas partager le cache GPU ni les réglages enregistrés. Pas d’écran nouveau, pas de chaîne visible. `pnpm bench:graphics` enchaîne la matrice au repos puis le mouvement. `pnpm bench:graphics:presets` ne chronomètre que Fluide, Équilibré, Qualité et Natif (relevé alpha). Sortie : `tmp/graphics-bench.json`, hors git.

## Relevé

Le passage qui quitte avec `GPU state invalid after WaitForGetOffsetInRange` vient de `--disable-frame-rate-limit`. Ce drapeau n’est plus passé. Le temps d’image du banc est celui de la file GPU, pas les 10,0 ms de l’écran.

Campagne [CHESS-B24](sprints/CHESS-B24.md) h : médianes des quatre préréglages via `pnpm bench:graphics:presets` (pas la matrice 2304). Fermer `pnpm dev` avant (port 5173). Source `tmp/graphics-bench.json`. Valeurs en ms (médiane file GPU).

### Passe GPU intégré (Économie d’énergie)

| Fenêtre | Fluide | Équilibré | Qualité | Natif |
| --- | ---: | ---: | ---: | ---: |
| 1920×1080 | — | — | — | — |

GPU : **absent** sur la machine de campagne (PnP Display : Meta Virtual Monitor + NVIDIA GeForce RTX 3070 Ti uniquement). Date : 2026-10-09. Seuil alpha Fluide ≥ 30 img/s (≤ 33 ms) à 1080p : **non mesurable ici**. Arbitrage : ouverture alpha sur la passe RTX ci-dessous (Fluide ≪ 33 ms).

### Passe RTX (Performances élevées)

| Fenêtre | Fluide | Équilibré | Qualité | Natif |
| --- | ---: | ---: | ---: | ---: |
| 1920×1080 | 7,3 | 7,9 | 6,7 | 6,7 |
| 3440×1440 | 7,8 | 8,9 | 9,4 | 9,4 |

GPU : NVIDIA GeForce RTX 3070 Ti. Date : 2026-10-09. Fenêtres demandées 1920×1080 et 3440×1440 ; la seconde s’est ouverte en 3424×1353 (chrome / DPI). `scope: presets`. Natif partage la clé de coût de Qualité sur ces tailles (`measured: false`).

## Hors de cette mesure

- Changer un préréglage, une passe ou un plafond.
- Choisir une autre optimisation que le filtre d’ombre par palier et l’upscale spatial. Ils sont dans [Ombres](ombres.md) et [Upscale](upscale.md). Le reste attend le rapport.
- Chronométrer un GPU autre que celui qui lance le banc.
