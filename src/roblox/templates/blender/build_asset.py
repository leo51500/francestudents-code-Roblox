"""Point d'entrée Blender : python build_asset.py -- --spec <json> --out <dir>."""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import lib  # noqa: E402  (bpy n'est disponible qu'après le démarrage de Blender)


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser(description="Construit un asset Roblox depuis une spécification JSON.")
    parser.add_argument("--spec", required=True, help="Chemin du fichier de spécification.")
    parser.add_argument("--out", required=True, help="Dossier de sortie des GLB et de l'aperçu.")
    return parser.parse_args(argv)


def main():
    args = parse_args()
    with open(args.spec, "r", encoding="utf-8") as handle:
        spec = json.load(handle)

    print("[asset] construction de %s" % spec.get("id"))
    report = lib.build(spec, args.out)
    print("[asset] LOD: %s" % ", ".join(
        "%s (%d triangles)" % (lod["file"], lod["triangles"]) for lod in report["lods"]
    ))
    print("[asset] aperçu: %s" % report["preview"])


if __name__ == "__main__":
    main()
