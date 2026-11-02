# Contribuer

Ce dépôt adapte le [projet de EsteG7](https://github.com/EsteG7/francestudents-ide). Conserve les auteurs, crédits et licences d’origine et distingue les modifications de ce fork.

## Contexte commun

Commence par [AGENTS.md](AGENTS.md), puis consulte le [contexte du projet](docs/AI_CONTEXT.md). Ces fichiers sont les références communes des assistants ; évite d’y copier des historiques de conversation.

## En local

Avec Node.js 22.13.0 ou plus récent, npm et Git :

```powershell
npm install
npm run desktop
```

Les contrôles disponibles :

```powershell
npm run lint
npm run build:renderer
npm run check:renderer
npm test
npm run test:e2e
```

Les tests Electron nécessitent un environnement graphique. `npm test` isole les préférences et historiques dans des dossiers temporaires par processus. Pour un test unitaire ciblé : `node --require ./test/helpers/isolate-env.cjs --test test/nom.test.js`.

Ne versionne jamais de token, mot de passe, session ou fichier `.env`. Les dépendances, `dist/`, les fichiers vendor et les exécutables `release/` restent hors du code versionné. **Exception : `desktop/renderer/app.js` est un bundle généré et versionné** ; modifie `desktop/renderer/src/*.js`, puis reconstruis-le avec `npm run build:renderer`.

## Proposer une amélioration

Décris le problème, le comportement attendu et les vérifications réalisées. Pour un bogue, indique la version et les étapes de reproduction, sans identifiants ni données sensibles. Vérifie le remote avant toute opération distante et ne pousse ou ne publie rien sans demande explicite.

## Construire localement

Le produit et les noms d’assets sont définis dans `package.json`. Conserve l’`appId`, le nom interne du paquet et le dossier de données historique afin de préserver les profils.

```powershell
npm run build:renderer
npx electron-builder --win nsis --publish never --config.npmRebuild=false
```

Cette option conserve les binaires précompilés de `node-pty`. Vérifie le terminal dans l’application empaquetée. En cas de verrou Windows/OneDrive, choisis un dossier de sortie distinct avec `--config.directories.output=...`.

Sans certificat Windows, des avertissements de signature peuvent apparaître.
