"""Outils communs aux scripts Blender de FranceStudent Code Roblox.

Importé par les modèles de src/blender/templates : copie ce fichier (ou ajoute son
dossier à sys.path) puis `import blender_common as bc`.

Conventions Roblox appliquées ici :
- unités en mètres, 1 stud = 0.28 m ;
- origine à la base du modèle, axe +Z vers le haut ;
- catégorie d'objet explicite, normales recalculées, transformations appliquées ;
- export glTF/GLB sans caméra ni lumière.

Géométrie disponible : box, cylinder, sphere, cone, torus, lathe (révolution),
bevel, mirror, boolean_cut, noise. Palette : palette(["bois", "metal", …]) + assign_material
ou assign_palette avant join, puis finish(obj, args, materials=list(materials.values())).
Contrôle visuel : render_preview écrit quatre angles (face, trois-quarts, côté, dessus)
dans une seule image 1024 px ; compare_render mesure la forme (IoU) et les tons (SSIM)
d'un rendu par rapport à une image de référence.
"""

import argparse
import math
import os
import sys

STUDS_TO_METERS = 0.28


def parse_args(description=""):
    """Arguments communs : --name, --output, --triangles, --texture, --no-export."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--name", default="Asset", help="Nom du modèle (mesh principal)")
    parser.add_argument("--output", default="build/models", help="Dossier de sortie (.glb)")
    parser.add_argument("--triangles", type=int, default=0, help="Budget indicatif de triangles (0 = libre)")
    parser.add_argument("--texture", type=int, default=1024, help="Taille maximale des textures exportées")
    parser.add_argument("--scale", type=float, default=1.0, help="Échelle en studs (1 stud = 0.28 m)")
    parser.add_argument("--no-export", action="store_true", help="Ne rien exporter (vérification seulement)")
    parser.add_argument("--render", default="", help="Chemin PNG du rendu de contrôle")
    return parser.parse_args(argv)


def studs(value):
    """Convertit des studs Roblox en mètres Blender."""
    return float(value) * STUDS_TO_METERS


def reset_scene():
    """Repart d'une scène vide, sans dépendre du contexte de l'interface."""
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


def mesh_from_data(name, verts, faces):
    """Crée un mesh propre à partir de listes de sommets/faces."""
    import bpy
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def box(name, sx, sy, sz, location=(0, 0, 0)):
    """Cube aux dimensions données, origine à la base (z=0 = sol)."""
    import bmesh
    import bpy
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.scale = (sx, sy, sz)
    obj.location = (location[0], location[1], location[2] + sz / 2.0)
    bpy.context.collection.objects.link(obj)
    return obj


def cylinder(name, radius, depth, vertices=24, location=(0, 0, 0)):
    import bmesh
    import bpy
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=vertices,
                          radius1=radius, radius2=radius, depth=depth)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (location[0], location[1], location[2] + depth / 2.0)
    bpy.context.collection.objects.link(obj)
    return obj


def join(objects, name):
    """Fusionne plusieurs objets en un seul mesh nommé."""
    import bpy
    objects = [obj for obj in objects if obj and obj.name in bpy.data.objects]
    if not objects:
        raise ValueError("Aucun objet à fusionner.")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    result = bpy.context.view_layer.objects.active
    result.name = name
    result.data.name = name
    return result


def clean(obj, origin_to_base=True, shade_smooth=False):
    """Recalcule les normales, applique les transformations et place l'origine à la base."""
    import bpy
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if shade_smooth:
        bpy.ops.object.shade_smooth()
    if origin_to_base:
        # Origine au centre XY, à la base Z.
        box_corner = [obj.matrix_world @ v.co for v in obj.data.vertices]
        if box_corner:
            min_z = min(v.z for v in box_corner)
            cx = sum(v.x for v in box_corner) / len(box_corner)
            cy = sum(v.y for v in box_corner) / len(box_corner)
            for v in obj.data.vertices:
                v.co.x -= cx
                v.co.y -= cy
                v.co.z -= min_z
    obj.data.update()
    return obj


def triangulate(obj):
    """Triangule le mesh (Roblox ne garde que des triangles)."""
    import bpy
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def triangle_count(obj):
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


def principled_material(name, color, roughness=0.6, metallic=0.0):
    """Matériau principled sans l'attacher à un objet (réutilisable par la palette)."""
    import bpy
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return material


def add_material(obj, name="Roblox", color=(0.8, 0.8, 0.8, 1.0), roughness=0.6):
    """Matériau principled simple, compatible Roblox."""
    material = principled_material(name, color, roughness)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return material


