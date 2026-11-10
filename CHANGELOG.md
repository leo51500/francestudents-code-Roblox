# Journal des modifications

## 1.26.0 — Projets Roblox et assets créés depuis l'agent

- Deux nouveaux outils locaux, `roblox_game` et `roblox_asset`, créent la
  structure Rojo, le blueprint, les systèmes Luau, valident le projet et
  construisent `build/<slug>.rbxlx`, même sans serveur MCP.
- Les modèles 3D sont créés dans Blender ou importés depuis un GLB, glTF, FBX,
  OBJ, STL ou BLEND. Blender produit les LOD0 à LOD3, les textures et un aperçu,
  puis le rapport est contrôlé avant de déclarer l'asset terminé.
- L'upload d'un modèle ou d'un son réutilise le compte déjà connecté dans le
  plugin Roblox Blender, sans clé Open Cloud. `action:login` rétablit la session
  dans le navigateur et `src/shared/AssetIds.luau` reçoit les identifiants
  réels.
- La validation couvre aussi les sons, le scaffold livre `AssetIds.luau` et
  `status` récapitule les assets et les uploads.
- L'agent relance une réponse qui prétend ne pas pouvoir créer un jeu ou un
  modèle, au lieu de s'arrêter sur un refus.

## 1.25.4 — Sauvegardes plus claires pour Roblox Studio

- L’onglet Sauvegardes précise que les modifications faites dans Blender et
  Roblox Studio ne sont pas incluses dans les versions locales du projet.
- Quand une version ne contient aucun changement à restaurer, le bouton
  l’indique clairement et une explication reste affichée dans la liste.

## 1.25.3 — Reprise après une réponse trop volumineuse

- Une réponse fournisseur qui dépasse la limite de sécurité affiche maintenant
  une action directe pour reprendre la tâche interrompue.
- Les détails techniques indiquent le type d’événement SSE et sa taille,
  même lorsqu’un événement trop volumineux arrive d’un seul bloc.

## 1.25.2 — Sauvegardes et conversations plus fiables

- L’onglet Sauvegardes distingue les versions du projet actif, indique le
  nombre de fichiers suivis et affiche les retours des actions au bon endroit.
- Si une conversation a été supprimée côté serveur, la demande en cours
  reprend automatiquement dans un nouveau fil, sans toucher à l’autre mode.

## 1.25.1 — Sons et textures pour Roblox

- Nouveau skill intégré `roblox-audio` : recherche de sons libres de droits,
  vérification des licences et préparation des fichiers pour Roblox. L’upload
  reste manuel ; l’agent câble le son dans Studio après réception de son ID.
- Le pipeline Blender couvre les textures procédurales et le bake de cartes
  PNG, conservées sur chaque LOD et vérifiées visuellement dans Studio.
- L’agent route automatiquement les demandes audio vers ce workflow et ne
  déclare pas un son intégré sans asset Roblox réel et `Sound` vérifié.
