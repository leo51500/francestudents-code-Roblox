# Journal des modifications

## 1.26.4 — L'application clignote à chaque notification

- Quand une notification arrive alors que la fenêtre n'est pas au premier plan,
  l'icône de la barre des tâches clignote pour attirer l'attention.
- Le clignotement s'arrête dès que la fenêtre revient au premier plan ou que la
  notification est cliquée.
- La couleur (orange/rouge) est choisie par Windows ; l'application ne peut pas
  la modifier.
- Si la fenêtre est déjà active, aucune notification de tâche n'est affichée et
  rien ne clignote inutilement.

## 1.26.3 — Blender ouvert par l'agent et notifications sans clignotement

- L'agent ouvre lui-même Blender ou Roblox Studio avec `open_program` quand un
  MCP ne répond pas, attend le démarrage puis relance le diagnostic ; il ne
  demande plus à l'utilisateur d'ouvrir l'application avant d'avoir essayé.
- Le skill `roblox-blender` suit la même règle et rétablit la connexion du
  plugin avec `roblox_asset action:login` avant de solliciter l'utilisateur.
- L'icône de la barre des tâches ne clignote plus en rouge/orange à l'arrivée
  d'une notification : le clignotement Windows est annulé juste après
  l'affichage, puis aux échéances suivantes et au retour au premier plan.
- La notification reste affichée et sonore ; seule la demande d'attention de
  la barre des tâches est retirée.

## 1.26.2 — Relance complète après un refus d'exécuter les outils

- Un refus qui mentionne le catalogue d'outils, un agent local ou le fait
  d'écrire du code « dans cette conversation » est maintenant reconnu et
  relancé.
- La relance renvoie le prompt complet (identité, catalogue, format JSON,
  demande) au lieu d'un simple rappel dans le fil où le modèle a déjà refusé.
- Si un schéma MCP vient d'être décrit, la relance demande d'appeler l'outil
  réel sans `describe` et d'attendre son résultat.
- Les limites de pièce jointe et les refus de permission restent exemptés.

## 1.26.1 — L'agent relance un refus d'accès aux outils

- Une réponse finale qui affirme ne pas pouvoir exécuter les outils locaux
  depuis la conversation est maintenant relancée une fois avec le protocole
  d'outils, au lieu d'être affichée comme un compte rendu.
- La détection couvre aussi les formulations « je n'ai pas de moyen »,
  « aucune création de fichier n'a été effectuée » et « écrire un objet JSON
  ne garantit pas l'exécution ».
- Si le refus persiste après la relance, il est affiché tel quel ; un échec
  d'outil réel reste expliqué à partir de son résultat.

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
