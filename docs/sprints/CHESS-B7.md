# Sprint CHESS-B7 — Coach IA

Découpage de [docs/coach-ia.md](../coach-ia.md). Le CPU heuristique ne change pas. Aucun coup n’est joué à partir du texte du modèle.

Ordre : B7a, puis B7b, puis B7c. Chaque ticket se termine par `pnpm test` et `pnpm check`.

## CHESS-B7a — Contexte et prompt

Photo de la position et messages envoyés au modèle. Pas de réseau, pas d’Electron, pas de GPU.

Fichiers :

- `src/chess/coach/coachContext.ts`
- `src/chess/coach/coachPrompt.ts`
- export depuis `src/chess/index.ts`
- `src/renderer/host/ChessDemoProject.ts` — historique SAN et émission du bus
- `tests/coachContext.test.ts`
- `tests/coachPrompt.test.ts`

Fait quand :

- La photo contient FEN, trait, échec, mat, pat, matériel (barème du moteur heuristique), au plus 48 SAN, et l’historique.
- L’historique grandit sur un coup humain réussi et sur un coup programmé, et se vide au reset de session, au changement de mode, au reset de partie et au rechargement FEN.
- Le bus `w3dts-chess-coach-context` part quand la position change, pas dans `tickClocks`.
- Le mode learn porte l’ECO, le nom et `quiz`, sans coup attendu.
- Le prompt d’indice en quiz ne contient pas de ligne qui désigne le coup du livre. Le SAN peut rester dans la liste légale.
- Le message système demande la langue de la question, l’anglais par défaut, et interdit de se présenter comme un moteur d’analyse.

## CHESS-B7b — IPC et réglages

Le renderer ne parle pas au modèle. La clé ne revient jamais vers la page.

Fichiers :

- `src/chess/coach/coachClient.ts` — corps HTTP, lecture de la réponse, masquage de la clé
- `src/main/coachIpc.ts` — `userData/coach-settings.json`, `fetch`, annulation
- `src/main/index.ts` — enregistrement des canaux
- `src/preload/index.ts` et `src/renderer/chessMaster.d.ts` — `coachSettings`, `coachSaveSettings`, `coachListModels`, `coachChat`
- `tests/coachClient.test.ts`

Fait quand :

- Local par défaut : `http://127.0.0.1:11434/v1`, sans clé. Distant : URL, modèle et clé saisis par l’utilisateur.
- `coachSettings` renvoie le fournisseur, l’URL, le modèle et `hasKey`.
- `GET {baseUrl}/v1/models` alimente la liste. `POST {baseUrl}/v1/chat/completions` envoie un seul échange.
- Timeout 60 s. L’annulation coupe la requête en cours.
- Les tests du client passent avec un `fetch` simulé, sans processus Electron.

## CHESS-B7c — Panneau HUD

Fichiers :

- `src/renderer/ui/ChessCoachPanel.tsx`
- `src/renderer/ui/ChessGameplayHud.tsx` — montage à côté du menu graphique
- styles dans `src/renderer/chess-hud.css`, même verre que le HUD

Fait quand :

- Le panneau offre les réglages (local ou distant, URL, modèle, clé, liste des modèles) et trois actions : Expliquer, Indice, question libre.
- L’attente est locale au panneau. `coachBusy` n’est pas réutilisé.
- Un bandeau rappelle que le texte est un commentaire, pas une évaluation moteur.
- La clé saisie part vers le main et n’est pas réaffichée : seul l’état « clé enregistrée » revient.

## Hors de ce sprint

- Stockfish, ou un LLM branché sur `IChessEngine`.
- Streaming SSE.
- Fil de discussion de plus d’un échange.
