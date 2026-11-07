# Contexte du projet

## Identité

- Produit : **France-Students-code-Roblox**, application Electron en français, avec CLI et TUI sur un cœur Node.js partagé.
- Version de départ de la reprise : **0.1.0**.
- Mainteneur actuel : **GAB DESING**.
- Le projet original est de [EsteG7](https://github.com/EsteG7/francestudents-ide). Conserver les auteurs, crédits et licences d’origine ; cette reprise ne constitue pas une version officielle du projet amont.

## Architecture et invariants

- L’application est centrée sur un espace de programmation unique. Préserver l’agent, l’éditeur, les outils de fichiers et terminal, le Git local, les skills et le client MCP.
- L’historique affiché reste distinct du contexte envoyé au modèle. Ne pas exposer les prompts internes ni effacer les anciens échanges lors d’une compaction ou d’un nouveau chat.
- L’identité dédiée est `com.gabdesing.francestudentscoderoblox`, le nom du paquet `francestudents-code-roblox` et le dossier de données `France-Students-code-Roblox` (CLI : `~/.francestudents-code-roblox`). Ne jamais partager ni migrer les données de l’ancienne application.
- Maintenir les codes FST dans `docs/error-codes.md` en cohérence avec `desktop/stability.js`. Les diagnostics locaux restent limités aux métadonnées techniques.
- Les questions interactives passent par `ask_user` ; ne pas déduire une question à partir des points d’interrogation dans du texte arbitraire. Passer n’accorde aucune autorisation.
- **Spécialisation Roblox + Blender** : le prompt impose que la géométrie 3D soit créée uniquement dans Blender, avec LOD0 à LOD3, puis uploadée par le plugin Roblox et insérée dans Studio via le MCP. Les skills intégrés `roblox-blender` et `roblox-lod` vivent dans `src/skills/builtin/` (lecture seule, désactivation via `disabledBuiltinSkills`). Les connexions MCP prêtes à l’emploi sont dans `src/mcp/presets.js`. `src/programs.js` détecte et lance Blender et Roblox Studio (réglage, installation, Steam, PATH) et fournit aussi le catalogue `Get-StartApps` pour ouvrir n’importe quelle application (Store, Steam, exécutable choisi) ; les outils `open_program` et `open_app` et la page Extensions les utilisent, avec les chemins manuels dans `programPaths`. Ne pas réintroduire la génération de modèles 3D dans Studio pour contourner ce pipeline.

## Repères de développement

- Pour l’interface, modifier `desktop/renderer/src/*.js`, puis exécuter `npm run build:renderer`. `desktop/renderer/app.js` est généré et versionné ; ne pas le modifier directement.
- Réutiliser les tokens et composants de `desktop/renderer/surfaces.css` et `desktop/renderer/src/46-shared-surfaces.js`. Préserver les identifiants utilisés par les événements, le clavier et les petites fenêtres.
- L’application Electron est distribuée uniquement pour Windows x64. Les noms d’application et d’assets sont définis dans `package.json`.
- Chaque push sur `main` déclenche `.github/workflows/release-win.yml`, qui incrémente le correctif dans `package.json`, crée et pousse le tag `vX.Y.Z`, puis publie une release Windows sur `leo51500/francestudents-code-Roblox` avec un titre identique au tag. La cible NSIS fournit `latest.yml` à `electron-updater`; l’installateur portable ne s’auto-installe pas.
- Conserver les crédits et licences des composants tiers.

## Vérifications

Préférence du mainteneur : réserver les suites automatisées à la préparation d’une publication ou à une demande explicite de test. Pour une modification de renderer, lancer au minimum `npm run build:renderer` et `npm run check:renderer` lorsque la validation est demandée. Utiliser les tests Electron avec un environnement graphique pour les changements d’interface.

Commandes du projet : `npm run lint`, `npm run build:renderer`, `npm run check:renderer`, `npm test` et `npm run test:e2e`. `npm test` isole les préférences et historiques par processus.

Ne pas committer, taguer, pousser ni publier sans demande explicite. Mettre à jour ce contexte lorsqu’une architecture ou une contrainte importante change.