# Palette limitée : bois, métal, feuillage, pierre et accents. Roblox Studio importe un
# MeshPart avec un sous-mesh par matériau : chaque couleur devient une zone coloriée,
# sans texture. Cinq matériaux maximum par modèle, sinon l'asset Manager multiplie les meshes.
PALETTE = {
    "bois": (0.36, 0.22, 0.11, 1.0),
    "bois_clair": (0.52, 0.35, 0.18, 1.0),
    "metal": (0.55, 0.57, 0.60, 1.0),
    "acier_sombre": (0.28, 0.30, 0.33, 1.0),
    "feuillage": (0.21, 0.45, 0.17, 1.0),
    "feuillage_sombre": (0.13, 0.30, 0.12, 1.0),
    "pierre": (0.48, 0.47, 0.44, 1.0),
    "pierre_sombre": (0.31, 0.31, 0.30, 1.0),
    "sable": (0.76, 0.66, 0.45, 1.0),
    "tissu": (0.62, 0.18, 0.16, 1.0),
    "or": (0.82, 0.62, 0.22, 1.0),
}


def palette(colors, prefix="", max_colors=5):
    """Crée les matériaux d'une palette (noms de PALETTE ou tuples RGBA).

    Renvoie un dict nom -> matériau. Au-delà de max_colors, les couleurs en trop sont
    fusionnées dans la dernière : Roblox reste lisible et l'export ne gonfle pas.
    """
    materials = {}
    names = list(colors)[:max_colors]
    for index, entry in enumerate(names):
        rgba = PALETTE.get(entry, entry) if isinstance(entry, str) else tuple(entry)
        if len(rgba) == 3:
            rgba = (*rgba, 1.0)
        label = f"{prefix}{entry if isinstance(entry, str) else 'couleur%d' % index}"
        metallic = 0.75 if isinstance(entry, str) and ("metal" in entry or entry == "or") else 0.0
        roughness = 0.35 if metallic else 0.7
        materials[str(entry)] = principled_material(label, rgba, roughness, metallic)
    return materials


def assign_material(obj, material):
    """Ajoute un matériau (une seule fois) et lui affecte toutes les faces de l'objet."""
    if material.name not in [slot.name for slot in obj.data.materials]:
        obj.data.materials.append(material)
    index = obj.data.materials.find(material.name)
    for poly in obj.data.polygons:
        poly.material_index = index
    return obj


def assign_palette(objects_by_color, materials):
    """Applique plusieurs couleurs avant la fusion (objects_by_color : {couleur: [objets]}).

    join() conserve les matériaux de chaque objet : le mesh final porte plusieurs couleurs.
    """
    for color, objects in objects_by_color.items():
        material = materials.get(str(color))
        if material is None:
            continue
        for obj in objects:
            assign_material(obj, material)
    return materials


def uv_unwrap(obj, angle=66.0, margin=0.02):
    """Dépliage UV automatique (smart project), sans chevauchement volontaire."""
    import bpy
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def export_glb(output_dir, name):
    """Exporte toute la scène en GLB ; renvoie le chemin écrit ou lève une erreur."""
    import bpy
    os.makedirs(output_dir, exist_ok=True)
    target = os.path.abspath(os.path.join(output_dir, f"{name}.glb"))
    kwargs = {
        "filepath": target,
        "export_format": "GLB",
        "use_selection": False,
        "export_apply": True,
        "export_cameras": False,
        "export_lights": False,
        "export_yup": True,
    }
    # Les options varient selon la version : on ignore celles qui n'existent pas.
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        for key in ("export_yup", "export_apply", "export_lights", "export_cameras"):
            bpy.ops.export_scene.gltf(filepath=target, export_format="GLB")
            break
    if not os.path.isfile(target) or os.path.getsize(target) == 0:
        raise RuntimeError(f"L'export GLB n'a rien produit : {target}")
    return target


def scene_bounds():
    """Boîte englobante (min, max, centre, rayon) de tous les meshes de la scène."""
    import bpy
    from mathutils import Vector
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith(("PreviewCamera", "PreviewLight")):
            continue
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    if not points:
        raise RuntimeError("Aucun mesh visible dans la scène : rien à cadrer.")
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    center = (low + high) / 2.0
    radius = max((high - low).length / 2.0, 0.05)
    return low, high, center, radius


# Quatre angles de contrôle : face, trois-quarts, côté et dessus. Ils permettent de juger
# la silhouette (le critère principal en low-poly) aussi bien que les volumes.
PREVIEW_ANGLES = (
    ("face", (0.0, -1.0, 0.18)),
    ("trois-quarts", (1.0, -1.0, 0.75)),
    ("cote", (1.0, 0.0, 0.2)),
    ("dessus", (0.15, -0.3, 1.0)),
)


