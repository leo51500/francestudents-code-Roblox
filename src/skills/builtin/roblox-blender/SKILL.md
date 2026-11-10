---
name: roblox-blender
description: Créer, importer, modifier et livrer un modèle 3D Roblox : Blender est la seule source de géométrie, génération des LOD, import GLB/glTF/FBX/OBJ/STL/BLEND, upload avec le compte connecté dans le plugin Roblox, puis insertion dans Studio.
---

# Roblox + Blender — pipeline 3D

Ce skill décrit le seul pipeline autorisé pour un modèle 3D Roblox.
Blender produit la géométrie, les UV, les matériaux et les LOD. Roblox Studio
ne sert qu'à insérer, placer, scripter et vérifier le résultat.

## 0. Mode local d'abord

Le pipeline ne dépend pas d'un MCP pour produire le modèle : `roblox_asset`
enregistre `assets/specs/<id>.json` ou importe un fichier existant avec
`action:import` (GLB, glTF, FBX, OBJ, STL, BLEND) dans `assets/sources/`, lance
Blender en arrière-plan (`--background --factory-startup`) et écrit
`assets/models/<id>/lod0..3.glb`, les textures PNG, `preview.png` et
`report.json`. `roblox_game` gère le projet Rojo, la validation et le build
`build/<slug>.rbxlx`. `roblox_asset` `action:upload` envoie le LOD0 avec le
compte déjà connecté dans le plugin Roblox Blender, sans clé Open Cloud. Les
sections MCP ci-dessous servent à intervenir sur une scène ouverte et à insérer
les modèles ; elles ne sont pas nécessaires pour créer les fichiers ni pour
uploader.

## 0 bis. Importer un modèle existant

Utilise `action:import` quand l'utilisateur fournit déjà un fichier 3D :

```text
roblox_asset {"action":"import","path":"C:/Users/moi/Downloads/chest.glb","id":"chest","height":1.2}
```

- Le fichier source est copié dans `assets/sources/` et n'est jamais modifié.
  Pour un `.gltf`, ses buffers et textures externes suivent dans le même
  dossier afin que l'import reste complet.
- Blender fusionne les maillages, applique la rotation puis l'échelle (`height`
  en mètres, mesurée sur l'axe Z après rotation, ou `scale`), recalcule les
  normales, ajoute un UV si nécessaire, puis génère LOD0–LOD3 et un aperçu.
- Si les textures d'origine existent, l'aperçu utilise le rendu `TEXTURE` ;
  sinon un matériau neutre est appliqué.
- Après l'import, examine `preview.png` avec `view_image`. Si l'échelle est
  fausse, relance `action:import` avec `height` ou `scale` ; ne redimensionne
  jamais le modèle à la main dans Studio.
- Les armatures et animations ne sont pas conservées : le modèle devient un
  maillage statique. Pour un personnage animé, garde le rig dans Blender et
  exporte-le séparément.

## 1. Règles absolues

- **Le routage vers Blender est automatique, même sans le mot « Blender ».** Dès
  qu'une demande contient de la 3D réelle (modèle, mesh, personnage, avatar,
  accessoire, arme, outil, véhicule, décor, prop, item, créature, bâtiment,
  arbre, rocher, effet 3D, map ou niveau à composer), la géométrie se crée dans
  Blender. En cas de doute, choisir Blender.
- **Aucun modèle 3D n'est créé dans Studio.** Ne pas utiliser `generate_mesh`,
  `generate_procedural_model`, `generate_scene`, `generate_avatar`,
  `segment_mesh`, ni des `Part`/`MeshPart` assemblées pour fabriquer un modèle.
  Les outils de génération de Studio sont interdits pour la modélisation, même
  comme brouillon. Ne jamais remplacer un asset Blender par une approximation
  en Parts.
- **Blender est la source de vérité.** Toute retouche de forme, d'UV, de matériau
  ou de topologie se fait dans Blender, puis se réuploade.
- **Les LOD sont obligatoires** pour tout modèle visible en jeu : LOD0, LOD1,
  LOD2 et LOD3. Voir le skill `roblox-lod` pour les budgets et la bascule.
