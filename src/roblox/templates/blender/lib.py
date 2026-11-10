"""Bibliothèque de construction d'assets pour France-Students-code-Roblox.

Ce fichier s'exécute DANS Blender (bpy). Il transforme une spécification JSON
en maillage texturé, puis produit LOD0 à LOD3, un aperçu et un rapport.

Aucune géométrie n'est créée ailleurs : les GLB exportés ici sont la seule
source des modèles Roblox.
"""

import json
import math
import os
import random

import bpy
from mathutils import Euler, Matrix, Vector

MATERIAL_SETTINGS = {
    "wood": {"roughness": 0.78, "metallic": 0.0, "variation": 0.10},
    "metal": {"roughness": 0.32, "metallic": 0.85, "variation": 0.06},
    "stone": {"roughness": 0.86, "metallic": 0.0, "variation": 0.12},
    "fabric": {"roughness": 0.92, "metallic": 0.0, "variation": 0.09},
    "glass": {"roughness": 0.12, "metallic": 0.0, "variation": 0.03},
    "plastic": {"roughness": 0.45, "metallic": 0.0, "variation": 0.05},
    "gold": {"roughness": 0.22, "metallic": 0.95, "variation": 0.04},
    "skin": {"roughness": 0.65, "metallic": 0.0, "variation": 0.05},
    "foliage": {"roughness": 0.88, "metallic": 0.0, "variation": 0.14},
}


def clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, value))


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def material_settings(name):
    return MATERIAL_SETTINGS.get(name, MATERIAL_SETTINGS["wood"])


def texture_pixels(color, material, seed, size=64):
    """Texture procédurale déterministe : grain, rayures ou mouchetures."""
    rng = random.Random(seed)
    base = [clamp(channel) for channel in color]
    pixels = [0.0] * (size * size * 4)

    for y in range(size):
        for x in range(size):
            pattern = 0.0
            if material == "wood":
                grain = math.sin((x * 0.55 + math.sin(y * 0.21) * 3.0) * 1.7)
                pattern = grain * 0.045 + rng.uniform(-0.03, 0.03)
            elif material == "metal":
                pattern = math.sin(y * 0.9) * 0.025 + rng.uniform(-0.02, 0.02)
            elif material == "stone":
                pattern = rng.choice((-0.055, -0.02, 0.0, 0.02, 0.05))
            elif material == "fabric":
                pattern = math.sin(x * 0.8) * math.sin(y * 0.8) * 0.035
            elif material == "foliage":
                pattern = rng.uniform(-0.08, 0.06)
            else:
                pattern = rng.uniform(-0.03, 0.03)

            offset = pattern + material_settings(material)["variation"] * 0.25
            index = (y * size + x) * 4
            pixels[index] = clamp(base[0] + offset)
            pixels[index + 1] = clamp(base[1] + offset)
            pixels[index + 2] = clamp(base[2] + offset)
            pixels[index + 3] = 1.0

    return pixels