def _view_camera(name, center, radius, direction, orthographic=False):
    """Caméra orientée vers le centre, reculée pour cadrer tout le modèle.

    `orthographic` force une projection sans perspective (mode silhouette) : les
    proportions restent exactes d'une vue à l'autre.
    """
    import bpy
    from mathutils import Vector
    direction = Vector(direction).normalized()
    # Recul fixe : il laisse de la marge et garde la même échelle entre les quatre vues.
    distance = radius * 3.1
    camera = bpy.data.objects.get(name)
    camera_data = camera.data if camera else bpy.data.cameras.new(name)
    if camera is None:
        camera = bpy.data.objects.new(name, camera_data)
        bpy.context.collection.objects.link(camera)
    camera.location = center + direction * distance
    look = (center - camera.location).normalized()
    camera.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    if orthographic:
        # Silhouette : projection orthographique, pour comparer les proportions
        # réelles sans la déformation d'un objectif grand-angle.
        camera_data.type = "ORTHO"
        camera_data.ortho_scale = max(radius * 2.2, 0.2)
    else:
        camera_data.lens = 50
    return camera


def _prepare_render_scene(resolution, mode="studio"):
    """Lumière et fond de contrôle, une seule fois pour toutes les vues.

    mode="studio" : fond sombre et soleil unique, proche de l'aperçu Study.
    mode="plain" : fond neutre gris clair et trois points de lumière. C'est le
    fond à utiliser pour comparer un modèle à une référence (image jointe) :
    un décor sombre fausse la perception des couleurs et de la silhouette.
    mode="silhouette" : modèle noir uni sur fond blanc, rendu Workbench sans
    lumière ni matière. C'est le mode qui juge la FORME : contour, proportions,
    lisibilité des volumes, sans être trompé par les couleurs ou les reflets.
    """
    import bpy
    scene = bpy.context.scene
    normalized = str(mode or "studio").lower()
    plain = normalized == "plain"

    if normalized == "silhouette":
        scene.render.engine = "BLENDER_WORKBENCH"
        shading = scene.display.shading
        shading.light = "FLAT"
        shading.color_type = "SINGLE"
        shading.single_color = (0.0, 0.0, 0.0)
        shading.show_shadows = False
        shading.show_cavity = False
        shading.show_object_outline = False
        shading.show_specular_highlight = False
        # En rendu final, Workbench ignore le fond « viewport » : le fond vient de la
        # couleur d'affichage du monde. Sans monde clair, l'image sort sur du noir.
        world = scene.world or bpy.data.worlds.new("PreviewWorld")
        world.use_nodes = False
        world.color = (0.97, 0.97, 0.97)
        scene.world = world
        shading.background_type = "WORLD"
        shading.background_color = (0.97, 0.97, 0.97)
        scene.render.resolution_x = resolution
        scene.render.resolution_y = resolution
        scene.render.film_transparent = False
        return scene

    lights = [
        ("PreviewLight", 3.5 if not plain else 2.2, (50, 10, 30)),
    ]
    if plain:
        # Trois points : clé, remplissage opposé, contre-jour léger.
        lights += [
            ("PreviewFill", 1.1, (60, 0, 210)),
            ("PreviewRim", 1.6, (25, 0, 120)),
        ]
    for name, energy, rotation in lights:
        if name in bpy.data.objects:
            bpy.data.objects[name].data.energy = energy
            continue
        light_data = bpy.data.lights.new(name, type="SUN")
        light_data.energy = energy
        light = bpy.data.objects.new(name, light_data)
        bpy.context.collection.objects.link(light)
        light.rotation_euler = tuple(math.radians(value) for value in rotation)

    world = scene.world or bpy.data.worlds.new("PreviewWorld")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        # Gris neutre 50 % : ni noir (détails perdus) ni blanc (silhouette mangée).
        color = (0.5, 0.5, 0.52, 1.0) if plain else (0.06, 0.06, 0.07, 1.0)
        background.inputs[0].default_value = color
        background.inputs[1].default_value = 1.0 if plain else 1.0
    scene.world = world

    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.film_transparent = False
    # EEVEE affiche les matériaux : c'est indispensable pour juger une palette de couleurs.
    # Workbench reste un repli (rendu gris) réservé aux versions sans EEVEE.
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    return scene