- **Preuve visuelle obligatoire.** Après chaque étape de modélisation, chaque LOD
  et chaque insertion, prends une capture avec `look` (Blender) ou
  `screen_capture` (Studio), regarde-la réellement et corrige les défauts avant
  de continuer. Sans capture inspectée, le modèle n'est pas déclaré correct. Si
  la capture échoue, dis-le au lieu d'affirmer avoir vu.
- **Les interfaces ne sont pas de la 3D.** Une UI de jeu se construit dans Studio
  avec les objets GUI natifs et le skill `roblox-ui` (cadres épais, dégradés,
  badges, style cartoon Roblox). Jamais en HTML/CSS ni comme un site web.
- **Studio reste autorisé** pour `insert_asset`, `execute_luau`, `inspect_instance`,
  `screen_capture`, le placement, les scripts et l'interface. Ne jamais y générer
  la géométrie.
- **Ne publie pas sans demande explicite.** Uploader un asset le rend visible dans
  l'inventaire du créateur : demande confirmation si l'utilisateur n'a pas demandé
  clairement « importe / publie / upload ».
- **Ne demande jamais d'identifiants Roblox.** Le plugin utilise une connexion
  OAuth dans le navigateur. Si la session n'est pas ouverte, lance
  `roblox_asset {"action":"login"}` : l'outil ouvre la page Roblox et enregistre
  la session. Si le navigateur ne s'ouvre pas, alors seulement, demande à
  l'utilisateur de cliquer sur « Log in » dans Blender. La clé Open Cloud reste
  une option (`provider:"opencloud"`) : ne l'écris jamais dans le projet et ne
  la répète jamais dans une réponse.

## 2. Diagnostic avant d'agir

C'est à l'agent d'ouvrir les applications, pas à l'utilisateur. Avant de
conclure qu'un MCP est indisponible, ouvre le programme avec
`open_program` (`"blender"` ou `"robloxStudio"`), attends quelques secondes,
puis relance le diagnostic. Ne demande à l'utilisateur d'ouvrir Blender ou
Studio que si le programme reste introuvable.

1. Vérifie le MCP Blender :
   - `get_addon_status` : version de Blender, addon MCP connecté.
   - `get_scene_info` : objets, sélection, unités, santé des meshes.
   - Si le MCP ne répond pas : `open_program {"program":"blender"}`, attends le
     démarrage, puis relance `get_addon_status`. Si Blender reste introuvable,
     demande son chemin ; ne fabrique pas le modèle dans Studio.
2. Vérifie le plugin Roblox dans Blender :
   ```python
   import bpy
   print("rbx.upload" in dir(bpy.ops.rbx))
   print(hasattr(bpy.context.window_manager, "rbx"))
   print(getattr(bpy.context.window_manager.rbx, "is_logged_in", False))
   ```
   Si `rbx.upload` manque : le plugin `Upload to Roblox` n'est pas installé.
   Explique l'installation depuis
   <https://github.com/Roblox/roblox-blender-plugin/releases> et arrête-toi.
   Si `is_logged_in` est faux : lance `roblox_asset {"action":"login"}` toi-même.
   Si le navigateur ne s'ouvre pas, demande alors à l'utilisateur de se connecter
   via `N` > onglet `Roblox` > `Log in`, puis reprends. Ne continue pas sans login.
3. Vérifie le MCP Roblox Studio : `list_roblox_studios`. S'il n'y a aucune
   instance : `open_program {"program":"robloxStudio"}`, attends le démarrage,
   puis relance `list_roblox_studios`. Ne prétends jamais avoir inséré un objet
   sans résultat d'outil.
4. Si un des deux MCP manque malgré l'ouverture de l'application, indique
   précisément lequel et propose `docs/roblox-blender.md`. Ne contourne pas le
   pipeline.

## 3. Cadrage du modèle

Avant de modéliser, fixe et annonce :

- **Nom** : `PascalCase`, sans accent ni espace (ex. `StreetLamp`). Les LOD
  s'appellent `StreetLamp_LOD0`, `StreetLamp_LOD1`, etc.
