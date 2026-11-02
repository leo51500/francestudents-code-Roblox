# Contexte du projet

## Identité

- Produit : **francestudents-code-Roblox**, application Electron en français, avec CLI et TUI sur un cœur Node.js partagé.
- Version de départ de la reprise : **0.1.0**.
- Mainteneur actuel : **GAB DESING**.
- Le projet original est de [EsteG7](https://github.com/EsteG7/francestudents-ide). Conserver les auteurs, crédits et licences d’origine ; cette reprise ne constitue pas une version officielle du projet amont.

## Architecture et invariants

- L’application est centrée sur un espace de programmation unique. Préserver l’agent, l’éditeur, les outils de fichiers et terminal, le Git local, les skills et le client MCP.
- L’historique affiché reste distinct du contexte envoyé au modèle. Ne pas exposer les prompts internes ni effacer les anciens échanges lors d’une compaction ou d’un nouveau chat.
- Préserver l’identité de mise à jour (`build.appId`) et le dossier de données historique afin de conserver les profils.
- Maintenir les codes FST dans `docs/error-codes.md` en cohérence avec `desktop/stability.js`. Les diagnostics locaux restent limités aux métadonnées techniques.
- Les questions interactives passent par `ask_user` ; ne pas déduire une question à partir des points d’interrogation dans du texte arbitraire. Passer n’accorde aucune autorisation.

## Repères de développement

- Pour l’interface, modifier `desktop/renderer/src/*.js`, puis exécuter `npm run build:renderer`. `desktop/renderer/app.js` est généré et versionné ; ne pas le modifier directement.
- Réutiliser les tokens et composants de `desktop/renderer/surfaces.css` et `desktop/renderer/src/46-shared-surfaces.js`. Préserver les identifiants utilisés par les événements, le clavier et les petites fenêtres.
- L’application Electron est distribuée uniquement pour Windows x64. Les noms d’application et d’assets sont définis dans `package.json`.
- Conserver les crédits et licences des composants tiers.

## Vérifications

Préférence du mainteneur : réserver les suites automatisées à la préparation d’une publication ou à une demande explicite de test. Pour une modification de renderer, lancer au minimum `npm run build:renderer` et `npm run check:renderer` lorsque la validation est demandée. Utiliser les tests Electron avec un environnement graphique pour les changements d’interface.

Commandes du projet : `npm run lint`, `npm run build:renderer`, `npm run check:renderer`, `npm test` et `npm run test:e2e`. `npm test` isole les préférences et historiques par processus.

Ne pas committer, taguer, pousser ni publier sans demande explicite. Mettre à jour ce contexte lorsqu’une architecture ou une contrainte importante change.
