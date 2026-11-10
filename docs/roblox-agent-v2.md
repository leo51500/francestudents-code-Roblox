# Agent Roblox v2 — audit et stratégie de migration

> Statut : implémenté dans `src/roblox/`, outils `roblox_game` et `roblox_asset`.
> Ce document remplace les descriptions dispersées de l'ancien pipeline.

## 1. Audit de l'existant

### Ce qui fonctionne

- Boucle agent locale (`src/agent/agent.js`) : outils fichiers, commandes, MCP, skills,
  sous-agents, annulation, journal `/undo`, suivi de plan.
- Quatre skills Roblox (`roblox-blender`, `roblox-lod`, `roblox-ui`, `roblox-audio`)
  et deux connexions MCP (Blender, Studio) proposées dans Extensions.
- Détection de Blender et Roblox Studio (`src/programs.js`), outils `open_program`,
  `open_app`, `open_in`.

### Pourquoi l'agent répond « je ne peux pas »

1. **Le support Roblox est uniquement du prompt.** Aucun outil ne sait créer un
   projet Roblox, enregistrer un asset, générer un LOD ou construire une place.
   Sans MCP Studio/Blender déjà configuré, le modèle ne dispose d'aucune action
   réelle et conclut honnêtement qu'il est bloqué.
2. **Le pipeline dépend d'un MCP non installé par défaut.** `uvx mcp-for-blender`
   et `%LOCALAPPDATA%\Roblox\mcp.bat` ne sont pas fournis. Blender est pourtant
   installé et peut être piloté en ligne de commande.
3. **Prompts contradictoires et énormes.** La section « spécialisation » (~60 Ko
   au total) répète des règles, autorise explicitement l'arrêt « si le MCP
   manque », et noie la consigne de travail. Le modèle produit alors un refus
   argumenté au lieu d'agir.
4. **Aucune mémoire de production.** Le plan de l'agent vit en RAM ; rien ne
   décrit l'état du jeu entre deux sessions (systèmes faits, assets, LOD, uploads).
5. **Aucune vérification du résultat.** Rien ne construit la place, ne vérifie
   les fichiers Luau, ni ne contrôle que les LOD existent avant de déclarer un
   asset terminé.

### Anciennes logiques à retirer

- La double consigne « ne jamais refuser » / « si le MCP manque, arrête-toi »
  est remplacée par une règle unique : **le travail local continue toujours**,
  l'absence d'un service externe est un état à signaler, pas un motif d'arrêt.
- Le catalogue d'outils ne mentionne plus Roblox uniquement dans un paragraphe
  de prose : les outils `roblox_game` et `roblox_asset` sont de vrais outils
  exécutables, avec paramètres et résultats.
- Les chemins Blender/Studio ne sont plus supposés : ils sont détectés, et
  l'échec est rapporté avec le chemin réel.

## 2. Architecture retenue

```
src/roblox/
  blueprint.js        schéma du jeu, systèmes connus, phases de production
  project.js          lecture/écriture du manifeste et des fichiers de production
  scaffold.js         création de la structure Rojo + runtime serveur/client
  systems.js          ajout de systèmes Luau réels depuis les modèles
  assets.js           bibliothèque d'assets, spécifications, export Blender
  blender.js          détection Blender, exécution headless, vérification du rapport
  validate.js         structure, syntaxe Luau, cohérence blueprint/assets
  build.js            construction de la place avec Rojo
  status.js           avancement par phase, calculé depuis le disque
  templates/          fichiers Luau, thème HUD, bibliothèque Blender
```

Deux outils exposés à l'agent :

| Outil | Actions | Effet réel |
| --- | --- | --- |
| `roblox_game` | `init`, `add_system`, `scaffold`, `status`, `validate`, `build`, `phase`, `systems`, `plan` | Crée les fichiers du projet, met à jour le blueprint, vérifie et construit la place. |
| `roblox_asset` | `schema`, `spec`, `import`, `build`, `upload`, `audio`, `plugin`, `login`, `list`, `show` | Enregistre une spécification ou importe un fichier 3D existant, exécute Blender en `--background`, exporte LOD0–LOD3 et une capture, met à jour `assets/library.json` ; `audio` importe un son ; `upload` envoie le LOD0 ou le son avec le compte du plugin Roblox ; `plugin` vérifie la connexion ; `login` la rétablit dans le navigateur. |

### Chaîne de production (11 phases)

1. analyse → 2. plan → 3. structure Rojo → 4. assets Blender → 5. LOD →
6. systèmes Luau → 7. interfaces natives → 8. intégration → 9. validation →
10. build `.rbxlx` → 11. livraison.

`roblox_game init` crée le blueprint avec ces phases et `action:plan` les renvoie
au format du suivi de tâche. Chaque phase est persistée dans
`game.blueprint.json` (action:phase) ; `action:status` la recalcule depuis le
disque (fichiers présents, assets construits, place générée).

## 3. Le pipeline Blender devient local et vérifiable

```
roblox_asset spec    → assets/specs/<id>.json
roblox_asset import  → assets/sources/<id>.<ext>  (copie du fichier existant)
roblox_asset build   → blender --background --factory-startup
                       --python src/roblox/templates/blender/build_asset.py -- --spec ...
import (Blender)     → blender --background --factory-startup
                       --python src/roblox/templates/blender/import_asset.py -- --spec ...
                     → assets/models/<id>/lod0..3.glb
                     → assets/models/<id>/preview.png
                     → assets/models/<id>/report.json (triangles par LOD)
roblox_asset audio   → copie assets/audio/<id>.<ext> + assets/audio/library.json
roblox_asset upload  → blender --background (plugin chargé, sans factory-startup)
                     → refresh token OAuth du plugin → AssetsUploadClient
                     → assetId + modération + src/shared/AssetIds.luau
```

