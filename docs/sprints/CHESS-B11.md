# Sprint CHESS-B11 — Langues du shell

Découpage de [docs/i18n.md](../i18n.md). La maquette [docs/mockup](../mockup/index.html) ne change pas. Le plateau 3D, le grab, les règles et les identifiants graphiques non plus.

Ordre : B11a, puis B11b, puis B11c, puis B11d. Chaque ticket commence par un test qui échoue. Il se termine par `pnpm test` et `pnpm check`.

## CHESS-B11a — Codes persistés

[`ShellPrefs.language`](../../src/renderer/shell/shellScreen.ts) accepte les huit codes. Le défaut reste le français.

Fichiers :

- `src/renderer/shell/shellScreen.ts`
- `tests/shellScreen.test.ts`

Fait quand :

- `parseShellPrefs` conserve `de`, `it`, `es`, `ru`, `zh` et `ja`.
- Une langue inconnue, ou un JSON illisible, reste `fr`.
- `defaultShellPrefs().language` reste `fr`.

## CHESS-B11b — Catalogue

Le français sort de `ChessShell.tsx`. Les sept autres langues satisfont le même type. `shellCopy` replie une langue inconnue sur le français.

Fichiers :

- `src/renderer/shell/copy/fr.ts`
- `src/renderer/shell/copy/en.ts`
- `src/renderer/shell/copy/de.ts`
- `src/renderer/shell/copy/it.ts`
- `src/renderer/shell/copy/es.ts`
- `src/renderer/shell/copy/ru.ts`
- `src/renderer/shell/copy/zh.ts`
- `src/renderer/shell/copy/ja.ts`
- `src/renderer/shell/copy/shellCopy.ts`
- `tests/shellCopy.test.ts`

Fait quand :

- Chaque catalogue a les mêmes clés que le français, sans chaîne vide.
- Les listes d’exemple ont la même longueur que celles du français.
- `shellCopy('de').play`, un nom d’ouverture et un statut P2P ne recopient pas le français.
- `shellCopy` d’une langue inconnue renvoie le français.
- Les ouvertures portent le nom d’échecs usuel de la langue. `zh` est le simplifié.
- Le ton reste court, sans vouvoiement ajouté.

## CHESS-B11c — Branchement

Le shell, les cartes, les ouvertures, le P2P, les préréglages et le HUD lisent le catalogue. Les identifiants stockés ne bougent pas.

Fichiers :

- `src/renderer/shell/ChessShell.tsx`
- `src/renderer/ui/ChessGameplayHud.tsx`
- `src/renderer/shell/shellScreen.ts` — la préférence déjà lue par le HUD, clé `w3dts-chess-shell`

Fait quand :

- `ChessShell` n’embarque plus `FR` ni `EN`.
- Le sélecteur montre les huit endonymes : Français, English, Deutsch, Italiano, Español, Русский, 中文, 日本語.
- Modes, ligne ECO, statut P2P, préréglages (`fluide`, `equilibre`, `qualite`, `natif`), textures (`low`, `medium`, `high`), « Natif » et le libellé Échap suivent la langue.
- `1080p`, `1440p` et `4K` restent inchangés.
- « Ligne » du HUD d’apprentissage suit la même préférence, y compris quand Paramètres change la langue pendant une ligne.

## CHESS-B11d — Règle

Une clé visible nouvelle entre dans les huit catalogues en même temps.

Fichier : `.cursor/rules/i18n.mdc`.

Fait quand la règle dit que le français est la source, que `zh` est le simplifié, qu’aucune librairie i18n n’est ajoutée, et qu’une clé manquante dans une langue est un oubli du même changement.

## Hors de ce sprint

- Traduire [`ChessModePicker.tsx`](../../src/renderer/ui/ChessModePicker.tsx) ou [`ChessGraphicsMenu.tsx`](../../src/renderer/ui/ChessGraphicsMenu.tsx).
- Traduire la maquette, les règles, les commentaires ou la documentation.
- Changer le prompt du coach.
- Renommer un identifiant de [`chessGraphicsSettings.ts`](../../src/renderer/graphics/chessGraphicsSettings.ts).
- Ajouter une librairie i18n, une police web, ou le chinois traditionnel.