- **Échelle** : travaille en mètres Blender. Le plugin applique l'échelle
  d'export (0,01) vers les studs Roblox. Un humain Roblox mesure environ
  5,5 studs de haut ; un prop standard tient dans 1 à 4 studs.
- **Orientation** : modèle face à `-Y` dans Blender, pieds/Base à `Z = 0`,
  origine au centre de la base. Applique les transformations (`Ctrl+A` >
  `All Transforms`) avant l'export.
- **Budget LOD0** : 20 000 triangles maximum pour un modèle héros, 8 000 pour
  un objet standard, 2 000 pour un petit prop. Si la demande est plus lourde,
  préviens et propose un découpage.
- **Matériaux** : un matériau Principled BSDF par surface logique, couleurs en
  `Base Color`, textures dans l'image. Évite les matériaux émissifs inutiles.
- **Topologie** : quads propres, normales vers l'extérieur, pas de faces
  inversées, pas de géométrie cachée. Vérifie avec `look` à la fin.

Ne supprime jamais le travail existant de l'utilisateur. Crée une collection
dédiée au modèle (ex. `StreetLamp`) et travaille dedans.

## 4. Modélisation dans Blender

Écris les scripts et fichiers de travail avec des **chemins relatifs au
projet** (ex. `models/StreetLamp.py`), jamais avec un chemin absolu
`C:\...` dans les outils de fichiers. Un chemin absolu situé dans le projet
est converti, mais un chemin hors du projet est refusé.

Utilise `execute_blender_code` par petites étapes vérifiables. Exemple de
création d'une collection et d'un mesh simple :

```python
import bpy
col = bpy.data.collections.get("StreetLamp") or bpy.data.collections.new("StreetLamp")
if col.name not in bpy.context.scene.collection.children:
    bpy.context.scene.collection.children.link(col)

mesh = bpy.data.meshes.new("StreetLamp_Mesh")
obj = bpy.data.objects.new("StreetLamp", mesh)
col.objects.link(obj)
# Construis la géométrie avec bmesh, puis :
obj.data.update()
```

Pour les formes complexes, utilise `bmesh` (extrusions, bevel, boolean propre),
pas une accumulation de cubes non soudés. Vérifie après chaque étape :

```python
import bpy
for obj in bpy.context.selected_objects:
    print(obj.name, obj.type, len(obj.data.vertices) if obj.type == "MESH" else "-")
```

Puis regarde le résultat avec l'outil `look` (vue `viewport`, cible le modèle).
Ne dis pas que le modèle est correct sans l'avoir vu ou sans mesures.

### Captures de contrôle obligatoires

Prends une capture après **chaque** étape qui change la silhouette ou la
surface, pas seulement à la fin :

1. blocage des volumes et proportions ;
2. forme principale terminée ;
3. UV et matériaux appliqués ;
4. après chaque correction importante ;
5. pour chaque LOD ;
6. après l'insertion dans Studio.

Pour chaque capture, vérifie réellement :

- la silhouette et les proportions par rapport à l'échelle Roblox (humain
  ≈ 5,5 studs) ;
- les faces inversées, les trous, les normales noires ou les surfaces qui
  brillent anormalement ;
- les textures étirées, décalées ou manquantes ;
- les pièces qui se traversent, flottent ou sont décalées ;
- l'orientation : face vers `-Y`, base à `Z = 0`, origine au centre de la base ;
- la lisibilité du LOD le plus bas.

Corrige immédiatement tout défaut visible, puis reprends une capture. Si l'outil
`look` échoue, indique l'erreur exacte et ne prétends pas avoir contrôlé le
rendu.

### Textures : procédural, bake et export Roblox

Les textures se créent **dans Blender**, jamais en important une image trouvée
au hasard. Trois méthodes, dans cet ordre selon la demande :

1. **Couleurs et matériaux simples** : Principled BSDF, `Base Color`, rugosité,
   sans image. C'est le plus léger pour un prop stylisé.
