# Contexte de reprise — développeurs et assistants IA

## Dernière version

La version **1.5.22** corrige les séparateurs de mise en page (zone de préhension élargie, glisser sans transition ni barre de défilement parasite) et l’affichage de l’historique rechargé sans animation. La version **1.5.21** aligne la publication Windows sur la CI et les versions du verrou ; la **1.5.20** apporte le zoom global, le panneau Logs et les animations de réflexion. La version **1.5.19** rend l’extension Roblox Studio réellement pilotable par MCP (métadonnées `_meta`, jeton et `studio_id` fournis par l’application, `datamodel_type` sur toutes les opérations), reconstruit la demande quand un fil reste refusé (409) et explique les outils Aftman installés mais pas encore reconnus. La version **1.5.18** remplace « Cendre » par le thème « Onyx » (aucun bleu, noirs neutres, identité de chat d’IA, fenêtre étroite corrigée). La version **1.5.17** avait appliqué le thème « Cendre », retire le panneau Git de l’interface, ajoute les sous-agents spécialisés (`task` avec `role`), le rappel de la demande et des outils enregistrés dans les suivis, la tolérance des QCM mal formés, des messages GitHub/MCP plus explicites et un `Retry-After` respecté. Elle n’est pas encore publiée.

### Interface : thème « Onyx » et fin du panneau Git

- Tokens dans `styles.css` (base), `theme.css` (thème), `workbench.css` et `controls.css` — les quatre doivent rester identiques : `#08090a` (fond), `#050506` (barres), `#0d0e10` (surfaces), `#1b1d21` (actif). **Aucun bleu** : `--accent`/`--accent-hover` sont le blanc cassé/le blanc, `--link` est `#e6e8ea`, le focus est un anneau `rgba(255,255,255,.6)`. Ne jamais réintroduire `#007acc`, `#0078d4`, `#5b8cff`, `#3979dc` ni un thème `midnight` coloré.
- Identité : compositeur arrondi 18 px, boutons d’action en pastilles, messages assistant hors bulle. Sous 1 100 px, `--right` est borné (`clamp(280px, 34vw, 360px)`) ; sous 900 px, la barre latérale se range.
- `--rail: 168px` remplace la colonne d’icônes de 132 px. La barre de titre fait 34 px ; `titleBarOverlay` de `desktop/main.js` doit rester aligné (`#0a0b0e`, hauteur 34).
- Panneau Git retiré : plus d’onglet Versions, de `Ctrl+Maj+G` ni de `view-git`. `#git-view` reste dans le DOM, masqué, pour ne pas casser une reprise ; `refreshGit` tolère les éléments absents. Push/pull/fetch/commit passent par `gitCommand` (palette `Ctrl+Maj+P`) et le terminal. Le connecteur GitHub porte désormais compte (token), liaison de remote et création de dépôt.
- Vérifié par captures réelles `release/ui-cendre-1440.png`, `release/ui-cendre-1100.png`, `release/ui-cendre-900.png` et par contraste calculé dans l’application (11,56:1 texte principal, 15,81:1 navigation, 10,75:1 onglet actif).

### Travail local en cours — actualisation du quota

Le renderer actualise le quota du compte à chaque cinquième requête modèle, à partir du compteur local `usage.requests`. Cela appelle uniquement l’endpoint de consultation du quota (`api.usage()`), sans générer de requête au modèle. Le rafraîchissement à la fin d’une tâche et le contrôle périodique existant restent actifs. Cette modification est en cours et n’est pas encore publiée.

Ce document est volontairement indépendant d’un fournisseur et d’un modèle. Il se lit comme du Markdown ordinaire. Commencer par [AGENTS.md](../AGENTS.md), puis consulter les sections utiles à la tâche.

## Mission du projet


FranceStudent Code Roblox associe un éditeur Luau, un agent de programmation et un studio motion design EffectCraft à un compte FranceStudent. L’interface est en français, accessible aux débutants, avec des options avancées. Le travail de l’agent doit rester visible et interruptible ; l’interface doit expliquer ses limites sans exposer le protocole technique du modèle.

