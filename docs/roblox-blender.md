# Roblox + Blender : modèles 3D et LOD

[← Les guides](README.md) · [Skills et MCP](extensions.md)

L’application est spécialisée pour créer les modèles 3D dans **Blender**, générer
leurs **LOD**, les publier avec le **plugin Roblox** puis les insérer dans
**Roblox Studio**. La géométrie ne doit jamais être fabriquée dans Studio.

## Ce qui est automatique

- L’agent reçoit une consigne de spécialisation Roblox + Blender dans son prompt.
  Le routage vers Blender est **automatique, même si la demande ne prononce pas
  le mot « Blender »** : dès qu’il y a de la 3D réelle, la géométrie se crée dans
  Blender. Studio ne sert jamais à modéliser ni à remplacer un asset par des
  Parts.
- Quatre skills intégrés sont disponibles sans installation :
  - `roblox-blender` : pipeline complet modèle → textures → LOD → upload →
    insertion ;
  - `roblox-lod` : budgets de triangles, génération et bascule des LOD ;
  - `roblox-ui` : interfaces de jeu natives au style cartoon Roblox (cadres
    épais, dégradés, badges), jamais des pages web ;
  - `roblox-audio` : recherche de sons libres de droits, licences, préparation,
    upload Roblox et câblage des `Sound` dans Studio.
- Deux connexions MCP prêtes à l’emploi apparaissent dans **Extensions →
  Serveurs MCP** : **Blender** et **Roblox Studio**.
- Le pipeline lit l’identifiant de package renvoyé par le plugin et l’utilise
  avec `insert_asset` pour insérer le modèle dans Studio.
- L’agent doit prendre et **examiner** une capture après chaque étape visuelle :
  `look` dans Blender, `screen_capture` dans Studio. Un modèle ou une interface
  n’est pas déclaré correct sans capture inspectée.

L’agent reste soumis aux confirmations et aux réglages de permissions. Il ne
publie pas un asset sans que la demande le justifie.

## Prérequis