2. **Textures procédurales** : nœuds `Noise`, `Voronoi`, `Wave`, `Musgrave`,
   `ColorRamp` et `Bump` pour la roche, le métal, le bois, l'herbe. Aucun
   fichier externe, rendu cohérent à toutes les échelles.
3. **Bake en image** quand Roblox doit recevoir une texture : cuis les
   procéduraux en PNG pour obtenir un rendu identique dans Studio.

Avant tout bake :

- déplie les UV (`U` > Smart UV Project ou seams manuels), une seule UV map,
  pas de chevauchement sauf symétrie voulue ;
- vérifie la densité de texels (assez de pixels pour le détail visible, pas de
  zones étirées) ;
- garde les UV sur **chaque LOD** : un LOD sans UV perd sa texture.

Bake Cycles (exemple pour un matériau `Sword`) :

```python
import bpy

img = bpy.data.images.new("Sword_BaseColor", 1024, 1024, alpha=False)
mat = bpy.data.materials["Sword"]
node = mat.node_tree.nodes.new("ShaderNodeTexImage")
node.image = img
mat.node_tree.nodes.active = node

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=8, use_clear=True)
img.filepath_raw = "//textures/Sword_BaseColor.png"
img.file_format = "PNG"
img.save()
```

Répète pour les cartes utiles : `NORMAL` (espace tangent), `ROUGHNESS`,
`METALNESS` si nécessaire. Pour les cartes de données, crée l'image en
**non-color** (`img.colorspace_settings.name = "Non-Color"`), sinon les
valeurs sont faussées.

Contraintes Roblox :

- **1024 × 1024 maximum** par texture (Roblox réduit au-delà), PNG ;
- pas d'alpha sauf pour un décalque (decal) ; évite l'émission inutile ;
- une à deux jeux de textures par prop suffisent ; les noms doivent être
  explicites (`Sword_BaseColor.png`, `Sword_Normal.png`) ;
- dans Studio, applique un `SurfaceAppearance` sur le `MeshPart` :
  `ColorMap`, `NormalMap`, `RoughnessMap`, `MetalnessMap` ; sinon
  `TextureID` pour une texture simple.

Vérifie le résultat avec `look` après le bake et après l'application dans
Studio : texture étirée, couture visible, normal inversé ou carte manquante
doivent être corrigés avant de déclarer le modèle terminé.

## 5. LOD (obligatoire)

Charge aussi le skill `roblox-lod`. Résumé du pipeline :

- LOD0 = mesh d'origine, budget complet.
- LOD1 = 50 % des triangles.
- LOD2 = 25 %.
- LOD3 = 10 % (minimum 64 triangles).
- Conserve les UV et les matériaux. Pour un mesh riggé, décime avant le rig
  ou conserve les vertex groups ; ne casse pas les poids.
- Place chaque LOD dans la collection `Nom_LODs`, avec un nom explicite.

Script de génération (à exécuter dans Blender, puis vérifier les compteurs) :

```python
import bpy

def triangle_count(obj):
    if obj.type != "MESH":
        return 0
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)

def make_lods(source_name, ratios=(0.5, 0.25, 0.1), min_triangles=64):
    src = bpy.data.objects.get(source_name)
    if not src or src.type != "MESH":
        raise RuntimeError(f"Mesh introuvable : {source_name}")
    col = bpy.data.collections.get(f"{source_name}_LODs")
    if col is None:
        col = bpy.data.collections.new(f"{source_name}_LODs")
        bpy.context.scene.collection.children.link(col)
    base_tris = triangle_count(src)
    out = []
    for index, ratio in enumerate(ratios, start=1):
        dup = src.copy()
        dup.data = src.data.copy()
        dup.name = f"{source_name}_LOD{index}"
        dup.data.name = f"{src.data.name}_LOD{index}"
        col.objects.link(dup)
        for modifier in list(dup.modifiers):
            dup.modifiers.remove(modifier)
        modifier = dup.modifiers.new("RobloxLOD", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = max(1.0, min_triangles) / max(1, base_tris) if base_tris * ratio < min_triangles else ratio
        modifier.use_collapse_triangulate = True
        for other in bpy.context.view_layer.objects:
            other.select_set(False)
        dup.select_set(True)
        bpy.context.view_layer.objects.active = dup
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        dup.select_set(False)
        out.append((dup.name, triangle_count(dup)))
    print("LODs:", out)
    return out

# Exemple :
# make_lods("StreetLamp")
```