- **Import** : les formats GLB, glTF, FBX, OBJ, STL et BLEND sont acceptés. Le
  fichier est copié dans `assets/sources/` (200 Mo maximum, dépendances d'un
  `.gltf` comprises), puis Blender fusionne les maillages, oriente, met à
  l'échelle (`height` ou `scale`), recalcule les normales, ajoute un UV si
  nécessaire, puis génère les LOD.

- Les modèles sont composés de primitives paramétrées (boîte, cylindre, cône,
  sphère, tore, icosphère, répétitions) avec biseau, matériaux procéduraux,
  origine au sol et transformations appliquées.
- Les LOD sont générés par modificateur `DECIMATE` avec ratios 100 / 50 / 25 / 10 %
  et un plancher de 8 faces ; chaque LOD est exporté séparément.
- Une capture `preview.png` est rendue à chaque build : l'agent doit l'examiner
  avec `view_image` avant de déclarer l'asset correct.
- `roblox_game action:validate` signale un asset déclaré dans
  `assets/library.json` dont le fichier LOD0 est absent, et `action:build`
  refuse de construire tant que la validation échoue.

## 4. Le projet Roblox est un vrai projet Rojo

`roblox_game init` produit :

```
default.project.json      mapping Rojo (Shared, Server, Client)
game.blueprint.json       état de production persistant
src/shared/               GameConfig, Remotes, Items, définitions
src/server/               ServerMain.server.luau, services auto-chargés
src/client/               ClientMain.client.luau, contrôleurs auto-chargés
assets/library.json       registre des assets et de leurs LOD
assets/specs/             spécifications JSON des assets
assets/sources/           fichiers 3D importés (GLB, FBX, glTF…)
assets/models/<id>/       GLB LOD0–LOD3, textures, aperçu et rapport
build/<slug>.rbxlx        place construite par rojo
```

Le runtime de base est fonctionnel, pas décoratif : chargement ordonné des
services, remotes créés à la demande, données joueur persistantes avec reprises,
autosave, `BindToClose`, HUD cartoon natif. Les interfaces sont des objets GUI
Roblox (`ScreenGui`, `Frame`, `UIStroke`, `UICorner`, `UIGradient`).

Systèmes disponibles via `add_system` : `inventory`, `combat`, `npc`, `quests`,
`shop`, `building`. Chacun ajoute du code Luau serveur et client réel et met à
jour le blueprint.

## 5. Migration

| Ancien | Nouveau |
| --- | --- |
| Prompt « si le MCP manque, arrête » | Travail local toujours possible ; MCP utilisé seulement pour l'insertion Studio. |
| Modélisation via MCP Blender obligatoire | Blender local (`--background`) par défaut ; MCP Blender optionnel pour l'interactif. |
| Aucun état de projet | `game.blueprint.json` + `status` recalculé. |
| Aucune vérification | `validate` (structure, syntaxe Luau si `luau-compile`/`luau-analyze` présent, assets) + `build` Rojo. |
| Plan en RAM | Phases persistées et rapport de livraison. |

## 6. Limites assumées

- **Insertion dans Studio** : elle nécessite le serveur MCP Roblox Studio. Sans
  lui, la place `.rbxlx` est construite et peut être ouverte manuellement dans
  Studio ; l'agent ne prétend jamais avoir inséré un asset sans identifiant.
- **Upload des assets 3D et audio** : `roblox_asset action:upload` réutilise le
  refresh token OAuth du plugin Roblox Blender installé et connecté ; aucune clé
  Open Cloud n'est nécessaire. Sans plugin connecté, l'outil répond
  `needs_login: true` et n'invente aucun identifiant. Les LOD1–LOD3 restent
  locaux, Roblox applique son propre LOD. L'option `provider:"opencloud"` existe
  encore pour les modèles.
- **Sons** : l'upload audio passe par le même compte que le plugin et reste
  soumis aux règles Roblox (vérification du compte, quotas, modération).
- **Budget/topologie** : les modèles sont stylisés et procéduraux ; un modèle
  héroïque complexe demande plusieurs assets et des retouches dans Blender.
- **Vérification du rendu en jeu** : sans instance Studio pilotable, la
  validation s'arrête au build Rojo, à la syntaxe Luau et aux captures Blender.

## 6 bis. Upload par le plugin Blender

Le module `src/roblox/plugin.js` lance Blender sans `--factory-startup`, charge
l'add-on **Upload to Roblox**, rafraîchit le jeton OAuth, sélectionne le créateur
et appelle `AssetsUploadClient` directement. Le script Python
`src/roblox/templates/blender/plugin_upload.py` renvoie un JSON (assetId,
révision, modération) que l'outil traduit en mise à jour de
`assets/library.json`, `assets/audio/library.json` et
`src/shared/AssetIds.luau`.

Le refresh token Roblox tourne à chaque utilisation : le script réécrit le
nouveau jeton dans les préférences du plugin et sauvegarde les préférences, sinon
la session suivante serait révoquée. Quand le jeton est expiré ou révoqué,
`roblox_asset action:login` relance le flux OAuth du plugin en headless : il
ouvre la page Roblox dans le navigateur, attend le retour sur
`localhost:8181/oauth2/callback` et réenregistre la session, sans passer par
l'interface de Blender. Vérifié sur un compte réel : un `Model` revient
`Approved`, un `Audio` revient `Reviewing`, et deux rafraîchissements successifs
gardent la session valide.

Limites : le plugin ne publie pas une place et n'exempte pas des règles audio de
Roblox.