def assemble_quad_image(images, target, size=1024, background=(0.06, 0.06, 0.07)):
    """Assemble quatre rendus en une image carrée 2x2 (taille finale `size` px).

    Chaque vue est réduite à size/2 puis copiée dans son quart. Roblox Studio et le
    regard humain jugent mieux une seule image de synthèse qu'une suite de vues isolées.
    """
    import bpy
    half = max(1, size // 2)
    sheet = bpy.data.images.new("CONTROLE", width=size, height=size, alpha=False)
    # Une ligne complète de l'image assemblée fait size*4 valeurs (RGBA).
    pixels = [*background, 1.0] * (size * size)

    for index, path in enumerate(images[:4]):
        tile = bpy.data.images.load(path, check_existing=False)
        tile.scale(half, half)
        tile_pixels = list(tile.pixels[:])
        columns = half * 4  # une ligne de la vue
        col_base = (index % 2) * columns
        row_base = (1 - index // 2) * half  # image Blender : première ligne en bas
        for row in range(half):
            start = (row_base + row) * size * 4 + col_base
            source = row * columns
            pixels[start:start + columns] = tile_pixels[source:source + columns]
        bpy.data.images.remove(tile)

    # La taille peut suivre une image déjà chargée sous le même nom : on la force.
    sheet.scale(size, size)
    sheet.pixels.foreach_set(pixels)
    sheet.filepath_raw = os.path.abspath(target)
    sheet.file_format = "PNG"
    sheet.save()
    return target


# Comparaison à une image de référence : la réduction borne le coût même sur une
# photo 4000 px, et la grille 64×64 reste assez fine pour distinguer une poignée
# d'un couvercle sans dépendre du zoom ni de la résolution des deux images.
COMPARE_MAX_SIDE = 240
COMPARE_GRID = 64


def _load_luminance(path, max_side=COMPARE_MAX_SIDE):
    """Charge une image et renvoie (luminance, largeur, hauteur) pour la comparaison."""
    import bpy
    image = bpy.data.images.load(os.path.abspath(path), check_existing=False)
    try:
        width, height = image.size
        if width <= 0 or height <= 0:
            raise RuntimeError(f"Image vide ou illisible : {path}")
        if max(width, height) > max_side:
            ratio = max_side / float(max(width, height))
            image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))
            width, height = image.size
        pixels = list(image.pixels[:])
    finally:
        bpy.data.images.remove(image)

    luminance = [0.0] * (width * height)
    for index in range(width * height):
        base = index * 4
        luminance[index] = (
            0.2126 * pixels[base] + 0.7152 * pixels[base + 1] + 0.0722 * pixels[base + 2]
        )
    return luminance, width, height


def _subject_mask(luminance, width, height):
    """Masque du sujet : pixels nettement plus sombres que le fond.

    Le seuil est placé au milieu du contraste réel de l'image, pas à une valeur
    fixe : la gestion des couleurs de Blender transforme 0,97 en ~0,75 et une
    photo peut avoir un fond gris. Renvoie (masque, boîte englobante) ou None
    quand aucun sujet ne se détache (image uniforme, fond sombre, UI comprise).
    """
    low = min(luminance)
    high = max(luminance)
    if high - low < 0.12:
        return None, "contraste insuffisant entre l'objet et le fond"

    cut = low + (high - low) * 0.5
    mask = [1 if value < cut else 0 for value in luminance]
    coverage = sum(mask) / float(len(mask))
    if coverage < 0.01:
        return None, "aucun objet sombre détecté"
    if coverage > 0.9:
        return None, "le fond n'est pas clair et uniforme"

    x0, y0 = width, height
    x1, y1 = -1, -1
    for index, value in enumerate(mask):
        if not value:
            continue
        x = index % width
        y = index // width
        x0 = min(x0, x)
        x1 = max(x1, x)
        y0 = min(y0, y)
        y1 = max(y1, y)
    if x1 < x0 or y1 < y0:
        return None, "aucun objet détecté"
    return (mask, (x0, y0, x1, y1)), ""


