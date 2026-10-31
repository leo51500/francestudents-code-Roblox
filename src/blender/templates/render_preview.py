"""Rendu de contrôle d'un fichier .blend ou .glb, pour vérification visuelle de l'agent.

Usage :
    blender --background --python src/blender/templates/render_preview.py -- --input build/models/Coffre.glb --render build/preview/coffre.png
    blender --background --python src/blender/templates/render_preview.py -- --input build/models/Coffre.glb --mode silhouette --render build/preview/coffre_forme.png
    blender --background --python src/blender/templates/render_preview.py -- --input build/models/Coffre.glb --mode silhouette --reference refs/coffre.png --angle face --render build/preview/coffre_forme.png

Le PNG produit se consulte ensuite avec l'outil view_image : l'agent voit réellement le modèle
au lieu de supposer son apparence. `--mode silhouette` rend le modèle noir sur blanc en
projection orthographique : c'est le rendu à utiliser pour juger la forme et les proportions.
`--reference` compare la vue demandée à une image de référence (un seul objet, fond clair et
uniforme) et imprime `COMPARE {…}` avec iou, ssim et un verdict.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402


def main():
    import bpy
    # Options propres au rendu : parse_args refuse --input/--mode/--reference,
    # donc les lire ici, comme validate_model.py et export_for_roblox.py.
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

    def option(name):
        for index, item in enumerate(argv):
            if item == name and index + 1 < len(argv):
                return argv[index + 1]
        return ""

    source = option("--input")
    mode = (option("--mode") or "studio").lower()
    reference = option("--reference")
    angle = option("--angle") or "face"
    target = option("--render") or "build/preview/preview.png"

    if source.lower().endswith(".blend"):
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(source))
    elif source:
        bc.reset_scene()
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
    else:
        raise SystemExit("ERREUR: --input <fichier .blend|.glb> est obligatoire.")

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise SystemExit("ERREUR: aucun mesh à rendre.")
    triangles = sum(bc.triangle_count(obj) for obj in meshes)
    print(f"STATS {{'meshes': {len(meshes)}, 'triangles': {triangles}}}")

    path = bc.render_preview(target, resolution=512, mode=mode)
    print(f"PREVIEW {path}")

    if reference:
        views = os.path.splitext(os.path.abspath(path))[0] + "_vues"
        view = os.path.join(views, f"{angle}.png")
        if not os.path.isfile(view):
            raise SystemExit(f"ERREUR: vue « {angle} » introuvable : {view}")
        comparison = bc.compare_render(view, os.path.abspath(reference), angle=angle)
        print(f"COMPARE {json.dumps(comparison, ensure_ascii=False)}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