def make_material(index, material, color, seed, texture_dir):
    settings = material_settings(material)
    name = "mat_%02d_%s" % (index, material)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (color[0], color[1], color[2], 1.0)
    mat.roughness = settings["roughness"]
    mat.metallic = settings["metallic"]

    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (420, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (120, 0)
    links.new(bsdf.outputs[0], output.inputs["Surface"])

    for socket_name, value in (("Roughness", settings["roughness"]), ("Metallic", settings["metallic"])):
        socket = bsdf.inputs.get(socket_name)
        if socket is not None:
            socket.default_value = value

    image = bpy.data.images.new(name + "_tex", width=64, height=64, alpha=False)
    image.pixels.foreach_set(texture_pixels(color, material, seed, 64))
    os.makedirs(texture_dir, exist_ok=True)
    image.filepath_raw = os.path.join(texture_dir, name + ".png")
    image.file_format = "PNG"
    image.save()
    image.pack()

    tex = nodes.new("ShaderNodeTexImage")
    tex.location = (-220, 0)
    tex.image = image
    base_color = bsdf.inputs[0]
    links.new(tex.outputs["Color"], base_color)

    return mat, "textures/" + name + ".png"


def create_part(part, material):
    shape = part.get("shape", "box")
    size = part.get("size", [1, 1, 1])
    position = part.get("position", [0, 0, 0])
    rotation = part.get("rotation", [0, 0, 0])

    if shape == "box":
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
        obj = bpy.context.object
        obj.scale = (size[0], size[1], size[2])
    elif shape == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.5, depth=1.0, location=(0, 0, 0))
        obj = bpy.context.object
        obj.scale = (size[0], size[1], size[2])
    elif shape == "cone":
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.5, radius2=0.0, depth=1.0, location=(0, 0, 0))
        obj = bpy.context.object
        obj.scale = (size[0], size[1], size[2])
    elif shape == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.5, location=(0, 0, 0))
        obj = bpy.context.object
        obj.scale = (size[0], size[1], size[2])
    else:  # torus
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.4,
            minor_radius=0.12,
            major_segments=24,
            minor_segments=12,
            location=(0, 0, 0)
        )
        obj = bpy.context.object
        obj.scale = (size[0], size[1], size[2])

    obj.name = part.get("name", "Part")
    obj.data.materials.append(material)
    obj.rotation_euler = Euler([math.radians(value) for value in rotation], "XYZ")
    obj.location = Vector(position)

    if part.get("smooth"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True

    return obj


def join_parts(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "Asset"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def center_on_ground(obj):
    """Pivot au centre de la base : plus simple à poser dans Studio."""
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector((
        min(corner.x for corner in corners),
        min(corner.y for corner in corners),
        min(corner.z for corner in corners)
    ))
    maximum = Vector((
        max(corner.x for corner in corners),
        max(corner.y for corner in corners),
        max(corner.z for corner in corners)
    ))
    offset = Vector(((minimum.x + maximum.x) / 2.0, (minimum.y + maximum.y) / 2.0, minimum.z))
    obj.data.transform(Matrix.Translation(-offset))
    obj.location = (0, 0, 0)
    return maximum - minimum


def bevel(obj):
    width = 0.035
    try:
        dimension = min(obj.dimensions)
        width = max(0.004, min(0.035, dimension * 0.06))
    except Exception:
        pass
    modifier = obj.modifiers.new("CartoonBevel", "BEVEL")
    modifier.width = width
    modifier.segments = 2
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(40)
    modifier.harden_normals = False
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def unwrap(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def stats(obj):
    mesh = obj.data
    vertex_count = len(mesh.vertices)
    polygon_count = len(mesh.polygons)
    triangle_count = sum(max(0, len(polygon.vertices) - 2) for polygon in mesh.polygons)
    return {
        "vertices": vertex_count,
        "polygons": polygon_count,
        "triangles": triangle_count
    }


def select_only(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def export_glb(obj, filepath):
    select_only(obj)
    attempts = [
        {"export_apply": True, "export_yup": True},
        {"export_apply": True},
        {}
    ]
    last_error = None
    for extra in attempts:
        try:
            bpy.ops.export_scene.gltf(
                filepath=filepath,
                export_format="GLB",
                use_selection=True,
                **extra
            )
            return
        except TypeError as error:
            last_error = error
    raise last_error


def duplicate_lod(source, ratio):
    clone = source.copy()
    clone.data = source.data.copy()
    clone.name = "LOD_%s" % str(ratio).replace(".", "_")
    bpy.context.collection.objects.link(clone)
    select_only(clone)

    triangles = len(clone.data.polygons)
    if ratio < 1.0 and triangles > 8:
        modifier = clone.modifiers.new("Decimate", "DECIMATE")
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return clone


def render_preview(obj, filepath, dimensions, color_type="MATERIAL"):
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"

    display = scene.display.shading
    display.light = "STUDIO"
    display.color_type = color_type
    display.show_shadows = True
    display.show_cavity = True
    display.cavity_type = "BOTH"
    display.show_object_outline = True

    scene.render.resolution_x = 700
    scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.filepath = filepath
    scene.render.image_settings.file_format = "PNG"

    world = bpy.data.worlds.new("PreviewWorld")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs[0].default_value = (0.10, 0.09, 0.14, 1.0)
    scene.world = world

    largest = max(dimensions.x, dimensions.y, dimensions.z, 0.5)
    center = Vector((0, 0, dimensions.z * 0.5))

    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = largest * 2.4
    camera = bpy.data.objects.new("PreviewCamera", camera_data)
    camera.location = center + Vector((largest * 1.8, -largest * 2.2, largest * 1.4))
    direction = center - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(camera)
    scene.camera = camera

    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)


def finish_build(asset, spec, output_dir, dimensions, textures, extra=None, preview_color="MATERIAL"):
    """Exporte LOD0–LOD3, l'aperçu et le rapport communs aux deux pipelines."""
    lod_specs = spec.get("lodRatios", [1, 0.5, 0.25, 0.1])
    while len(lod_specs) < 4:
        lod_specs.append([1, 0.5, 0.25, 0.1][len(lod_specs)])

    lods = []
    polygons = {}
    vertices = {}
    triangles = {}

    for index, ratio in enumerate(lod_specs[:4]):
        lod = asset if index == 0 else duplicate_lod(asset, float(ratio))
        file_name = "lod%d.glb" % index
        export_glb(lod, os.path.join(output_dir, file_name))
        information = stats(lod)
        lods.append({
            "index": index,
            "ratio": float(ratio),
            "file": file_name,
            **information
        })
        polygons["lod%d" % index] = information["polygons"]
        vertices["lod%d" % index] = information["vertices"]
        triangles["lod%d" % index] = information["triangles"]
        if index > 0:
            bpy.data.objects.remove(lod, do_unlink=True)

    render_preview(asset, os.path.join(output_dir, "preview.png"), dimensions, preview_color)

    report = {
        "asset": spec.get("id"),
        "name": spec.get("name"),
        "kind": spec.get("kind"),
        "blender": bpy.app.version_string,
        "dimensions": {
            "x": round(dimensions.x, 3),
            "y": round(dimensions.y, 3),
            "z": round(dimensions.z, 3)
        },
        "polygons": polygons,
        "vertices": vertices,
        "triangles": triangles,
        "parts": len(spec.get("parts", [])),
        "lods": lods,
        "textures": textures,
        "preview": "preview.png"
    }
    if extra:
        report.update(extra)

    with open(os.path.join(output_dir, "report.json"), "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    return report


def build(spec, output_dir):
    reset_scene()
    os.makedirs(output_dir, exist_ok=True)
    texture_dir = os.path.join(output_dir, "textures")

    seed = spec.get("seed")
    if seed is None:
        seed = abs(hash(spec.get("id", "asset"))) % 100000

    objects = []
    textures = []
    for index, part in enumerate(spec.get("parts", [])):
        color = part.get("color", [0.6, 0.45, 0.3])
        material, texture = make_material(index, part.get("material", "wood"), color, seed + index, texture_dir)
        objects.append(create_part(part, material))
        textures.append(texture)

    if not objects:
        raise RuntimeError("La spécification ne contient aucune pièce.")

    asset = join_parts(objects)
    dimensions = center_on_ground(asset)
    bevel(asset)
    unwrap(asset)

    return finish_build(asset, spec, output_dir, dimensions, textures)


def import_source(source):
    """Importe un fichier 3D existant dans une scène vide et fusionne ses meshes."""
    extension = os.path.splitext(source)[1].lower()
    if extension == ".blend":
        bpy.ops.wm.open_mainfile(filepath=source)
        bpy.context.scene.unit_settings.system = "METRIC"
        bpy.context.scene.unit_settings.scale_length = 1.0
    elif extension in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=source)
    elif extension == ".fbx":
        bpy.ops.import_scene.fbx(filepath=source)
    elif extension == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=source)
        else:
            bpy.ops.import_scene.obj(filepath=source)
    elif extension == ".stl":
        if hasattr(bpy.ops.wm, "stl_import"):
            bpy.ops.wm.stl_import(filepath=source)
        else:
            bpy.ops.import_mesh.stl(filepath=source)
    else:
        raise RuntimeError(
            "Format non pris en charge : %s. Utilise .glb, .gltf, .fbx, .obj, .stl ou .blend." % extension
        )

    for obj in bpy.context.scene.objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Aucun maillage trouvé dans %s." % os.path.basename(source))

    # Les meshes importés peuvent être parentés à des empties : le join applique
    # les transformations du monde, puis on fige position, rotation et échelle.
    asset = join_parts(meshes)
    return asset, extension.lstrip(".")


def prepare_import(asset, spec, output_dir):
    """Oriente, met à l'échelle, recentre et nettoie un modèle importé."""
    rotation = spec.get("rotation") or [0, 0, 0]
    if any(abs(float(value)) > 0.0001 for value in rotation):
        # Les GLB importés utilisent souvent le mode quaternion : sans ce
        # réglage, rotation_euler est ignoré et le modèle reste inchangé.
        asset.rotation_mode = "XYZ"
        asset.rotation_euler = Euler([math.radians(float(value)) for value in rotation], "XYZ")
        select_only(asset)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    factor = float(spec.get("scale") or 1.0)
    height = spec.get("height")
    if height:
        current_height = float(asset.dimensions.z)
        if current_height > 0.0001:
            factor *= float(height) / current_height

    if abs(factor - 1.0) > 0.0001:
        asset.scale = (factor, factor, factor)
        select_only(asset)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    select_only(asset)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    if len(asset.data.uv_layers) == 0:
        unwrap(asset)
    if spec.get("bevel") is True:
        bevel(asset)

    textures = []
    if len(asset.data.materials) == 0:
        seed = abs(hash(spec.get("id", "imported"))) % 100000
        material, texture = make_material(0, "plastic", [0.78, 0.78, 0.8], seed,
                                          os.path.join(output_dir, "textures"))
        asset.data.materials.append(material)
        textures.append(texture)

    return textures


def build_imported(spec, output_dir):
    source = spec.get("source")
    if not source or not os.path.isfile(source):
        raise RuntimeError("Fichier source introuvable : %s" % source)

    reset_scene()
    os.makedirs(output_dir, exist_ok=True)
    asset, source_format = import_source(source)
    textures = prepare_import(asset, spec, output_dir)
    dimensions = center_on_ground(asset)

    preview_color = "TEXTURE" if any(
        image and image.size[0] > 0 for image in bpy.data.images
    ) else "MATERIAL"

    return finish_build(asset, spec, output_dir, dimensions, textures, {
        "imported": True,
        "source": {
            "file": os.path.basename(source),
            "format": source_format
        }
    }, preview_color=preview_color)