def _compare_grids(mask, luminance, width, bounds, out=COMPARE_GRID):
    """Recadre sur la boîte du sujet puis rééchantillonne forme et tons en 64×64.

    Le recadrage supprime l'effet du zoom et des marges ; le centrage dans un
    carré CONSERVE les proportions. Étirer la boîte sur toute la grille aurait
    rendu un objet large identique à un objet haut, ce qui masquerait justement
    l'erreur de proportions la plus fréquente.
    """
    x0, y0, x1, y1 = bounds
    span_x = max(1, x1 - x0 + 1)
    span_y = max(1, y1 - y0 + 1)
    scale = out / float(max(span_x, span_y))
    scaled_x = max(1, min(out, round(span_x * scale)))
    scaled_y = max(1, min(out, round(span_y * scale)))
    offset_x = (out - scaled_x) // 2
    offset_y = (out - scaled_y) // 2

    cells = out * out
    hits = [0] * cells
    counts = [0] * cells
    tones = [0.0] * cells

    for y in range(y0, y1 + 1):
        row = y * width
        cy = min(out - 1, offset_y + (y - y0) * scaled_y // span_y)
        for x in range(x0, x1 + 1):
            index = row + x
            cx = min(out - 1, offset_x + (x - x0) * scaled_x // span_x)
            cell = cy * out + cx
            counts[cell] += 1
            if mask[index]:
                hits[cell] += 1
            tones[cell] += luminance[index]

    shape = [hits[i] / counts[i] if counts[i] else 0.0 for i in range(cells)]
    tone = [tones[i] / counts[i] if counts[i] else 0.0 for i in range(cells)]
    low = min(tone)
    high = max(tone)
    span = high - low
    if span > 1e-6:
        tone = [(value - low) / span for value in tone]
    return shape, tone


def _global_ssim(first, second):
    """SSIM global (moyennes, variances, covariance) sur deux grilles normalisées."""
    count = float(len(first))
    mean_a = sum(first) / count
    mean_b = sum(second) / count
    var_a = sum((value - mean_a) ** 2 for value in first) / count
    var_b = sum((value - mean_b) ** 2 for value in second) / count
    cov = sum((first[i] - mean_a) * (second[i] - mean_b) for i in range(len(first))) / count
    c1 = 0.01 ** 2
    c2 = 0.03 ** 2
    value = ((2 * mean_a * mean_b + c1) * (2 * cov + c2)) / (
        (mean_a ** 2 + mean_b ** 2 + c1) * (var_a + var_b + c2)
    )
    return max(-1.0, min(1.0, value))


def compare_render(rendered, reference, angle=""):
    """Compare un rendu à une image de référence et renvoie des scores mesurés.

    `iou` (intersection sur union) mesure la FORME : 1 = même silhouette dans la
    même pose. `ssim` compare les tons après recadrage : élevé quand l'ombrage et
    les couleurs se ressemblent. Le résultat reste `None` quand le sujet ne se
    détache pas du fond, au lieu d'inventer un score.

    La référence doit montrer un seul objet sur un fond clair et uniforme, sous
    l'angle demandé (`angle` = nom de la vue : face, trois-quarts, cote, dessus).
    """
    result = {
        "reference": os.path.abspath(reference),
        "angle": angle,
        "iou": None,
        "ssim": None,
        "aspect_render": None,
        "aspect_reference": None,
        "verdict": "indéterminé",
        "reason": "",
    }

    rendered_lum, rw, rh = _load_luminance(rendered)
    reference_lum, tw, th = _load_luminance(reference)

    rendered_mask, reason = _subject_mask(rendered_lum, rw, rh)
    if rendered_mask is None:
        result["reason"] = f"rendu : {reason}"
        return result
    reference_mask, reason = _subject_mask(reference_lum, tw, th)
    if reference_mask is None:
        result["reason"] = f"référence : {reason}"
        return result

    r_mask, r_bounds = rendered_mask
    t_mask, t_bounds = reference_mask
    r_shape, r_tone = _compare_grids(r_mask, rendered_lum, rw, r_bounds)
    t_shape, t_tone = _compare_grids(t_mask, reference_lum, tw, t_bounds)

    intersection = 0
    union = 0
    for index in range(len(r_shape)):
        first = r_shape[index] >= 0.5
        second = t_shape[index] >= 0.5
        if first and second:
            intersection += 1
        if first or second:
            union += 1

    result["iou"] = round(intersection / union, 3) if union else 0.0
    result["ssim"] = round(_global_ssim(r_tone, t_tone), 3)
    result["aspect_render"] = round((r_bounds[2] - r_bounds[0] + 1) / float(r_bounds[3] - r_bounds[1] + 1), 3)
    result["aspect_reference"] = round((t_bounds[2] - t_bounds[0] + 1) / float(t_bounds[3] - t_bounds[1] + 1), 3)
    aspect_delta = abs(result["aspect_render"] - result["aspect_reference"]) / max(
        result["aspect_render"], result["aspect_reference"]
    )

    if result["iou"] >= 0.87 and aspect_delta <= 0.18:
        result["verdict"] = "très proche"
    elif result["iou"] >= 0.72 and aspect_delta <= 0.3:
        result["verdict"] = "proche"
    else:
        result["verdict"] = "différent"
    if aspect_delta > 0.25:
        result["reason"] = "proportions différentes (hauteur/largeur)"
    return result


def render_preview(target, resolution=1024, per_view=512, mode="studio"):
    """Rendu de contrôle en EEVEE (ou Workbench), quatre angles dans une seule image.

    `target` reçoit l'image assemblée (1024 px par défaut) ; les vues individuelles sont
    écrites dans un sous-dossier `_vues` à côté, pour un diagnostic plus fin si besoin.
    `mode` : "studio" (fond sombre), "plain" (fond gris neutre, trois points de
    lumière) pour comparer le modèle à une référence, ou "silhouette" (noir sur
    blanc, projection orthographique) pour valider la forme et les proportions.
    """
    import bpy
    target = os.path.abspath(target)
    folder = os.path.dirname(target) or "."
    os.makedirs(folder, exist_ok=True)
    views_dir = os.path.splitext(target)[0] + "_vues"
    os.makedirs(views_dir, exist_ok=True)

    normalized = str(mode or "studio").lower()
    plain = normalized == "plain"
    silhouette = normalized == "silhouette"
    _, _, center, radius = scene_bounds()
    scene = _prepare_render_scene(per_view, mode)
    tiles = []
    for label, direction in PREVIEW_ANGLES:
        scene.camera = _view_camera(f"PreviewCamera_{label}", center, radius, direction, orthographic=silhouette)
        tile = os.path.join(views_dir, f"{label}.png")
        scene.render.filepath = tile
        bpy.ops.render.render(write_still=True)
        if not os.path.isfile(tile):
            raise RuntimeError(f"Le rendu « {label} » n'a rien produit : {tile}")
        tiles.append(tile)

    if silhouette:
        background = (0.97, 0.97, 0.97)
    elif plain:
        background = (0.5, 0.5, 0.52)
    else:
        background = (0.06, 0.06, 0.07)
    assemble_quad_image(tiles, target, size=resolution, background=background)
    if not os.path.isfile(target):
        raise RuntimeError(f"Le rendu n'a rien produit : {target}")
    return target


def finish(obj, args, material_color=(0.8, 0.8, 0.8, 1.0), materials=None):
    """Chaîne complète : nettoyage, triangulation, matériaux, UV, export et rendu.

    materials=None : un matériau unique (comportement historique).
    materials=[m1, m2, …] : conserve les couleurs déjà affectées aux faces (palette
    appliquée avant join) et l'export GLB contient un sous-mesh par couleur. Roblox
    Studio les importe en MeshPart texturé : un mesh, plusieurs couleurs.

    L'ordre des emplacements de matériaux est celui de `materials`. Chaque triangle est
    colorié d'après le matériau de sa face d'origine : trier par numéro de face décale
    les couleurs (la triangulation crée plus de faces qu'il n'en existait), ce qui donne
    des diagonales de couleur au lieu de pièces coloriées.
    """
    if materials:
        wanted = [material for material in materials if material]
        index_by_name = {material.name: index for index, material in enumerate(wanted)}
        # Couleur par sommet, lue AVANT nettoyage et triangulation : join() et clean()
        # peuvent réordonner ou fusionner les faces, pas les coordonnées des sommets.
        color_by_vertex = {}
        slot_names = [slot.name if slot else "" for slot in obj.data.materials]
        for poly in obj.data.polygons:
            name = slot_names[poly.material_index] if 0 <= poly.material_index < len(slot_names) else ""
            color_index = index_by_name.get(name, 0)
            for vertex_index in poly.vertices:
                color_by_vertex[vertex_index] = color_index

        clean(obj)
        triangulate(obj)

        if wanted:
            obj.data.materials.clear()
            for material in wanted:
                obj.data.materials.append(material)
            # Chaque triangle prend la couleur majoritaire de ses trois sommets.
            for poly in obj.data.polygons:
                votes = {}
                for vertex_index in poly.vertices:
                    color = color_by_vertex.get(vertex_index, 0)
                    votes[color] = votes.get(color, 0) + 1
                poly.material_index = max(votes, key=votes.get) if votes else 0
        else:
            add_material(obj, args.name, material_color)
        if len(obj.data.materials) > 5:
            print(f"ATTENTION: {len(obj.data.materials)} matériaux ; Roblox préfère 5 couleurs maximum.")
        if obj.data.materials:
            uv_unwrap(obj)
        return _finish_result(obj, args)

    clean(obj)
    triangulate(obj)
    if obj.data.materials:
        for poly in obj.data.polygons:
            poly.material_index = 0
    else:
        add_material(obj, args.name, material_color)
    if len(obj.data.materials) > 5:
        print(f"ATTENTION: {len(obj.data.materials)} matériaux ; Roblox préfère 5 couleurs maximum.")
    if obj.data.materials:
        uv_unwrap(obj)
    return _finish_result(obj, args)


def _finish_result(obj, args):
    """Taille en studs, budget de triangles, rendu de contrôle et export GLB."""
    tris = triangle_count(obj)
    result = {"name": args.name, "triangles": tris, "materials": [slot.name for slot in obj.data.materials if slot]}
    if tris and tris < 24:
        result["warning"] = result.get("warning", "") + " Silhouette très simple : ajoute un biseau ou un détail avant de livrer."
    if args.triangles and tris > args.triangles:
        result["warning"] = f"{tris} triangles dépassent le budget demandé ({args.triangles})."
    low, high, _, _ = scene_bounds()
    size = high - low
    result["size_studs"] = {
        "x": round(size.x / STUDS_TO_METERS, 2),
        "y": round(size.y / STUDS_TO_METERS, 2),
        "z": round(size.z / STUDS_TO_METERS, 2),
    }
    if args.render:
        result["render"] = render_preview(args.render)
    if not args.no_export:
        result["glb"] = export_glb(args.output, args.name)
    print("STATS " + str(result))
    return result


# ---------------------------------------------------------------------------
# Outils de géométrie low-poly
#
# Ces primitives remplacent les cubes nus : un biseau, une sphère aplatie ou un
# tore donnent tout de suite un modèle « fini » sans coût d'apprentissage.
# Toutes renvoient un objet mesh avec l'origine à sa base quand c'est possible,
# et restent compatibles avec join(), clean() et finish().
# ---------------------------------------------------------------------------


def _link(mesh, name, location, z_offset=0.0):
    import bpy
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (location[0], location[1], location[2] + z_offset)
    bpy.context.collection.objects.link(obj)
    return obj


def _mesh_from_bmesh(bm, name):
    import bpy
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(verbose=False)
    mesh.update()
    return mesh


def sphere(name, radius=0.5, segments=16, rings=8, location=(0, 0, 0), squash=(1.0, 1.0, 1.0)):
    """Sphère UV (ou ellipsoïde via squash) ; segments bas = look low-poly.

    Exemple de rocher : sphere("Pierre", 0.8, 8, 5, squash=(1.0, 0.85, 0.7)).
    """
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=max(6, segments), v_segments=max(4, rings), radius=radius)
    for vert in bm.verts:
        vert.co.x *= squash[0]
        vert.co.y *= squash[1]
        vert.co.z *= squash[2]
    mesh = _mesh_from_bmesh(bm, name)
    return _link(mesh, name, location)


def cone(name, radius=0.5, depth=1.0, vertices=12, radius_top=0.0, location=(0, 0, 0)):
    """Cône (ou tronc de cône avec radius_top) ; origine à la base, pointe vers +Z."""
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=max(3, vertices),
                          radius1=radius, radius2=max(0.0, radius_top), depth=depth)
    mesh = _mesh_from_bmesh(bm, name)
    return _link(mesh, name, location, depth / 2.0)