Le projet original appartient à [Gab-Desing](https://github.com/Gab-Desing/francestudents-code-Roblox), et le fork d’amélioration intermédiaire est `extraopaa/francestudents-ide`. Le fork de publication actuel, seul dépôt distant du dépôt local, est [leo51500/francestudents-code-Roblox](https://github.com/leo51500/francestudents-code-Roblox) : c’est lui qui reçoit les releases, les installateurs et sert de source de mises à jour. Conserver cette distinction, les crédits et les licences tierces.

## État de référence, daté du 28 octobre 2026

- **Version en cours : 1.5.22**, Windows x64 uniquement, quatre assets (installateur, `.blockmap`, `latest.yml`, `SHA256SUMS.txt`). Un push sur `main` crée la release et lance le build Windows (`.github/workflows/auto-release.yml`). Le journal complet des versions se trouve dans `CHANGELOG.md` ; les notes visibles dans l’application sont dans `desktop/release-highlights.js`.
- **Spécialisation Roblox/Blender** : outils `roblox_env`, `roblox_check`, `roblox_scene`, `rojo_serve` (serveur Rojo géré, port réel, Studio connecté dans la barre d’état) et `roblox_playtest` (build + ouverture Studio + logs) ; côté Blender, `detect`, `templates`, `script`, `inspect`, `validate`, `render`, `manifest`, `import_roblox`, `export_blender`. Le serveur Rojo s’arrête avec l’application.
- **Explorateur Roblox et Rojo en direct** : `src/tools/roblox-graph.js` expose `buildStudioTree` (arbre des services depuis `default.project.json`, sans exécution) ; `roblox_scene` avec `tree: true` renvoie la même hiérarchie à l’agent. `desktop/roblox-dashboard.js` fournit aux IPC `robloxDashboard` (statut, start, stop, build, restart) et `wallyAction` (status, install, update) ; seuls les binaires Aftman/PATH connus sont lancés, args fixes. L’interface est dans `desktop/renderer/src/56-roblox-studio.js` (arbre, paquets Wally, panneau Rojo, pastille vert/orange de la barre d’état).
- **Skills auto-installés** : le catalogue de `src/skills/index.js` inclut la bibliothèque embarquée, et `getSkill` installe un skill de la bibliothèque à la volée. `ensureRobloxSkills` précharge les packs selon le contenu du projet (`default.project.json`, `wally.toml`, `.luaurc`, `.luau`, `.blend`) dans `.frst/skills/` ; il est appelé par `src/tools/tools.js#setProject`.
- Nom d’application : **FranceStudent Code Roblox**. C’est une application distincte de FranceStudent IDE : `appId` `fr.francestudent.code.roblox`, produits `FranceStudentCodeRoblox-<version>-…`, données dans `~/.francestudent-code-roblox`. `package.name` (`project-frstcli`) reste inchangé. Les anciens noms restent nécessaires pour désigner une version historique.
- Validation de référence : voir `CHANGELOG.md` et les résultats du workflow du commit concerné. Les API distantes et mutations GitHub sont simulées dans les scénarios automatisés. Le vrai moteur EffectCraft, le terminal PTY et les serveurs locaux ont été exécutés. Roblox Studio réel et l’installation par-dessus l’application principale n’ont pas été validés.

Cet état est un instantané. Vérifier le dépôt et les releases avant de s’appuyer sur ces numéros ; mettre cette section à jour après publication.

## Carte du code

| Zone | Fichiers ou dossiers à lire |
| --- | --- |
| Entrées CLI, TUI, routage | `index.js`, `bin/`, `src/core/`, `src/cli/` |
| Boucle agent et protocole JSON | `src/agent/agent.js`, `src/agent/prompt.js` |
| Sous-agents (`task`) | `src/agent/subagent.js`, rôles dans `src/agent/subagent-roles.js` |
| Questions interactives de l’agent | `src/tools/ask-user.js`, `src/user-questions.js`, `desktop/backend.js`, `desktop/renderer/src/49-agent-questions.js` |
| Client de chat, flux et relances | `src/api/api.js`, `src/api/auth.js`, `src/api/account.js` |
| Contexte et compaction | `src/agent/auto-compact.js`, `src/api/context-limits.js`, `docs/model-context.md` |
| Outils, politique et annulation | `src/tools/registry.js`, `src/tools/command/`, `src/tools/action-control.js` |
| MCP et images de résultats | `src/mcp/manager.js`, `src/mcp/client.js`, `src/mcp/studio-mcp.js`, `src/mcp/tool.js` |
| Images et pièces jointes | `src/api/image-input.js`, `src/api/visual-receipt.js`, `src/api/attachment-batches.js`, `desktop/queue-attachments.js`, `docs/attachments.md` |
| Electron et pont de sécurité | `desktop/main.js`, `desktop/preload.js`, `desktop/backend.js` |
| Stabilité, arrêts inattendus et codes de diagnostic | `desktop/stability.js`, `desktop/renderer/src/48-stability-notice.js`, [répertoire FST](error-codes.md) |
| Interface et identité visuelle | `desktop/renderer/index.html`, `theme.css`, `controls.css`, `surfaces.css`, `workbench.css`, `motion.css` |
| Modules source de l’interface | `desktop/renderer/src/00-*.js` à `99-boot.js` ; assemblage par `scripts/build-renderer.js` |
| Fenêtres secondaires et confirmations | `desktop/renderer/src/46-shared-surfaces.js` |
| Historique visible et reprise | `desktop/conversation-transcript.js`, `src/project/conversations.js`, `desktop/renderer/src/42-conversation-replay.js` |
| Conversations indépendantes code/motion | `desktop/motion-conversations.js`, `desktop/renderer/src/38-motion-studio.js`, `src/motion-workspace.js` |
| EffectCraft et commandes du moteur | `desktop/effectcraft-host.js`, `desktop/effectcraft-control.js`, `src/effectcraft-protocol.js`, `src/tools/effectcraft.js` |
| Skills, marketplace code et motion | `src/skills/`, `desktop/extension-center.js`, `desktop/marketplace.js`, `desktop/motion-marketplace.js` |
| Import de conversations Codex | `desktop/conversation-import.js`, `desktop/renderer/src/28-conversation-import.js`, `docs/conversation-import.md` |
| Connecteur GitHub | `src/github-connector.js`, `desktop/renderer/src/33-github-connector.js`, `docs/github.md` |
| Erreurs API, quota et compte à rebours | `desktop/renderer/src/31-usage.js`, `39-budget-notice.js`, `43-context-notice.js`, `44-api-notices.js` |
| Mise à jour et nouveautés | `desktop/updates.js`, `desktop/startup-updates.js`, `desktop/release-highlights.js`, `desktop/renderer/src/45-release-highlights.js` |
| Tests | `test/*.test.js`, `test/helpers/isolate-env.cjs`, `e2e/*.e2e.test.js` |

Les noms de fichiers servent de repères, pas de liste exhaustive. Utiliser la recherche dans le code pour retrouver les appels réels et consulter aussi [l’architecture](architecture.md).

## Invariants à préserver

### Interface et séparation des espaces

Le chat code et le chat motion ont leurs propres échanges. EffectCraft est le vrai moteur Rust/WASM embarqué, hébergé localement dans une iframe isolée. Le chat motion ne doit jamais explorer automatiquement le projet ouvert dans le code, même en Full accès. Ses rendus et skills de projet utilisent un espace distinct.

Le marketplace code conserve SkillsMP. La sélection motion distingue les skills natifs EffectCraft et les skills Remotion destinés aux projets de code : les seconds ne pilotent pas directement EffectCraft.

L’interface utilise les couleurs, espacements, boutons, badges et fenêtres partagés. Conserver les identifiants des éléments utilisés par les événements et tests. Vérifier le clavier, l’annulation, la restitution du focus, le défilement et les petites fenêtres. Les actions destructives se distinguent en rouge. Éviter de réintroduire `window.confirm` quand `confirmStudioAction` convient.

### Historique, contexte et titres

Le journal utilisateur visible ne se confond pas avec les prompts techniques ni avec la fenêtre de contexte du fournisseur. Une compaction peut créer une nouvelle conversation serveur tout en conservant un historique visible continu. Ouvrir un nouveau chat vide son affichage, sans effacer les conversations sauvegardées.

Les limites réelles observées par l’API peuvent être inférieures aux capacités annoncées d’un modèle. Toute erreur « maximum token limit » doit pouvoir déclencher une compaction et une reprise bornée, même sans valeur numérique. Ne pas créer de boucle infinie de relances.

Les titres IA sont proposés dans la réponse finale habituelle de l’agent via `conversation_title`, sans requête séparée. Les titres manuels et ceux des anciennes conversations sont protégés.

Le suivi du plan accepte `plan_progress`, tableau de statuts aligné sur les étapes actuelles, dans les réponses outil, lot et finale. Le prompt complet contient les libellés ; les suivis d’une conversation existante rappellent uniquement les statuts dans leur ordre. Après compaction, le prompt complet rétablit les outils, les permissions et le plan détaillé. Aucun appel supplémentaire n’est lancé uniquement pour cocher les cases. Ne jamais déduire une étape terminée du nombre d’outils ou de la simple arrivée d’une réponse finale. `update_plan` reste disponible pour modifier les étapes.

Les suivis évitent de répéter les catalogues et les consignes déjà présentes dans la conversation serveur. Les logs longs sont raccourcis en conservant début, fin, code de sortie et indicateur de troncature ; les fichiers se lisent par plages si nécessaire. Le journal original reste intact. Une baisse des caractères envoyés ne garantit pas une baisse identique du quota facturé par le service.

L’agent déclenche les questions avec `ask_user` (Code, Motion et mode plan) ; l’enveloppe `type:"question"` est aussi normalisée vers cet outil. Pas de détection heuristique des points d’interrogation dans les messages ou les fichiers. Le modèle choisit une question libre ou des options, éventuellement multiples. Le bureau attend une réponse structurée via les prompts existants ; CLI/TUI utilisent une saisie textuelle. Aucun appel IA n’est lancé pour sonder l’utilisateur pendant l’attente.

Full accès et Tout autoriser ne résolvent jamais ces questions. Passer signifie explicitement absence de réponse ou d’autorisation ; Stop/Annuler sont des interruptions distinctes. Les réponses figurent dans l’historique visible et dans le résultat d’outil, sans être soumises comme une nouvelle tâche. Le modèle doit intégrer la réponse directement donnée par l’utilisateur, contrairement au contenu non fiable d’un fichier. Ne pas demander de secret dans ce formulaire. Tests de préparation : `test/user-questions.test.js`, à exécuter avant publication.

Toutes les cinq requêtes d’action de l’agent pendant une tâche, un bref point « Où en es-tu ? » demande d’actualiser le plan. Il est intégré au message existant, sans appel dédié, et figure aussi dans le prompt complet de reprise. Le compteur inclut les tentatives de correction du protocole ; il repart à zéro pour une nouvelle tâche. Sans plan, aucun point périodique n’est ajouté.

### Images et consommation

Les images sont préparées, transmises et leur réception visuelle est vérifiée au début ; ne pas réintroduire une question de mémoire tous les quelques tours. Les descriptions peuvent survivre à la compaction sans renvoyer systématiquement les images. Les images MCP doivent rejoindre le circuit de vision, pas être remplacées par un marqueur texte.

Le service peut limiter les pièces jointes par requête ; l’application prépare des lots. Préserver les fichiers, l’ordre, l’association à la bonne tâche et l’avertissement de consommation. Ne jamais prétendre que le modèle a vu une image dont la réception a échoué.

Le quota est relu silencieusement toutes les 15 minutes pendant l’ouverture de l’IDE. Le bouton « J’ai reçu un reset » vérifie l’API : il ne modifie pas le quota et ne doit pas annoncer une disponibilité non confirmée. Une vérification de quota ne doit pas relancer une tâche de modification.

### Permissions et stockage

Le mode Full accès est une fonctionnalité volontaire. Il conserve des actions visibles et annulables ; les modes plus restrictifs doivent garder leurs confirmations et politiques. Ne pas modifier les préférences personnelles pour obtenir des tests verts.

Le produit a changé de nom, mais son `build.appId` et le nom interne du paquet (`project-frstcli`) restent stables pour la continuité des mises à jour et des profils. Electron déduit son dossier de profil de ce nom interne : ne pas le remplacer par un dossier nommé selon le nouveau nom commercial. `FS_DATA_DIR`, `FS_STATE_DIR` et `FS_SKILLS_DIR` permettent d’isoler les essais. Ne pas partager de données d’authentification entre tests et environnement réel.

Depuis la version 1.3.4, `src/secret-storage.js` chiffre les cookies FranceStudent et le jeton GitHub avec DPAPI sous Windows ou le coffre Electron sur les autres systèmes. Les fichiers anciens sont migrés sans changer les dossiers de profil. Sans coffre disponible, conserver les secrets uniquement en mémoire et avertir l’utilisateur ; ne pas réintroduire de stockage en clair ou de clé à côté des secrets. `desktop/ipc-security.js` vérifie la fenêtre, le frame principal et l’URL exacte pour tous les appels IPC.

## Développer et vérifier

### Stabilité en préparation

Le catalogue `FST-…` et ses explications sont dans [error-codes.md](error-codes.md). Le marqueur de session distingue fermeture normale et arrêt non terminé ; FST-001 signifie que la cause exacte reste inconnue. Les événements Electron reconnus et les exceptions principales reçoivent un code plus précis, sans masquer les erreurs fatales. La raison d’une ancienne session ne doit pas être réutilisée pour attribuer une nouvelle panne ; la version du processus interrompu est conservée même après mise à jour.

Le diagnostic apparaît au démarrage et se ferme avec acquittement explicite. Le journal local `stability.json` garde au plus 50 événements techniques ; aucun contenu de conversation, fichier, jeton, message d’exception complet ou dump mémoire, et aucun téléversement automatique. Toute extension de cette collecte doit être décidée explicitement.

Les erreurs du transport `node-pty` sont prises en charge sans faire tomber le processus principal. Les messages destinés à des fenêtres détruites sont ignorés proprement. Le flux de chat est rendu au plus toutes les 80 ms, avec vidage immédiat à la fin ; au-delà de 64 000 caractères, le texte reste complet sans traitement Markdown coûteux. Les temporisateurs ne doivent jamais réafficher une conversation effacée.

Tests dédiés : `test/stability.test.js`, `test/stream-rendering.test.js`, `e2e/stability.e2e.test.js`. Ces changements sont préparés localement et ne prouvent pas que la cause du crash signalé par un utilisateur a été identifiée.

### Commandes et vérifications

Préférence du contributeur, confirmée le 24 octobre 2026 : les tests automatisés sont réservés à la préparation d’une publication ou à une demande explicite de test. Ne pas les relancer pendant le développement à chaque changement. Les commandes ci-dessous constituent la liste des contrôles à effectuer au moment de publier ; documenter entre-temps les vérifications restant à faire.


```sh
npm install
npm run build:renderer
npm run desktop
npm run lint
npm test
node --test --test-concurrency=4 e2e/*.e2e.test.js
```

Pour un seul fichier unitaire en conservant l’isolation :

```sh
node --require ./test/helpers/isolate-env.cjs --test test/conversations-manage.test.js
```

Modifier uniquement les sources de l’interface, puis reconstruire le bundle **versionné** `desktop/renderer/app.js`. Un nouveau module `NN-nom.js` partage la portée des autres : éviter les collisions de noms et respecter l’ordre d’initialisation. `npm run check:renderer` vérifie la cohérence.

Pour EffectCraft, lire [les prérequis Rust/WASM](avance.md#motion-design-avec-effectcraft--bêta), puis utiliser `npm run vendor:effectcraft` et `npm run check:effectcraft`. Les sources téléchargées dans `release/` et le build dans `desktop/vendor-effectcraft/` sont ignorés. Le correctif source versionné est la base reproductible ; ne pas livrer une modification faite uniquement dans ces dossiers ignorés. `.gitattributes` garde les correctifs `.patch` en LF pour leurs empreintes.

## Construire et publier

La procédure complète est dans [CONTRIBUTING.md](../CONTRIBUTING.md). Une commande locale Windows utilisée avec succès est :

```sh
npx electron-builder --win nsis --publish never --config.npmRebuild=false
```

`npmRebuild=false` utilise les binaires précompilés présents de `node-pty` ; ce n’est pas une preuve de compatibilité sur une autre architecture. Tester le terminal dans l’application empaquetée. Si Windows/OneDrive verrouille une sortie de build, choisir un nouveau dossier de sortie plutôt que supprimer ou arrêter des processus utilisateur.

Avant publication : actualiser version, changelog et résumé embarqué des nouveautés ; vérifier le commit et le tag exacts ; construire, tester et calculer les empreintes. Ne pas déplacer un tag public pour y cacher de nouvelles modifications. Vérifier les workflows existants dans `.github/workflows/` : un workflow présent peut être désactivé dans les réglages du fork.

Avec `gh`, préciser le dépôt de destination pour éviter toute résolution vers l’amont : `-R leo51500/francestudents-code-Roblox`. Ne jamais publier une release ou un asset sur `extraopaa/francestudents-ide` ni sur `Gab-Desing/francestudents-code-Roblox` : ce sont les crédits d’origine, pas la cible de publication. Les assets portent les noms déclarés dans `package.json`. Ne publier aucun exécutable dans Git et ne pas joindre un portable aux releases stables de ce fork.

## Passer le relais

Donner au prochain contributeur : l’objectif restant, les fichiers touchés, l’état Git, les vérifications réellement exécutées et les blocages précis. Ne jamais laisser un simple « tout est testé » sans périmètre ni résultat. Mettre ce document à jour en cas de changement structurel ; garder l’historique détaillé dans Git et le changelog.

Exemple à copier dans n’importe quel assistant :

> Je reprends ce dépôt. Lis AGENTS.md, CONTRIBUTING.md et docs/AI_CONTEXT.md. Vérifie ensuite l’état Git et la version locale, puis examine le code utile à ma demande. Préserve les changements existants et ne publie rien sans demande explicite. Ma demande : …

### Saisie du chat (prochaine mise à jour, non validée en exécution)

`50-chat-composer.js` déplace le bouton modèle existant dans le compositeur (identifiants et menu conservés). En 1.4.1, la jauge de contexte a été retirée à la demande du contributeur, ainsi que ses appels périodiques à `chatContext`. L’IPC backend reste disponible pour les diagnostics ; la compaction automatique et le quota Usage sont indépendants. Le changement d’identité du chat annule toujours une dictée en cours.



`51-chat-access.js` ajoute le menu d’accès directement au compositeur, via un popover natif avec navigation clavier, descriptions des trois modes et mémorisation optionnelle. Il réutilise exclusivement l’IPC `autoApprove` et `applySettings`/`applyStatus` : aucune seconde politique de permissions. Les sélecteurs existants `[data-access-mode]` restent réservés aux paramètres ; le nouveau menu utilise `[data-chat-access]`. L’ancien badge `agent-access` reste en place pour les ancrages Motion. Le réglage s’applique à la session entière, y compris Code et Motion ; Full accès n’auto-répond pas à ask_user. Validation d’exécution à faire avant publication : synchronisation paramètres/menu, mode personnalisé, clavier, petits panneaux, changements pendant tâche et actions en attente. Tests différés selon la préférence du contributeur.

### Pièces jointes et recherche locale

`src/attachment-policy.js` définit la consigne commune : une pièce jointe et son nom ne constituent pas une demande de retrouver l’original sur le PC. Elle est ajoutée au prompt agent (Code/Motion) et aux requêtes contenant des fichiers/images pour couvrir aussi le chat simple ; un rappel court persiste dans les suivis, y compris après compaction. Pas de recherche de repli via fichiers, shell ou MCP, même en Full accès. Un contenu inaccessible doit être signalé ; une recherche d’original nécessite une demande explicite et ciblée. Les lectures utiles du projet et ressources au chemin explicitement fourni restent possibles. Il s’agit d’une instruction au modèle, pas d’un nouveau bac à sable ni d’une détection infaillible de l’intention des commandes. Tests à effectuer avant publication : demande avec pièce jointe accessible/inaccessible, suivis, compaction, Code/Motion et recherche locale explicitement demandée.

### Profils de terminal (prochaine mise à jour)


IPC trusted `terminalPreferences` get/save/distributions ; WSL utilise execFile `wsl.exe --list --quiet` avec délai 8 s et décodage UTF-16LE ou UTF-8. La liste ne démarre/installe aucune distribution. La sauvegarde WSL vérifie la distribution installée. Lancement PTY : arguments distincts `--distribution … --cd <chemin>` sans shell intermédiaire. Les chemins UNC wsl$/wsl.localhost sont convertis vers le chemin Linux et imposent la distribution correspondante ; pour un choix par défaut, celle du chemin UNC est déduite. Le cwd du processus hôte wsl.exe reste le dossier utilisateur Windows. Les terminaux natifs conservent le cwd du projet. Le terminal simple lance également le profil sélectionné, mais reste un mode de secours sans état de shell persistant.


### Niveau de réflexion GPT (prochaine mise à jour)

`src/api/reasoning.js` contient les capacités vérifiées et GET/PATCH `/user/instructions` (`gptReasoning`). Le PATCH ne transmet que ce champ, préservant les instructions et autres préférences du compte. La valeur est relue après sauvegarde ; aucune réussite optimiste. Enum FranceStudent vérifiée via sa spec publique le 24/10/2026 : none/minimal/low/medium/high/xhigh. Ne pas ajouter max, non exposé par FranceStudent. Modèles connus GPT-5.6 Sol/Luna/Terra, GPT-6 Sol/Luna : none/low/medium/high/xhigh. GPT-6.1 Sol : low/medium/high/xhigh. Aucun minimal pour ces modèles. Les modèles inconnus restent sans contrôle ; les IDs observés ne servent que si aucune identité de modèle explicite n’existe.

Sources officielles consultées le 24/10/2026 : https://developers.openai.com/api/docs/models/gpt-6.1-sol ; https://developers.openai.com/api/docs/models/gpt-6-sol ; https://developers.openai.com/api/docs/models/gpt-6-luna ; https://developers.openai.com/api/docs/models/gpt-5.6-sol ; https://developers.openai.com/api/docs/models/gpt-5.6-luna ; https://developers.openai.com/api/docs/models/gpt-5.6-terra. Spécification service : https://api.francestudent.ai/v3/api-docs. Le support fournisseur n’est pas une preuve d’application effective par le proxy FranceStudent : le parcours réel reste à valider.

`53-gpt-reasoning.js` fournit un popover du compositeur, niveaux filtrés, indication explicite « préférence du compte » et coût potentiel. IPC trusted `reasoning` revalide le modèle actif et le niveau côté main. Sauvegarde interdite en tâche ; verrou court contre envois/changements de modèle/déconnexion pendant le PATCH. Les réponses d’anciens chargements sont ignorées, les niveaux incompatibles du compte sont affichés « à choisir », sans mutation automatique. Le réglage est global, non propre au chat. Tests préparés `test/reasoning.test.js`, non exécutés selon la préférence du contributeur. Avant publication : vérifier API réelle GET/PATCH/relecture, refus HTTP/401, préservation des autres préférences, modèle changé, tâche en cours, Code/Motion, clavier et cohérence entre clients.

### WSL : environnement du projet (remplace la limitation terminal seul ci-dessus)

La demande WSL couvre désormais le travail de développement du projet : réglage optionnel Paramètres → Général → Environnement du projet · WSL, dans `54-wsl-project.js`. Le profil de terminal seul reste disponible mais l’environnement WSL du projet a priorité. IPC `projectEnvironment` get/check/save, associé à l’identité du workspace et interdit de changement pendant agent/jobs/tâches. Sauvegarde par projet dans `projectExecutionEnvironments` (clé workspace Windows normalisée ; casse de la partie Linux UNC conservée). Distribution effective et chemin Linux gelés après vérification explicite du dossier avec WSL. L’activation démarre la distribution pour vérifier Bash, setsid et le dossier ; elle ne lance pas de tests, n’installe ni WSL ni dépendances. Bouton Vérifier sans sauvegarde. Aucun changement automatique pour les autres projets ou Motion.

`src/execution-environment.js` centralise la configuration et les cibles WSL : args séparés distribution/--cd, conversion des arguments de chemins Windows absolus par wslpath (montages personnalisés compris), shell de connexion Bash pour le PATH Linux, groupe de processus setsid. Un marqueur stderr aléatoire transmet uniquement le PGID au lanceur, retiré de la sortie affichée ; Stop vise ce groupe avec TERM puis KILL, pas la distribution entière. Ne pas utiliser wsl --shutdown/terminate pour annuler une tâche. Les wrappers Windows et Linux restent séparés : Windows est le cwd du processus hôte, --cd est le dossier Linux effectif. Les chemins UNC wsl$/wsl.localhost sélectionnent leur distribution et refusent les contradictions. Les cwd Linux sous le projet sont reconvertis vers l’hôte pour les contrôles de fichiers.

Routages : runner commun des commandes de l’agent/jobs (`src/tools/command/runner.js`) après les contrôles de permissions d’origine ; shell Full accès Bash dans shell.js ; profils terminal ; tâches et serveurs `desktop/project-studio.js` ; diagnostics ESLint/tsc (binaires Linux .bin, sorties ramenées aux chemins du projet) ; lecture Git desktop ; diagnostic d’environnement du cockpit. Le prompt et son cache incluent l’environnement ; Node/version Linux ne sont pas confondus avec l’Electron hôte. Le parseur/policy hors Full accès n’est pas remplacé par un shell libre. Aucun préfixe magique permettant de contourner les contrôles. Les outils de fichiers restent côté hôte et utilisent les chemins relatifs.

Limites explicites : interface/éditeur et serveur LSP embarqué restent natifs, ainsi que connecteurs GitHub et serveurs MCP Windows configurés. Ne pas annoncer une session distante complète de type VS Code Remote. Le PATH des outils gérés par nvm/etc doit être chargé par Bash de connexion ; rien n’est installé automatiquement. L’option répond à la réutilisation des outils/packages WSL pour les exécutions du projet, pas au remplacement de toutes les intégrations Windows. Les terminaux déjà ouverts ne migrent pas.

Validation de cette extension NON exécutée, selon la consigne de réserver les tests à la publication. Avant release : vrais projets Windows/UNC WSL, distribution explicite/défaut/disparue, espaces/accents, npm/pnpm/python existants seulement dans Linux, commandes autorisées/refusées/Full accès, pipeline et stdin, sorties et diagnostics, serveurs accessibles depuis le navigateur Windows, Stop/Ctrl+C/jobs descendants sans tuer une autre session WSL, changements de projet/environnement, reprise native et non-régression Windows/Motion. Vérifier le packaging des nouveaux modules. Les premières descriptions terminal seul dans ce contexte sont remplacées par cette section.

Tests WSL préparés dans `test/execution-environment.test.js` (non exécutés) : opt-in par projet et isolation Motion, chemins UNC/casse Linux, arguments littéraux non interpolés, masque du marqueur PGID, arrêt ciblé sans shutdown/terminate de distribution, conversion cwd sous le projet. Les contrôles réels de processus et distributions restent indispensables avant publication.

## Préparation de la release 1.4.0


Import local rétabli : desktop/local-skill-import.js, IPC localSkillImport, 55-local-skills.js et branche local de l’éditeur existant. Fichier Markdown, dossier et ZIP (une seule racine SKILL.md), ressources incluses, aperçu à token temporaire gardé dans main, choix nom/portée, skill désactivé, aucune exécution à l’import. Réutilisation des limites et contrôles de chemins de extension-center.install ; pas d’écrasement d’un dossier déjà installé. Limites : 200 ressources/4 Mo, profondeur 12, 1000 éléments de dossier, ZIP indexé avant décompression pour refuser les grandes archives. Le renderer ne transmet pas les octets des ressources lors de l’installation, seulement le token. Tests locaux : test/local-skill-import.test.js et import UI dans e2e/chat-composer.e2e.test.js.

Les nouveaux rappels de suivi sont compacts ; délimiteur RAPPELS INTERNES ajouté à la reconstitution d’historique pour ne jamais les confondre avec une réponse utilisateur. Le script WSL d’arguments est une chaîne ordinaire : ne pas le convertir en template JS sans traiter les expansions Bash. setsid --wait conserve le lien de durée de vie avec wsl.exe. Le test d’arrêt brutal accepte un code Windows non nul différent du 77 demandé : la fermeture forcée de ConPTY peut rapporter un fast-fail natif ; c’est la détection d’arrêt non propre qui est vérifiée.

### Finition des contrôles du chat

Le compositeur utilise deux rangées stables : `chat-model-row` (modèle, contexte, micro) et `chat-settings-row` (accès/réflexion). Réutiliser `chatControlContent` pour les icônes SVG, labels et chevrons. Les requêtes container de la saisie masquent le préfixe Réflexion sur panneau étroit pour garder la valeur lisible ; les outils secondaires restent identifiables par leurs titres et noms accessibles. Les boutons ont des états focus/hover cohérents et le micro un petit badge β. Ne pas revenir à une suite libre de textes et symboles qui se replie aléatoirement. Le test chat-composer vérifie le bouton Envoyer à 900×600 et l’aperçu a été contrôlé visuellement. La confirmation de suppression ferme explicitement le menu d’historique, y compris au clavier et après annulation.


### Refonte plein écran du chat (après 1.4.0, non encore publiée)

56-chat-layout.js regroupe les actions dans la navigation du chat, masque les anciens agent-header/agent-context-bar mais conserve leurs ancrages DOM utilisés par Motion, et déplace les outils secondaires existants dans un popover accessible chat-more-tools. Les IDs et handlers sont conservés. Le choix de mode et l’effacement d’affichage sont rangés dans ce menu. La sélection d’accès reste dans le compositeur. Pas de centrage max 900 px : focus-agent occupe tout l’espace utile, sans barre d’activité ni statut. Les rangées de contrôles se réunissent en une ligne lorsque le compositeur est large ; les cartes de démarrage sont en trois colonnes en plein écran large. Échap quitte le focus seulement hors tâche, dialogue, menu et commande slash. Code/Motion restent isolés ; le focus Motion masque puis restaure le vrai studio.

03-transcript.js replie uniquement les notices techniques de démarrage reconnues (connexion/projet/mémoire/indexation) et le message précis de transmission du projet, dans un groupe de session consultable. Aucun message utilisateur/assistant, erreur ou avertissement arbitraire supprimé. Le journal local et l’historique conservent les données originales. Les parcours import Codex, Éco et favoris passent désormais par chat-more-tools. Test dédié e2e/chat-layout.e2e.test.js : dimensions plein écran Code/Motion, retour par Échap, accessibilité du menu et vue étroite ; capture release/chat-fullscreen-next.png contrôlée visuellement. Parcours spécifiques du compositeur, import, Éco, file et migration Windows également passés. Cette refonte est séparée des assets 1.4.0 déjà publiés : ne pas remplacer leur contenu sous le même tag.



### Import ZIP de skills : exclusions cohérentes (1.4.1)


Le scénario de régression ZIP de test/local-skill-import.test.js (dépendances volumineuses et faux SKILL.md exclus) a réussi en préparation 1.4.1. L’utilisateur a ensuite précisé que son signalement concernait un ZIP joint au chat ; voir la section dédiée. Son archive exacte n’a pas été fournie.

### Plan de travail unique et présentation (1.4.1)

57-work-plan.js fournit le rendu commun du plan. Les événements plan sont toujours enregistrés via recordStudioEntry pour l’historique et l’export, mais n’ajoutent plus de carte dans le transcript : ils mettent à jour agent-live-plan. Le même composant est utilisé par renderAgentActivity. Les items texte historiques sont interprétés à partir de leurs marqueurs ✓/◉/○ et cases Markdown ; les données structurées steps sont privilégiées lorsqu’elles sont présentes. La carte conserve l’état ouvert/replié, le scroll des étapes et le focus du résumé ; des mises à jour identiques ne reconstruisent pas le DOM. Le composant utilise uniquement son état DOM pour pouvoir être appelé par les modules antérieurs à son chargement dans le bundle concaténé (pas de variable let tardive en TDZ).

La progression se fonde exclusivement sur les étapes completed. Un run terminé avec des étapes non vérifiées affiche À poursuivre, pas Terminé. Les plans relus dans l’historique sont repliés par défaut ; une nouvelle conversation réinitialise le plan. Les messages de l’agent demandent de ne pas recopier la liste du plan dans la réponse finale sans demande utilisateur ; il s’agit d’une instruction, pas d’une suppression heuristique des réponses. La carte reste accessible au clavier, indique aria-current=step et utilise des textes de statut accessibles.

Le scénario e2e/work-plan.e2e.test.js a réussi dans la suite complète puis dans les contrôles ciblés 1.4.1 : un seul plan après événements plan+activité, mises à jour, pliage, états incomplets, réinitialisation et relecture historique. Le build renderer a été régénéré et la capture plein écran contrôlée visuellement.

### ZIP joints au chat (1.4.1)

Le signalement concerne bien une archive jointe dans le chat que l’agent semble ne pas réussir à décompresser/lire. Les fichiers ne sont pas importés dans le projet : les contenus sont ouverts/converts localement, envoyés dans le texte des pièces jointes, et les images par les lots existants. Ne pas demander à l’agent de chercher l’original sur le PC.

src/api/archive-input.js ajoute allowPartial (désactivé par défaut) : en mode chat, une entrée dépassant 25 Mo ou le budget de décompression de 100 Mo est signalée sans décompression, tandis que les autres entrées sûres restent lisibles ; erreurs de flux/compression signalées par entrée. Les erreurs de structure, traversées de chemins et plus de 10 000 entrées restent des refus de l’archive. Le lecteur strict de l’import de skills conserve son comportement. Le décompte des entrées reste global même en cas de filtre.

src/api/file-conversion.js active cette lecture partielle pour les ZIP du chat. Les méthodes de compression ZIP non supportées par yauzl peuvent être reprises par le moteur 7z-wasm déjà installé, uniquement en mémoire et avec ses contrôles de chemins/tailles. Les données récupérées sont rapprochées des entrées validées du premier inventaire ; un échec de repli ne supprime pas les contenus déjà lus. Les archives chiffrées ne sont pas déchiffrées sans mot de passe et aucun secret n’est demandé automatiquement.

convertArchiveContents borne l’inventaire et le texte global, conserve les premiers contenus transmis au lieu de remplacer toute l’archive par un aperçu binaire en cas de dépassement, et signale les fichiers omis (noms bornés + compte). Une entrée chiffrée/illisible marque effectivement partial=true ; un fichier vide est identifié sans prétendre à un défaut de lecture. resolvePendingFiles affiche un avertissement ZIP partiel lors de sa première conversion, sans le répéter pour chaque relance. Le texte envoyé précise que les chemins sont internes à l’archive et ne doivent pas être recherchés sur la machine.

Les scénarios test/document-conversion.test.js ont réussi en préparation 1.4.1 : entrée ZIP >25 Mo avec texte exploitable à côté, entrée chiffrée + entrée publique, dépassement du budget texte conservant le contenu déjà lu, ZIP LZMA via 7-Zip. Aucun ZIP concret ni message d’erreur de l’utilisateur n’a été fourni ; ne pas prétendre avoir reproduit son archive précise.
