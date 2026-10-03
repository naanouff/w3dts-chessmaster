# Version

Une seule version : le champ `version` de [`package.json`](../package.json). Elle vaut aujourd’hui `0.1.0`. Electron l’affiche avec `app.getVersion()`. L’installateur NSIS porte le même numéro dans son nom de fichier. Pas de second fichier, et pas d’outil qui publie depuis `main` : cela court-circuiterait les branches `release/*`.

La première livraison est `0.1.0`, sur la branche `release/0.1.0`, avec la note [docs/releases/0.1.0.md](releases/0.1.0.md). Le tag `v0.1.0` se pose après le merge dans `main`. `develop` reste.

## Numéro

Forme stricte `MAJOR.MINOR.PATCH`. Pas de suffixe : `0.1.0`, pas `0.1.0-dev`.

Tant que le majeur est `0`, un correctif augmente le patch, une fonction le mineur, un changement incompatible aussi le mineur. À partir de `1.0.0`, un changement incompatible augmente le majeur.

## Release

`release/X.Y.Z` part de `develop`. Avant la pull request vers `main`, `package.json` vaut exactement `X.Y.Z`.

Le même commit ajoute `docs/releases/X.Y.Z.md`. C’est la note montrée dans À propos, en français, écrite pour cette version. Elle n’est pas produite depuis l’historique git. La CI refuse la branche si ce fichier manque ou s’il est vide.

Après le merge dans `main`, un tag annoté `vX.Y.Z` est posé sur ce commit. La CI ne pousse pas ce tag. Le merge revient dans `develop`, puis un commit y prépare la version suivante, pour que `develop` ne reste pas sur le numéro déjà livré.

Un push sur `main` ou `release/*` construit l’exe. L’artefact s’appelle `w3dts-chessmaster-X.Y.Z`.

## À propos

L’écran est validé dans [la maquette](mockup/index.html) et repris par la coque. Lien « À propos » sur l’accueil, à côté de Classements, Options et Paramètres. Fermer ou Échap revient à l’écran précédent.

Dans cet ordre : la version de `package.json` via `app.getVersion()`, la note `docs/releases/X.Y.Z.md` de cette même version, puis les crédits « ChessMaster & W3DTS copyright Cyril TARRIET » et le rappel que le logiciel est propriétaire ([LICENSE](../LICENSE)). Tant que la branche `release/X.Y.Z` n’a pas créé la note, l’écran le dit. La ligne de version de [`src/renderer/main.tsx`](../src/renderer/main.tsx) n’existe plus.

Sprint : [CHESS-B13](sprints/CHESS-B13.md).