def torus(name, major=0.5, minor=0.12, major_segments=16, minor_segments=8, location=(0, 0, 0)):
    """Tore dans le plan XY : anneau, roue, vase vu de dessus, cadre arrondi."""
    verts, faces = [], []
    for i in range(major_segments):
        angle = 2.0 * math.pi * i / major_segments
        for j in range(minor_segments):
            theta = 2.0 * math.pi * j / minor_segments
            r = major + minor * math.cos(theta)
            verts.append((math.cos(angle) * r, math.sin(angle) * r, minor * math.sin(theta)))
    for i in range(major_segments):
        for j in range(minor_segments):
            a = i * minor_segments + j
            b = i * minor_segments + (j + 1) % minor_segments
            c = ((i + 1) % major_segments) * minor_segments + (j + 1) % minor_segments
            d = ((i + 1) % major_segments) * minor_segments + j
            faces.append((a, b, c, d))
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    return _link(mesh, name, location, minor)


def lathe(name, profile, segments=16, location=(0, 0, 0)):
    """Révolution d'un profil (liste de (rayon, hauteur)) autour de l'axe Z.

    Colonne :    lathe("Colonne", [(0.5, 0), (0.45, 0.2), (0.35, 0.4), (0.35, 2.6), (0.45, 2.8), (0.55, 3.0)])
    Vase :       lathe("Vase", [(0.0, 0), (0.4, 0.1), (0.55, 0.6), (0.3, 1.1), (0.35, 1.2)])
    Les rayons à 0 sont fermés proprement (pas de trou au centre).
    """
    import bpy
    points = [(float(r), float(z)) for r, z in profile]
    if len(points) < 2:
        raise ValueError("lathe : le profil doit contenir au moins deux points (rayon, hauteur).")
    verts, faces = [], []
    rings = []
    for r, z in points:
        if r <= 1e-6:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
            continue
        ring = []
        for i in range(segments):
            angle = 2.0 * math.pi * i / segments
            ring.append(len(verts))
            verts.append((math.cos(angle) * r, math.sin(angle) * r, z))
        rings.append(ring)
    for index in range(len(rings) - 1):
        lower, upper = rings[index], rings[index + 1]
        if len(lower) == 1 and len(upper) == 1:
            continue
        if len(lower) == 1:
            for i in range(segments):
                faces.append((lower[0], upper[i], upper[(i + 1) % segments]))
        elif len(upper) == 1:
            for i in range(segments):
                faces.append((lower[i], upper[0], lower[(i + 1) % segments]))
        else:
            for i in range(segments):
                faces.append((lower[i], lower[(i + 1) % segments], upper[(i + 1) % segments], upper[i]))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    return _link(mesh, name, location)


