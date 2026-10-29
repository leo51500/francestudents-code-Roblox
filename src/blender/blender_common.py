"""Outils communs aux scripts Blender de FranceStudent Code Roblox.

Importé par les modèles de src/blender/templates : copie ce fichier (ou ajoute son
dossier à sys.path) puis `import blender_common as bc`.

Conventions Roblox appliquées ici :
- unités en mètres, 1 stud = 0.28 m ;
- origine à la base du modèle, axe +Z vers le haut ;
- catégorie d'objet explicite, normales recalculées, transformations appliquées ;
- export glTF/GLB sans caméra ni lumière.
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


def add_material(obj, name="Roblox", color=(0.8, 0.8, 0.8, 1.0), roughness=0.6):
    """Matériau principled simple, compatible Roblox."""
    import bpy
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = 0.0
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return material


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
        if obj.type != "MESH":
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


def render_preview(target, resolution=512):
    """Rendu de contrôle en EEVEE (ou Workbench), cadré automatiquement sur le modèle."""
    import bpy
    from mathutils import Vector
    scene = bpy.context.scene
    os.makedirs(os.path.dirname(os.path.abspath(target)) or ".", exist_ok=True)
    _, _, center, radius = scene_bounds()

    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera = bpy.data.objects.new("PreviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    # Caméra placée en diagonale à une distance qui laisse 15 % de marge autour du modèle.
    direction = Vector((1.0, -1.0, 0.7)).normalized()
    camera.location = center + direction * (radius * 2.9)
    look = (center - camera.location).normalized()
    camera.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = 50
    scene.camera = camera

    light_data = bpy.data.lights.new("PreviewLight", type="SUN")
    light_data.energy = 3.5
    light = bpy.data.objects.new("PreviewLight", light_data)
    bpy.context.collection.objects.link(light)
    light.rotation_euler = (math.radians(50), math.radians(10), math.radians(30))

    world = bpy.data.worlds.new("PreviewWorld") if not scene.world else scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs[0].default_value = (0.06, 0.06, 0.07, 1.0)
        background.inputs[1].default_value = 1.0
    scene.world = world

    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.film_transparent = False
    scene.render.filepath = os.path.abspath(target)
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_WORKBENCH"
    bpy.ops.render.render(write_still=True)
    if not os.path.isfile(target):
        raise RuntimeError(f"Le rendu n'a rien produit : {target}")
    return target


def finish(obj, args, material_color=(0.8, 0.8, 0.8, 1.0)):
    """Chaîne complète : nettoyage, triangulation, matériau, UV, export et rendu."""
    clean(obj)
    triangulate(obj)
    add_material(obj, args.name, material_color)
    uv_unwrap(obj)
    tris = triangle_count(obj)
    result = {"name": args.name, "triangles": tris}
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