1. **Blender 3.2 ou plus récent**, avec le plugin officiel
   [Roblox Blender Plugin](https://github.com/Roblox/roblox-blender-plugin/releases).
   Installe le fichier ZIP via `Edit > Preferences > Add-ons > Install from
   Disk`, active `Upload to Roblox`, clique sur `Install Dependencies`, puis
   redémarre Blender.
2. **Roblox Studio** ouvert sur le jeu cible, avec le serveur MCP Studio
   disponible.
3. **Serveur MCP Blender** : `uvx mcp-for-blender`.
4. **Serveur MCP Roblox Studio** : `cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat`.

Dans **Extensions → Serveurs MCP**, clique sur **Ajouter Blender** et **Ajouter
Roblox Studio**. Les deux cartes passent à « Connecté » quand les applications
répondent. Si une commande est installée ailleurs, ouvre `mcp.json` et adapte le
chemin.

## Ouvrir n’importe quelle application

La section **Applications** de la même page sert aussi de lanceur général :

- un champ de recherche filtre les applications du **menu Démarrer**, les
  applications du **Microsoft Store**, les **jeux Steam** et les raccourcis de
  bureau installés ;
- un clic sur un résultat ouvre l’application ;
- **Ouvrir un fichier…** lance un `.exe`, `.lnk` ou `.url` précis.

La liste est lue avec `Get-StartApps` puis mise en cache 60 secondes ; le bouton
d’actualisation de la page force sa mise à jour. La recherche ignore les accents
et la casse. L’agent dispose du même pouvoir avec l’outil `open_app`
(`{"name":"Calculatrice"}`, `{"appId":"..."}` ou `{"path":"C:\\...\\outil.exe"}`).
Pour ouvrir un fichier ou dossier du projet dans une application, il peut utiliser
`open_in` (`{"path":"src/app.js","app":"vscode"}`) ou passer `target` à
`open_app` (`{"name":"Visual Studio Code","target":"src/app.js"}`). Les chemins
relatifs sont résolus depuis le projet ouvert.
Une application désignée par `name` doit être unique : si plusieurs noms
correspondent, le résultat liste les candidats au lieu d’en ouvrir un au hasard.

## Ouvrir Blender et Roblox Studio

La partie haute de la section **Applications** détecte les installations de
Blender et Roblox Studio et permet de les démarrer sans chercher le fichier à la
main :

- **Ouvrir** lance l’application détectée, ou indique qu’elle tourne déjà ;
- **Choisir l’exécutable…** enregistre un chemin précis (installation portable,
  autre disque) ;
- **Chemin auto** revient à la détection automatique.

La détection combine le chemin choisi, les installations classiques
(`Program Files\Blender Foundation`, `%LOCALAPPDATA%\Roblox\Versions`), les
bibliothèques **Steam** lues dans `libraryfolders.vdf`, le `PATH`, Scoop et
Chocolatey. L’agent peut aussi lancer les applications avec l’outil
`open_program` quand un MCP ne répond pas parce que l’application est fermée.

Les chemins choisis sont conservés dans `settings.json` sous `programPaths`.

## Connexion au plugin Roblox

Le plugin utilise OAuth dans le navigateur. Dans Blender :

1. `N` dans la vue 3D, onglet **Roblox**.
2. **Log in**, autorise le compte ou le groupe qui doit recevoir les assets.
3. Choisis **Upload to**.

L’application ne demande jamais et ne stocke jamais tes identifiants Roblox.
Si la session n’est pas ouverte, l’agent s’arrête et te demande de te connecter.

## Déroulement d’une demande

Exemple : « Crée une lampe de rue stylisée et importe-la dans mon jeu. »

1. Diagnostic : version de Blender, addon MCP, login du plugin, instance Studio.
2. Modélisation dans Blender : collection dédiée, nom en `PascalCase`, origine au
   sol, transformations appliquées, matériaux Principled BSDF, UV propres.
3. Captures Blender à chaque étape (blocage, modèle, UV/matériaux, corrections) :
   `look`, puis examen réel de l’image. Les défauts visibles sont corrigés avant
   de continuer.
4. Génération des LOD :
   - LOD0 = modèle complet ;
   - LOD1 ≈ 50 % des triangles ;
   - LOD2 ≈ 25 % ;
   - LOD3 ≈ 10 %, minimum 64 triangles.
5. Upload de chaque LOD avec `bpy.ops.rbx.upload()`. Le plugin enregistre
   l’identifiant dans la propriété **`Roblox Package ID`**.
6. Insertion dans Studio avec `insert_asset` (`assetType: Package`, puis `Model`
   si nécessaire), sous `Workspace` ou dans un dossier existant.
7. Vérification avec `inspect_instance`, `screen_capture` puis examen de la
   capture, et `get_console_output`. Un défaut visible se corrige dans Blender,
   puis on réuploade et on réinsère.
8. Compte rendu : triangles par LOD, identifiants de package, chemins dans
   Studio, captures prises, défauts corrigés et points restant à tester en jeu.

## LOD : ce qu’il faut savoir

Roblox applique déjà son propre LOD automatique aux `MeshPart`. Les LOD générés
ici servent à contrôler la silhouette, préparer une boutique, alléger du décor
répété ou faire une bascule mobile/qualité. Une bascule explicite nécessite un
script : le skill `roblox-lod` fournit un modèle de `LocalScript` à adapter.

Budgets par défaut :

| LOD | Part | Héros | Standard | Petit prop |
| --- | --- | --- | --- | --- |
| LOD0 | 100 % | 20 000 | 8 000 | 2 000 |
| LOD1 | 50 % | 10 000 | 4 000 | 1 000 |
| LOD2 | 25 % | 5 000 | 2 000 | 500 |
| LOD3 | 10 % | 2 000 | 800 | 64 |

## Interfaces de jeu : natives, pas un site web

Une interface de jeu Roblox n’est pas de la 3D et ne se construit pas comme une
page web. Le skill `roblox-ui` impose :

- des objets GUI natifs dans `StarterGui` (`ScreenGui`, `Frame`, `ImageLabel`,
  `UIStroke`, `UICorner`, `UIGradient`, `UIGridLayout`, etc.) ;
- le style cartoon des jeux Roblox : panneaux arrondis à contour sombre, ombres
  décalées, dégradés saturés, badges de rareté, pastilles de monnaie, gros
  textes blancs avec contour ;
- aucun HTML/CSS, aucun tableau de bord blanc, aucun petit texte de site web ;
- une capture `screen_capture` examinée après chaque étape et sur plusieurs
  tailles d’écran, dont le téléphone en portrait et en paysage.

## Textures dans Blender

Les textures font partie de la modélisation, pas d’une étape séparée dans
Studio :

- UV dépliés avant tout bake (une UV map, pas de chevauchement non voulu) ;
- matériaux **procéduraux** (bruit, Voronoi, vagues, rampes de couleur) pour la
  roche, le métal, le bois ou l’herbe ;
- **bake Cycles** en PNG 1024 × 1024 quand Roblox doit recevoir l’image :
  couleur, normale, rugosité, métal ;
- cartes conservées sur chaque LOD, puis `SurfaceAppearance` (`ColorMap`,
  `NormalMap`, `RoughnessMap`, `MetalnessMap`) ou `TextureID` dans Studio.

L’agent vérifie le résultat avec `look` après le bake et après l’application
dans Studio : texture étirée, couture visible, normale inversée ou carte
manquante doivent être corrigées. Pas d’image trouvée au hasard : une texture
externe doit avoir une licence claire.

## Sons et ambiance

Le skill `roblox-audio` couvre les bruits d’arme, impacts, pas, portes et
ambiances :

- l’agent **cherche lui-même** des sons libres de droits (Freesound, Pixabay,
  Kenney, Mixkit, OpenGameArt) et note la licence dans
  `assets/audio/LICENCES.md` ; il peut aussi fabriquer un son simple par
  synthèse (whoosh, impact, vent) ;
- les fichiers sont préparés dans `assets/audio/` (mono 44,1 kHz, boucle propre
  pour une ambiance, nommage explicite) ;
- **un son ne joue en jeu qu’après un upload Roblox** : Creator Dashboard →
  Assets → Audio, puis l’ID est câblé dans un `Sound` (avec `SoundGroup`,
  volume, boucle, `RollOffMaxDistance`). L’application ne peut pas téléverser
  l’audio à ta place : l’agent te donne les fichiers prêts et la liste à
  envoyer, puis reprend avec les IDs ;
- l’agent ne peut pas **entendre** le résultat : il vérifie les propriétés et
  le déclenchement, la validation finale se fait à l’oreille.

## Dépannage

- **« Could not connect to Blender »** : ouvre Blender, vérifie que l’addon MCP
  est actif et que `uvx mcp-for-blender` démarre.
- **`rbx.upload` absent** : le plugin n’est pas installé ou Blender n’a pas été
  redémarré après l’installation.
- **« Non connecté au plugin Roblox »** : clique sur **Log in** dans l’onglet
  Roblox de Blender.
- **Upload bloqué** : ne bloque jamais Blender avec `time.sleep`. L’upload est
  asynchrone ; relance un appel MCP plus tard pour lire
  `num_objects_uploading` et `Roblox Package ID`.
- **Insertion impossible** : vérifie que l’asset appartient au créateur
  sélectionné, puis essaie `assetType: Model` au lieu de `Package`.
- **Aucune instance Studio** : ouvre le jeu dans Studio avant de demander
  l’insertion.

Les skills intégrés sont en lecture seule. Pour les personnaliser, crée un skill
utilisateur ou projet avec le même nom : il remplace le skill intégré. Tu peux
aussi désactiver un skill intégré depuis **Mes skills** ; le réglage est
conservé dans `settings.json` (`disabledBuiltinSkills`).