Vérifie que chaque LOD est strictement plus léger que le précédent et que le
LOD3 reste lisible. Si un LOD est vide ou dégénéré, augmente le minimum de
triangles et recommence. Regarde **chaque** LOD avec `look`, comparé au LOD0 :
la silhouette doit rester reconnaissable, sans trou ni face cassée. Une capture
par LOD est obligatoire ; joins les captures au compte rendu.

## 6. Upload avec le plugin Roblox

La méthode par défaut ne demande **aucune clé Open Cloud** : `roblox_asset`
`action:upload` recharge le refresh token OAuth du plugin **Upload to Roblox**
installé dans Blender, puis appelle l'API Assets avec ton compte.

1. Vérifie la connexion, sans rien envoyer :

```text
roblox_asset {"action":"plugin"}
```

La réponse donne l'utilisateur, les créateurs disponibles et le créateur
sélectionné. Si elle contient `needs_login: true`, rétablis la session sans
ouvrir Blender :

```text
roblox_asset {"action":"login"}
```

La page Roblox s'ouvre dans le navigateur ; il faut cliquer **Autoriser**. Le
script attend le retour sur `localhost:8181`, réenregistre le refresh token dans
les préférences du plugin et sauvegarde celles-ci (le jeton tourne à chaque
utilisation). Si le navigateur ne s'ouvre pas, le bouton **Log in** du panneau
Roblox dans Blender reste l'alternative.

2. Envoie le modèle :

```text
roblox_asset {"action":"upload","id":"chest"}
```

L'outil renvoie un `assetId`, la révision, la modération, met à jour
`assets/library.json` et écrit `src/shared/AssetIds.luau`. C'est cet `assetId`
réel qu'il faut citer ; ne l'invente jamais. Les LOD1–LOD3 restent locaux ;
Roblox applique son propre LOD.

3. Pour un son préparé :

```text
roblox_asset {"action":"audio","path":".../sword_swing_01.ogg","id":"sword-swing-01"}
roblox_asset {"action":"upload","id":"sword-swing-01"}
```

Le même compte OAuth envoie le fichier comme `Audio`. Les règles Roblox
(vérification du compte, quotas, modération) peuvent le refuser : rapporte
l'erreur exacte et propose alors l'envoi manuel depuis le Creator Dashboard.

Variante graphique MCP : le plugin expose aussi `bpy.ops.rbx.upload()` dans
Blender ouvert et enregistre l'identifiant dans **`Roblox Package ID`**. Elle
reste utile pour sélectionner plusieurs objets à la main. L'upload est
asynchrone : ne bloque jamais la boucle principale avec `time.sleep`.

Option `provider: "opencloud"` : utilise une clé API Open Cloud à la place du
plugin. À ne proposer que si le plugin n'est pas installé ; ce n'est pas le
chemin par défaut.

Sélectionne les objets (LOD0 et LOD1..3), puis lance l'upload :

```python
import bpy

def upload_to_roblox(object_names):
    wm = bpy.context.window_manager
    if not hasattr(wm, "rbx"):
        raise RuntimeError("Panneau Roblox non initialisé : ouvre 3D View > N > Roblox une fois.")
    if not wm.rbx.is_logged_in:
        raise RuntimeError("Non connecté au plugin Roblox : connecte-toi dans Blender, puis relance.")
    targets = [bpy.data.objects[name] for name in object_names if name in bpy.data.objects]
    if not targets:
        raise RuntimeError("Aucun objet à uploader.")
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    for obj in targets:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    area = next((a for a in bpy.context.screen.areas if a.type == "VIEW_3D"), None)
    if area is None:
        area = next(iter(bpy.context.screen.areas), None)
    region = next((r for r in (area.regions if area else []) if r.type == "WINDOW"), None)
    if area and region:
        with bpy.context.temp_override(area=area, region=region):
            bpy.ops.rbx.upload()
    else:
        bpy.ops.rbx.upload()
    print("Upload lancé pour", [obj.name for obj in targets])
    print("Attends que num_objects_uploading revienne à 0, puis lis 'Roblox Package ID'.")

# Exemple :
# upload_to_roblox(["StreetLamp_LOD0", "StreetLamp_LOD1", "StreetLamp_LOD2", "StreetLamp_LOD3"])
```

