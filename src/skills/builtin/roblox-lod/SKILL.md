---
name: roblox-lod
description: Définir les budgets de triangles, générer les LOD 0 à 3 dans Blender, les vérifier et les utiliser dans Roblox Studio (auto-LOD ou bascule par distance).
---

# LOD Roblox

À utiliser avec le skill `roblox-blender`. La géométrie est toujours produite
dans Blender ; Studio ne reçoit que des assets déjà préparés.

En mode local, `roblox_asset` génère les quatre LOD dans
`assets/models/<id>/` et consigne les comptes de triangles dans `report.json`
et `assets/library.json`. Vérifie ces valeurs et examine `preview.png` avant de
déclarer un modèle terminé ; les indications ci-dessous restent la référence
pour corriger une spécification ou préparer une bascule manuelle.

## 1. Budgets

| Niveau | Part du LOD0 | Usage | Plafond conseillé |
| --- | --- | --- | --- |
| LOD0 | 100 % | vue proche, capture, boutique | 20 000 tris (héros), 8 000 (standard), 2 000 (petit prop) |
| LOD1 | 50 % | distance moyenne | 10 000 / 4 000 / 1 000 |
| LOD2 | 25 % | distance lointaine | 5 000 / 2 000 / 500 |
| LOD3 | 10 % | très loin, foule, mobile | 2 000 / 800 / 64 minimum |

Règles :

- Chaque LOD doit être **strictement plus léger** que le précédent.
- Le LOD3 doit rester reconnaissable à sa silhouette ; sinon, remonte à 15 %.
- Ne descend pas sous 64 triangles pour un objet visible.
- Un modèle destiné à être répété des centaines de fois vise le bas de la
  fourchette, pas le haut.
- Les LOD partagent les mêmes matériaux et les mêmes UV autant que possible.

## 2. Génération dans Blender

Utilise le modificateur **Decimate** en mode `COLLAPSE` avec
`use_collapse_triangulate = True`, applique-le, puis vérifie le nombre de
triangles. Pour un mesh riggé, décime avant le rig ou conserve les vertex
groups ; sinon l'animation casse.

```python
import bpy

def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)

def decimate_copy(source_name, ratio, suffix):
    src = bpy.data.objects[source_name]
    col = bpy.data.collections.get(f"{source_name}_LODs")
    if col is None:
        col = bpy.data.collections.new(f"{source_name}_LODs")
        bpy.context.scene.collection.children.link(col)
    dup = src.copy()
    dup.data = src.data.copy()
    dup.name = f"{source_name}_{suffix}"
    dup.data.name = f"{src.data.name}_{suffix}"
    col.objects.link(dup)
    for modifier in list(dup.modifiers):
        dup.modifiers.remove(modifier)
    modifier = dup.modifiers.new("RobloxLOD", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    for other in bpy.context.view_layer.objects:
        other.select_set(False)
    dup.select_set(True)
    bpy.context.view_layer.objects.active = dup
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    dup.select_set(False)
    print(dup.name, triangles(dup))
    return dup

# decimate_copy("StreetLamp", 0.5, "LOD1")
# decimate_copy("StreetLamp", 0.25, "LOD2")
# decimate_copy("StreetLamp", 0.1, "LOD3")
```

Après génération :

1. Vérifie les compteurs et la hiérarchie des collections.
2. Prends une capture `look` de **chaque** LOD, surtout du LOD3, et compare-la
   au LOD0. La silhouette doit rester reconnaissable, sans trou ni face cassée.
   Si un LOD est dégénéré, augmente son ratio et régénère-le.
3. Vérifie les UV et les matériaux (pas de texture cassée) sur les captures.
4. Vérifie les normales, l'absence de trous et les faces noires.
5. Corrige, régénère et reprends la capture avant de passer au LOD suivant.

## 3. Nommage et upload

- `Nom_LOD0`, `Nom_LOD1`, `Nom_LOD2`, `Nom_LOD3`.
- **Pipeline local (plugin Roblox)** : `roblox_asset action:upload` envoie le
  LOD0 comme `Model` avec le compte connecté dans le plugin ; Roblox applique
  son propre LOD et les LOD1–LOD3 restent locaux pour une bascule manuelle.
- **Variante graphique** : un package par LOD, l'identifiant est enregistré dans
  `Roblox Package ID` ; upload dans l'ordre LOD0 → LOD3, puis insertion dans
  Studio.
- Ne réuploade pas un LOD inchangé : le package crée une nouvelle version.

## 4. Auto-LOD Roblox ou LOD explicites ?

Roblox génère automatiquement des LOD pour les `MeshPart` selon la distance et
les performances. Pour la majorité des assets, c'est suffisant : fournis un
LOD0 propre et laisse le moteur faire le reste.

Fournis des LOD explicites quand l'utilisateur demande :

- une silhouette contrôlée à distance ;
- des assets séparés pour une boutique ou un catalogue ;
- une bascule mobile/qualité ;
- un décor répété où chaque triangle compte.

Dans ce cas, insère les modèles dans Studio et ajoute un script de bascule.
Exemple de `LocalScript` à placer dans `StarterPlayerScripts` :

```lua
-- Adapte les chemins et les distances à ton jeu.
local RunService = game:GetService("RunService")
local camera = workspace.CurrentCamera
local root = workspace:WaitForChild("StreetLamp_LODs")

local levels = {
    { model = root:WaitForChild("StreetLamp_LOD0"), distance = 0 },
    { model = root:WaitForChild("StreetLamp_LOD1"), distance = 80 },
    { model = root:WaitForChild("StreetLamp_LOD2"), distance = 220 },
    { model = root:WaitForChild("StreetLamp_LOD3"), distance = 500 },
}

local function update()
    local focus = camera and camera.CFrame.Position
    if not focus then return end
    local active = levels[1]
    for _, level in ipairs(levels) do
        if (level.model:GetPivot().Position - focus).Magnitude >= level.distance then
            active = level
        end
    end
    for _, level in ipairs(levels) do
        level.model.Parent = level == active and root or nil
    end
end

RunService.RenderStepped:Connect(update)
```

Notes :

- Les modèles doivent être des `Model`/`MeshPart` distincts, pas des clones
  créés à la volée à chaque frame.
- Ne déplace pas les modèles hors de `workspace` si des scripts les référencent.
- Pour un serveur autoritaire, garde la logique de collision sur le LOD0.
- Vérifie avec `execute_luau` et `screen_capture`.

## 5. Vérification finale

- Tableau des triangles LOD0→LOD3, avec le ratio réel.
- Capture Blender (`look`) et capture Studio (`screen_capture`).
- Aucun LOD vide, aucun matériau manquant, aucun mesh noir.
- Les identifiants de package sont notés.
- Le compte rendu distingue ce qui est vérifié de ce qui reste à tester en jeu.
