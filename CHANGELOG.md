# Journal des modifications

## 1.25.1 — Sons et textures pour Roblox

- Nouveau skill intégré `roblox-audio` : recherche de sons libres de droits,
  vérification des licences et préparation des fichiers pour Roblox. L’upload
  reste manuel ; l’agent câble le son dans Studio après réception de son ID.
- Le pipeline Blender couvre les textures procédurales et le bake de cartes
  PNG, conservées sur chaque LOD et vérifiées visuellement dans Studio.
- L’agent route automatiquement les demandes audio vers ce workflow et ne
  déclare pas un son intégré sans asset Roblox réel et `Sound` vérifié.
