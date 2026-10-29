# Roblox Studio et Blender dans FranceStudent Code Roblox

[← Les guides](README.md) · [Premiers pas](guide-utilisation.md)

L'espace Code de FranceStudent Code Roblox est spécialisé pour **Roblox Studio (Luau, Rojo)** et **Blender** (modèles 3D destinés à Roblox). L'assistant reçoit systématiquement les instructions de spécialisation ; le studio Motion design et EffectCraft restent un espace séparé et n'y ont pas accès.

## Ce que l'assistant fait

- **Luau** : code typé (`--!strict`), API actuelles, remotes validés côté serveur, DataStore fiable, gestion propre des connexions.
- **Rojo** : lecture de `default.project.json`, des dossiers `src/client`, `src/server`, `src/shared`, génération d'un build `.rbxlx` et synchronisation avec Studio.
- **Qualité** : respect de StyLua, Selene et TestEZ si le projet les utilise ; contrôle des limites mobile/console (parts, mesh, textures 1024 px).
- **Blender** : écriture et exécution d'un script Python Blender, export GLB vérifié, puis étapes d'import dans Roblox.

L'assistant refuse d'affirmer qu'il a « vu » Studio ou Blender sans résultat réel : seuls un connecteur MCP configuré ou la sortie d'une commande comptent.

## Commandes détectées dans le cockpit

Le cockpit du projet (`Ctrl+Maj+D`) repère automatiquement :

| Détection | Commande proposée |
| --- | --- |
| `*.project.json` | `rojo build <projet> --output build/game.rbxlx`, `rojo serve` |
| `wally.toml` | `wally install` |
| `src/` ou `.luaurc` | `selene .` |

Le nom du projet affiché vient du champ `name` du premier fichier `*.project.json`.

## Skills intégrés

La bibliothèque embarquée contient 16 skills Roblox/Blender, disponibles hors ligne dans **Outils supplémentaires → Skills** :

| Skill | Sujet |
| --- | --- |
| `roblox-luau` | Luau propre et typé |
| `roblox-server-authority` | Serveur qui fait autorité, anti-triche |
| `roblox-datastore` | Sauvegardes DataStore fiables |
| `roblox-ui` | Interface lisible mobile/console/PC |
| `roblox-building` | Construction de niveaux |
| `roblox-scripts` | Mécanique de jeu complète |
| `roblox-optimization` | Performance et MicroProfiler |
| `roblox-publish` | Build Rojo et test dans Studio |
| `roblox-avatar` | Rigs et animations |
| `roblox-monetization` | Boutique et receipts |
| `roblox-debug` | Débogage dans Studio |
| `roblox-scene-graph` | Inspection d'une scène |
| `blender-model` | Modèle 3D prêt pour Roblox |
| `blender-script` | Script Blender robuste |
| `blender-optimize` | Optimisation d'asset |
| `blender-texture` | Textures et matériaux |

## Outils Roblox de l’agent

| Outil | Rôle |
| --- | --- |
| `roblox_env` | État des outils (Rojo, Selene, luau-lsp, luau-analyze, Aftman, Wally, Blender). `action:"studio"` démarre le serveur Rojo et écrit `.rojo-connect.json`. |
| `roblox_check` | Règles Roblox locales, Selene, luau-analyze et `rojo build` : la preuve que le projet compile. |
| `roblox_scene` | Graphe de scène : destination des scripts, remotes émis/écoutés, tags, modules orphelins. |
| `rojo_serve` | Serveur Rojo géré par l’IDE : `start`, `status`, `stop`, `connect`. Écoute uniquement sur 127.0.0.1, choisit un port libre et indique si Studio est connecté. |
| `roblox_playtest` | Construit la place, l’ouvre dans Roblox Studio et relit les erreurs du dernier log Studio (`action:"logs"`). |

La barre d’état affiche `Rojo <port> · Studio connecté` (en vert) ou `· en attente` tant que le plugin n’est pas branché.

## Outils Blender de l’agent

| Action | Rôle |
| --- | --- |
| `detect` | Trouve Blender (PATH, `blender.json`, installation standard) et sa version. |
| `templates` | Liste les modèles Python embarqués. |
| `script` | Exécute un script Python du projet en `--background`. |
| `inspect` | Lit le GLB (en-tête, meshes, triangles, matériaux, taille en studs, manifeste). |
| `validate` | Analyse réelle dans Blender : triangles par mesh, UV, normales, arêtes non-manifold, faces dégénérées, transformations, textures. |
| `render` | Rendu PNG à examiner avec `view_image`. |
| `manifest` | Écrit `<modele>.manifest.json` (nom, taille en studs, catégorie). |
| `import_roblox` | Copie le GLB et son manifeste dans `src/ReplicatedStorage/Assets` et donne les étapes Studio. |
| `export_blender` | Part d’un `.blend` pour produire un GLB propre (caméras et lumières retirées). |

## Connecteurs MCP (optionnel)

Pour agir directement dans Studio ou Blender, configure un serveur MCP dans `mcp.json` (Rojo/Studio ou serveur Blender). L'assistant le détecte dans le catalogue et utilise `mcp_call`. Les outils intégrés `rojo_serve` et `roblox_playtest` couvrent déjà la synchronisation Studio et le test de la place ; un connecteur MCP reste utile pour piloter Studio directement (insertion d’objets, exécution de commandes).

## Bonnes pratiques de conversion Blender → Roblox

- Échelle : **1 stud = 0,28 m** ; originer les objets à leur base.
- Axes : +Z vers le haut, face avant vers −Y.
- Appliquer les transformations et les modificateurs avant export.
- Textures **1024 px maximum**, UV non chevauchants, normales cohérentes.
- Aucune lumière ni caméra exportée avec le modèle.
- Export **glTF/GLB** ; n'annoncer le fichier qu'après vérification réelle de sa création.
- Un prop mobile vise en général quelques centaines à quelques milliers de triangles ; ces cibles sont des ordres de grandeur, pas des règles officielles.
