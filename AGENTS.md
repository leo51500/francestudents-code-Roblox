# francestudents-code-Roblox — point d’entrée pour les assistants IA

Ce fichier s’adresse à toute personne ou tout assistant qui reprend le dépôt, quel que soit son modèle. Il décrit le projet ; il ne contient pas de secret ni d’historique privé. Les demandes explicites du contributeur restent prioritaires.

## Pour reprendre

1. Lire [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md) et [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md).
2. Vérifier le dossier courant, `git status --short`, les remotes et la version de `package.json`. Ne pas supposer que l’arbre est propre ou que la version locale est publiée.
3. Lire le code et les tests de la zone concernée avant de modifier. Préserver les changements déjà présents ; ne pas inclure des captures ou fichiers personnels dans un commit.
4. Réaliser la demande, vérifier le résultat et indiquer précisément les tests exécutés et les limites restantes.

## Repères essentiels

- **Produit** : France-Students-code-Roblox, application Electron en français ; CLI et TUI partagent son cœur Node.js.
- **Origine** : projet de EsteG7 ; ce dépôt est le fork d’amélioration de extraopaa. Conserver les crédits et licences des composants tiers.
- **Dépôt de ce fork** : `leo51500/francestudents-code-Roblox`. Vérifier les remotes avant toute opération distante. Ne pas pousser dans l’amont par inadvertance.
- **Interface** : modifier `desktop/renderer/src/*.js`, puis exécuter `npm run build:renderer`. `desktop/renderer/app.js` est généré **et versionné** ; ne pas l’éditer directement. Les modules sont concaténés par numéro et partagent une portée globale.
- **Style** : réutiliser les tokens et composants existants, en particulier `desktop/renderer/surfaces.css` et `desktop/renderer/src/46-shared-surfaces.js`. Conserver les identifiants des contrôles et l’accessibilité clavier ; vérifier aussi les petites fenêtres.
- **Périmètre produit** : l’application conserve l’agent de programmation, l’éditeur, les fichiers, le terminal, le Git local, les skills et MCP. Ne pas réintroduire les intégrations retirées sans demande explicite.
- **Spécialisation Roblox + Blender** : le routage vers Blender est automatique même sans le mot « Blender » ; la géométrie 3D se crée uniquement dans Blender (jamais via les outils de génération de Studio), avec textures procédurales ou bakées, et les LOD0 à LOD3 sont obligatoires, puis l’upload passe par le plugin Roblox et l’insertion par le MCP Studio. L’agent doit prendre et examiner une capture (`look`, `screen_capture`) après chaque étape visuelle. Les interfaces de jeu se construisent en GUI natives au style cartoon Roblox (`roblox-ui`), jamais comme un site web. Les sons (épée, impacts, ambiances) sont cherchés, licenciés et préparés par l’agent (`roblox-audio`) ; l’upload audio Roblox reste une étape manuelle avant le câblage des `Sound`. Skills intégrés dans `src/skills/builtin/`, presets MCP dans `src/mcp/presets.js`, détection et lancement des applications dans `src/programs.js` (outils `open_program` pour Blender/Studio et `open_app` pour toute application), guide dans `docs/roblox-blender.md`.
- **Historique** : le journal visible est distinct du contexte envoyé au modèle. Ne pas afficher les prompts internes ni supprimer les anciens échanges lors d’une compaction ou d’un nouveau chat.
- **Données** : l’application utilise `com.gabdesing.francestudentscoderoblox` et son propre dossier de profil `France-Students-code-Roblox`. Ne jamais relire, migrer ni supprimer les données de l’ancienne application.
- **Stabilité** : maintenir le [répertoire des codes FST](docs/error-codes.md) avec le catalogue de `desktop/stability.js`. Ne pas inventer de cause quand seul un arrêt anormal est connu. Le diagnostic local reste limité aux métadonnées techniques, sans contenu de conversation, secret, trace complète ni envoi automatique.
- **Plateforme** : l’application est distribuée uniquement pour Windows x64.
- **Questions de l’agent** : `ask_user` déclenche le QCM ou le champ libre pendant une tâche ; ne pas détecter les questions à partir des points d’interrogation dans du texte arbitraire. Full accès n’auto-répond pas et Passer ne donne aucune autorisation. Conserver l’historique des questions et réponses.

## Vérifications courantes

**Préférence du contributeur : réserver les tests automatisés à la préparation d’une publication, ou à une demande explicite de test.** Pendant le développement, ne pas relancer les suites après chaque modification. Préparer le code et documenter ce qui reste à vérifier ; avant publication, effectuer les contrôles adaptés et les parcours nécessaires. Cette règle remplace toute recommandation de test immédiat ci-dessous.

```sh
npm run lint
npm run build:renderer
npm run check:renderer
npm test
```

Pour une modification de l’interface, utiliser les tests Electron pertinents avec un environnement graphique et contrôler le rendu. La suite complète peut se lancer avec :

```sh
node --test --test-concurrency=4 e2e/*.e2e.test.js
```

`npm test` isole les réglages et historiques par processus. Un `node --test` lancé directement sans le préchargement d’isolation peut lire les préférences personnelles et produire des résultats trompeurs. Ne pas désactiver un garde-fou pour faire passer un test ; chercher d’abord la cause.

## Commits et publication

- Ne jamais versionner de session, jeton, `.env`, historique personnel, dépendance ou exécutable.
- Avant un commit, vérifier le diff et les fichiers sélectionnés ; éviter un ajout global quand des fichiers étrangers sont présents.
- Ne pousser, taguer ou publier que dans le cadre d’une demande explicite du contributeur. Une demande de test ou de modification n’est pas une demande de release.
- Pour une version, mettre à jour `CHANGELOG.md` et le résumé de `desktop/release-highlights.js` ; le workflow incrémente `package.json` si nécessaire et reprend les notes correspondantes pour la release. Consulter la procédure de [CONTRIBUTING.md](CONTRIBUTING.md).
- Les noms d’assets viennent de `package.json`, pas d’un ancien exemple. Chaque push sur `main` déclenche la publication Windows avec un tag `vX.Y.Z` ; une version sans tag est publiée telle quelle, sinon le correctif est incrémenté. Les portables restent locaux et les releases NSIS contiennent les métadonnées nécessaires aux mises à jour.

## Maintenir ce contexte

Mettre à jour le guide lié lorsqu’une architecture, une commande ou une contrainte importante change. Écrire le résultat actuel et les limites vérifiées, pas une retranscription de conversation. Le code, `package.json`, les tests et les workflows restent les sources de vérité.
