# Journal des modifications

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