def bevel(obj, width=0.02, segments=1, angle_limit=40.0):
    """Biseaute les arêtes vives : le détail qui fait un modèle « soigné ».

    Appliqué par modifier puis converti en mesh, pour rester exportable.
    width en mètres (0.02 ≈ 7 % d'un stud) ; segments 1 suffit pour le low-poly.
    """
    import bpy
    modifier = obj.modifiers.new("Biseau", type="BEVEL")
    modifier.width = float(width)
    modifier.segments = max(1, int(segments))
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(float(angle_limit))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    except RuntimeError:
        # Contexte indisponible en arrière-plan : le modifier reste dans le fichier et
        # export_apply de l'export GLB l'applique quand même.
        pass
    return obj


def mirror(obj, axis="X", offset=0.0):
    """Symétrie appliquée puis convertie : crée la moitié gauche depuis la droite.

    Le centre de symétrie suit les axes du monde (X par défaut).
    """
    import bpy
    modifier = obj.modifiers.new("Symétrie", type="MIRROR")
    modifier.use_axis = (axis.upper() == "X", axis.upper() == "Y", axis.upper() == "Z")
    modifier.use_bisect_axis = (True, True, True)
    modifier.mirror_object = None
    if offset:
        modifier.use_mirror_offset = True
        modifier.mirror_offset = float(offset)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    except RuntimeError:
        pass
    return obj