Après l'upload, **reviens plus tard** dans un nouvel appel (laisse Blender
respirer entre deux appels MCP) et lis le résultat :

```python
import bpy, json
wm = bpy.context.window_manager
names = ["StreetLamp_LOD0", "StreetLamp_LOD1", "StreetLamp_LOD2", "StreetLamp_LOD3"]
statuses = {}
for status in getattr(wm.rbx, "upload_statuses", []):
    target = status.target_object
    if target:
        statuses[target.name] = {"text": status.text, "icon": status.icon}
report = {
    "pending": int(getattr(wm.rbx, "num_objects_uploading", 0)),
    "objects": {
        name: {
            "package_id": str(bpy.data.objects[name].get("Roblox Package ID") or ""),
            "status": statuses.get(name, {}),
        }
        for name in names if name in bpy.data.objects
    },
}
print(json.dumps(report, ensure_ascii=False, indent=2))
```

Répète la lecture (sans bloquer) jusqu'à `pending == 0`. Un `package_id` vide
signifie que l'upload a échoué : lis le statut et corrige (login, sélection,
modificateur, matériau, géométrie). Ne fabrique pas d'identifiant.

## 7. Insertion automatique dans Studio

Pour chaque `package_id` non vide :

1. `insert_asset` avec :
   - `assetId` : l'identifiant du package,
   - `assetName` : le nom du LOD,
   - `assetType` : `Package` (puis `Model` si le serveur refuse),
   - `parentPath` : par défaut `Workspace` ; sinon un dossier existant,
   - `studio_id` : l'instance renvoyée par `list_roblox_studios`.
2. Vérifie l'insertion :
   - `inspect_instance` sur le chemin retourné (taille, orientation, matériaux,
     ancrage, collisions) ;
   - `screen_capture` puis **examen réel** de l'image : échelle par rapport au
     joueur, orientation, couleurs, textures, objet qui flotte ou traverse le
     sol ;
   - `get_console_output` en cas d'erreur.
   Si la capture montre un défaut, corrige dans Blender (pas dans Studio),
   réuploade, réinsère et reprends une capture.
3. Range les LOD sous un dossier `Nom_LODs` dans `Workspace` si la demande
   veut une hiérarchie propre. Ne déplace pas les objets d'autres utilisateurs.

Si l'insertion échoue, ne réessaie pas en boucle : lis l'erreur, vérifie que
l'asset appartient au bon créateur et que le type (`Package`/`Model`) est bon.

## 8. LOD explicites dans Studio

Roblox applique déjà son LOD automatique aux `MeshPart`. Les LOD générés ici
servent aux cas où l'utilisateur veut une bascule maison (distance, qualité,
mobile) ou des assets séparés. Ne promets pas une bascule automatique sans
script. Fournis un `LocalScript` qui choisit le modèle selon la distance à la
caméra, avec les chemins réels des modèles insérés, et vérifie-le avec
`execute_luau`/`screen_capture`. Détails et modèle de script dans le skill
`roblox-lod`.

## 9. Livraison

Termine avec un compte rendu factuel :

- nom du modèle, collection Blender et source importée le cas échéant ;
- nombre de triangles par LOD ;
- identifiants de package ou `assetId` uploadés, ou erreur exacte ;
- chemin des objets insérés dans Studio ;
- captures prises (étape et LOD) et défauts corrigés ;
- ce qui a été vérifié visuellement et ce qui reste à vérifier.

Si l'utilisateur n'a pas demandé l'upload, arrête-toi après les LOD et dis
clairement que rien n'a été publié.
