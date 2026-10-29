# Contribuer

Ce dépôt est le fork de [leo51500](https://github.com/leo51500/francestudents-code-Roblox) du projet de [Gab-Desing](https://github.com/Gab-Desing/francestudents-code-Roblox). Conserve les crédits des contributeurs d’origine et distingue les nouveautés des fonctions précédentes.

## Reprendre le projet avec une IA

Le point d’entrée commun est [AGENTS.md](AGENTS.md). Le [contexte de reprise](docs/AI_CONTEXT.md) décrit l’architecture, les invariants et l’état de validation. Il peut être donné à n’importe quel modèle sous forme de texte ou de fichiers du dépôt. Les fichiers `CLAUDE.md`, `GEMINI.md` et `.github/copilot-instructions.md` renvoient aux mêmes sources ; ne pas y maintenir des copies divergentes.

## En local

Avec Node.js 22.13.0 ou plus récent, npm et Git :

```powershell
npm install
npm run desktop
```

Avant une pull request, exécute les vérifications adaptées :

```powershell
npm run lint
npm run build:renderer
npm run check:renderer
npm test
npm run test:e2e
```

Les tests Electron nécessitent un environnement graphique. `npm test` isole les préférences et historiques dans des dossiers temporaires par processus. Pour un test unitaire ciblé, utiliser `node --require ./test/helpers/isolate-env.cjs --test test/nom.test.js`.

Ne versionne jamais de jeton, mot de passe, session ou fichier `.env`. Les dépendances, `dist/`, les fichiers vendor et les exécutables `release/` restent hors du code versionné. **Exception : `desktop/renderer/app.js` est un bundle généré et versionné** ; modifier `desktop/renderer/src/*.js`, puis le reconstruire avec `npm run build:renderer`.

La construction de l’application vérifie aussi le paquet EffectCraft modifié. Avant un premier `build:desktop` ou `dist:win`, lance `npm run vendor:effectcraft` avec les [prérequis Rust et WASM](docs/avance.md#motion-design-avec-effectcraft--bêta). Les workflows reconstruisent et mettent en cache ce paquet depuis la révision et le correctif épinglés ; ils ne substituent pas l’interface officielle non adaptée.

## Proposer une amélioration

Ouvre une pull request dans ce fork. Décris le problème, le comportement obtenu et les vérifications réalisées. Pour un bogue, indique la version, le système et les étapes de reproduction, sans identifiants ni données sensibles.

## Préparer une release

1. Mettre à jour `package.json`, `package-lock.json` (racine et `packages[""]`), le changelog et le résumé dans `desktop/release-highlights.js`. **Chaque modification livrée reçoit une nouvelle version de correctif** et sa propre release : ne pas réutiliser un tag public.
2. Vérifier le diff, le code, construire et contrôler l’application.
3. Pousser le commit sur `main`. Le workflow **Publication automatique** crée `v<version>` puis lance le build Windows. Il ne modifie jamais une release existante.
4. Dans GitHub → **Actions** → **Publication automatique**, vérifier que l’exécution a démarré et réussi. Si le push n’a pas déclenché le workflow, utiliser **Run workflow** sur `main` ; laisser le champ `version` vide afin de prendre celle de `package.json`.
5. Vérifier que la release contient l’installateur, son `.blockmap`, `latest.yml` et `SHA256SUMS.txt`. Les portables restent locaux.

Le logo vient de `desktop/renderer/assets/francestudent-logo.svg`. Après l’avoir modifié, lancer `node scripts/make-logo.js` : il régénère `desktop/icon.png` et `desktop/renderer/assets/francestudent-logo.png`.

Les exécutables vont dans GitHub Releases, jamais dans Git. Les notes de version rappellent que le projet est maintenu par leo51500.

Le nom du produit est FranceStudent IDE. Les noms de fichiers à joindre viennent de `package.json` (`build.nsis.artifactName`) ; ne pas recopier un ancien nom FranceStudentCode depuis une release historique. Conserver l’`appId` et le dossier de données historique pour que le renommage ne perde pas les profils.

Construction locale Windows utilisée pour la validation :

```powershell
npm run build:renderer
npm run check:effectcraft
npx electron-builder --win nsis --publish never --config.npmRebuild=false
```

Cette option conserve les binaires précompilés de `node-pty` au lieu d’exiger les bibliothèques Spectre des outils Visual Studio. Vérifier le terminal dans l’application empaquetée. En cas de verrou Windows/OneDrive, choisir un dossier de sortie distinct avec `--config.directories.output=...`.

Le workflow **Publication automatique** (`.github/workflows/auto-release.yml`) se déclenche sur push vers `main` (y compris les commits ne contenant que de la documentation) et peut être lancé manuellement depuis la branche `main`. En lancement manuel, laisser `version` vide : le workflow utilise celle de `package.json` et refuse toute divergence. Il crée la fiche `v<version>` puis appelle **Publier les exécutables Windows** (`release-win.yml`) via `workflow_call` : ce workflow doit donc conserver un déclencheur `workflow_call` avec l’entrée `tag`, sans quoi GitHub rejette le fichier avec « workflow is not reusable as it is missing a `on.workflow_call` trigger ». Une release existante n’est jamais modifiée. Vérifier dans l’onglet **Actions** qu’un run a bien démarré, puis consulter son journal en cas d’échec. Le workflow Windows vérifie que le tag correspond au `package.json` du tag, construit uniquement l’installateur, calcule les empreintes et joint les quatre fichiers prévus. Si tous les assets sont déjà présents, il les conserve. Les workflows et le droit d’écriture du `GITHUB_TOKEN` doivent être activés dans les réglages du fork.

Si aucune release n’apparaît après un push sur `main`, vérifier dans cet ordre :

1. Dans **Actions**, vérifier que le workflow **Publication automatique** est activé et que le run existe. Si aucun run n’existe, le push n’a pas déclenché Actions : vérifier que le commit est bien sur `main`, que le workflow est présent sur cette branche et que les Actions ne sont pas désactivées dans les réglages du dépôt.
2. Si le run échoue, ouvrir son journal et lire l’étape en rouge. Vérifier `Settings → Actions → General → Workflow permissions` : le `GITHUB_TOKEN` doit pouvoir écrire le contenu/releases. Un tag existant sans fiche ou une version incohérente est également signalé explicitement.
3. L’automatisation ne crée rien si la version est inchangée et sa release existe déjà. Modifier `package.json` **et les deux versions dans `package-lock.json`**, le changelog et le résumé, puis pousser sur `main`. Pour relancer manuellement depuis `main`, laisser le champ `version` vide.

Les notes de release sont générées par `node scripts/release-body.js <version>` ; un résumé absent n’empêche plus la création de la fiche.

Le tag doit correspondre à la version exacte du paquet. Après publication explicite, attendre que le workflow réussisse et que les quatre fichiers soient présents. Un simple push du code, un brouillon ou un tag sans release publiée ne déclenche pas cette publication Windows. Vérifier que les Actions sont activées dans le fork ; leur présence dans le dépôt ne suffit pas.

Pour une publication manuelle avec `gh`, préciser `-R leo51500/francestudents-code-Roblox`, calculer `SHA256SUMS.txt`, puis joindre uniquement les quatre assets prévus. Ne jamais déplacer un tag déjà public pour y ajouter des modifications. Une demande de contribution ou de test ne demande pas implicitement un push ou une release.

Les versions portables restent exclusivement locales et ne doivent jamais accompagner une nouvelle release GitHub.

## Validation Windows

Le workflow `security-validation.yml` peut être lancé manuellement lors de la préparation d’une publication. Il prépare Electron avant les tests parallèles, construit EffectCraft avant les parcours Windows et vérifie les applications empaquetées. Publier les artefacts du commit validé ; une modification du code embarqué exige une nouvelle construction.

Une release contient quatre fichiers : l’installateur Windows, son `.blockmap`, `latest.yml` et `SHA256SUMS.txt`. `latest.yml` concerne la mise à jour automatique Windows. Calculer les empreintes de tous les fichiers distribués et vérifier les tailles et SHA-256 après téléversement avant de publier le brouillon.