def boolean_cut(target, cutter, operation="DIFFERENCE", delete_cutter=True):
    """Creuse target avec cutter (EXACT) : fenêtres, portes, fentes, rainures.

    boolean_cut(caisse, fenetre, "DIFFERENCE") puis clean(caisse).
    """
    import bpy
    modifier = target.modifiers.new("Creux", type="BOOLEAN")
    modifier.operation = operation
    modifier.object = cutter
    try:
        modifier.solver = "EXACT"
    except TypeError:
        pass
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    if delete_cutter and cutter and cutter.name in bpy.data.objects:
        bpy.data.objects.remove(cutter, do_unlink=True)
    return target


def noise(obj, strength=0.02, scale=2.0, seed=0):
    """Déforme légèrement les sommets : rochers, pierres, arbres jamais trop lisses.

    Déterministe (même seed = même forme), réalisé directement sur les coordonnées
    pour ne dépendre d'aucune texture procédurale : la déformation est exportée.
    """
    import random
    generator = random.Random(seed)
    # Déformation radiale + léger relief : la base (z minimal) reste plate et au sol,
    # sans trou sombre ni rocher enterré.
    lowest = min((vert.co.z for vert in obj.data.vertices), default=0.0)
    floor_margin = lowest + float(strength) * 0.25
    for vert in obj.data.vertices:
        co = vert.co
        factor = 1.0 + generator.uniform(-1.0, 1.0) * float(strength) * float(scale)
        new_z = co.z + generator.uniform(-1.0, 1.0) * float(strength) * 0.5
        if co.z <= floor_margin:
            new_z = lowest
        vert.co = (co.x * factor, co.y * factor, max(new_z, lowest))
    obj.data.update()
    return obj


def scale_to_studs(obj, studs_height, axis="Z"):
    """Met l'objet à la hauteur demandée en studs (maintient les proportions)."""
    from mathutils import Vector
    world = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    extent = max(v.z for v in world) - min(v.z for v in world) if axis == "Z" else max(v.y for v in world) - min(v.y for v in world)
    if extent <= 1e-6:
        return obj
    factor = studs(float(studs_height)) / extent
    obj.scale = (obj.scale.x * factor, obj.scale.y * factor, obj.scale.z * factor)
    return obj
