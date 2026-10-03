# Sprint CHESS-B13 — Semver et À propos

Découpage de [docs/semver.md](../semver.md). Ce sprint ne coupe pas de release, ne tague pas `main`, et ne branche pas l’écran dans le client.

Ordre : B13a, puis B13b, puis B13c, puis B13d. B13a commence par un test qui échoue. B13a et B13b se terminent par `pnpm test` et `pnpm check`.

## CHESS-B13a — Politique de version

Fichiers : `scripts/semverPolicy.mjs`, `tests/semverPolicy.test.ts`.

Fait quand :

- `0.1.0` est accepté, `0.1.0-dev` et `1.2` sont refusés.
- `release/0.2.0` exige que `package.json` vaille `0.2.0`.
- La même branche avec `0.1.0` est refusée.
- `docs/releases/0.2.0.md` est exigé seulement sur `release/0.2.0`, et un fichier vide est refusé.
- `develop`, `main` et `feature/…` ne demandent pas de note.

## CHESS-B13b — Contrôle CI et artefact

Fichiers : `.github/workflows/ci.yml`.

Fait quand le job `test` lance la politique avec `github.head_ref` sur une pull request, sinon `github.ref_name`, et que l’artefact Windows s’appelle `w3dts-chessmaster-X.Y.Z` d’après `package.json`.

## CHESS-B13c — Règle d’agent

Fichier : `.cursor/rules/semver.mdc`, toujours appliquée.

Fait quand la règle dit où vit la version, quand la bumper, que `docs/releases/X.Y.Z.md` fait partie du commit de release, et que la CI ne tague pas.

## CHESS-B13d — Maquette À propos

Fichiers : `docs/mockup/index.html`, `docs/mockup/mockup.css`, `docs/mockup/mockup.js`, `docs/maquette-ui.md`, `docs/shell-client.md`.

Fait quand :

- L’accueil a un lien « À propos » à côté de Classements, Options et Paramètres.
- La feuille montre, dans cet ordre, la version d’exemple `0.1.0`, une note d’exemple, puis « ChessMaster & W3DTS copyright Cyril TARRIET » et le rappel de licence propriétaire.
- Fermer ou Échap revient à l’écran précédent.
- `docs/maquette-ui.md` décrit l’écran et le lien depuis l’accueil.
- `docs/shell-client.md` dit que le client attend cette maquette, puis lira `docs/releases/X.Y.Z.md` et `app.getVersion()`.
- Aucun fichier `docs/releases/` n’est ajouté.

## Hors de ce sprint

- L’écran React dans `src/renderer/shell`, et le retrait de la ligne de version dans `src/renderer/main.tsx`.
- La branche `release/0.1.0`, le tag `v0.1.0`, et le bump de `develop` après livraison.
