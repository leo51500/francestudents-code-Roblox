"""Upload Roblox via le plugin Blender deja connecte.

Appele par src/roblox/plugin.js avec :
  blender --background --python plugin_upload.py -- --request <fichier.json>

Le fichier de requete contient l'action ("status" ou "upload"), le fichier,
le nom, la description, le type d'asset et le chemin du resultat JSON.
Aucun jeton n'est ecrit dans le projet ni affiche dans la sortie.
"""

import asyncio
import importlib
import json
import sys
import traceback
from pathlib import Path

import bpy

DEFAULT_PLUGIN = "roblox-blender-plugin-main"
DEFAULT_LOGIN_TIMEOUT = 240


def read_request():
    if "--" not in sys.argv:
        raise SystemExit("argument --request manquant")
    argv = sys.argv[sys.argv.index("--") + 1:]
    request_path = Path(argv[argv.index("--request") + 1])
    return json.loads(request_path.read_text(encoding="utf-8-sig"))


def finish(request, payload):
    payload.setdefault("provider", "plugin")
    result_path = Path(request["result"])
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def short_error(exception):
    message = str(exception).strip()
    return message[:800] if message else exception.__class__.__name__


def addon_preferences(plugin_name):
    return bpy.context.preferences.addons[plugin_name].preferences


def load_addon(plugin_name):
    try:
        import addon_utils

        if not addon_utils.check(plugin_name)[1]:
            try:
                addon_utils.enable(plugin_name, default_set=False, persistent=False)
            except TypeError:
                # Blender 3.x ne connait pas `persistent`.
                addon_utils.enable(plugin_name, default_set=False)
    except Exception:
        traceback.print_exc()

    importlib.import_module(plugin_name)
    creator_details = importlib.import_module(plugin_name + ".lib.creator_details")
    oauth2_client = importlib.import_module(plugin_name + ".lib.oauth2_client")
    return creator_details, oauth2_client


def select_creator(rbx, preferences, plugin_name, wanted_id):
    creators = list(rbx.creators)
    if not creators:
        return None

    wanted = str(wanted_id or "").strip()
    for creator in creators:
        if wanted and str(creator.id) == wanted:
            return creator

    try:
        saved_index = int(getattr(addon_preferences(plugin_name), "selected_creator_enum_index", 0) or 0)
    except Exception:
        saved_index = 0
    saved_index = min(max(saved_index, 0), len(creators) - 1)
    return creators[saved_index]


def creator_payload(creator):
    if creator is None:
        return None
    return {"type": creator.type, "id": str(creator.id), "name": creator.name}


def persist_session(client, rbx, preferences, plugin_name, creator_details):
    """Roblox fait tourner le refresh token a chaque rafraichissement.

    Sans cette sauvegarde, le jeton stocke dans les preferences devient
    invalide des le prochain lancement et le plugin parait deconnecte.
    Le createur selectionne est enregistre par le plugin lui-meme : y toucher
    ici casse l'ecriture du jeton (l'ID Roblox depasse la plage de l'index).
    """
    try:
        stored = addon_preferences(plugin_name)
        token_data = getattr(client, "token_data", {}) or {}
        refresh_token = token_data.get("refresh_token")
        if not refresh_token:
            return
        stored.refresh_token = refresh_token
        try:
            creator_details.save_creator_details(bpy.context.window_manager, preferences)
        except Exception:
            # L'index du createur peut echouer en headless ; le jeton reste valide.
            traceback.print_exc()
        bpy.ops.wm.save_userpref()
    except Exception:
        traceback.print_exc()


def status_payload(request, client, rbx, creator, plugin_name):
    export_scale = getattr(addon_preferences(plugin_name), "export_scale", None)
    payload = {
        "ok": True,
        "plugin": True,
        "loggedIn": True,
        "user": getattr(client, "name", None),
        "creators": [creator_payload(item) for item in rbx.creators],
        "selected": creator_payload(creator),
        "exportScale": export_scale,
        "message": f"Plugin Roblox connecté : {getattr(client, 'name', '?')} ({creator.type} {creator.id})."
    }
    if request.get("action") == "login":
        payload["message"] = (
            f"Connexion Roblox rétablie ({getattr(client, 'name', '?')} · {creator.type} {creator.id}). "
            "La session est enregistrée dans le plugin."
        )
        payload["loggedInNow"] = True
    return payload


def login(client, request):
    """Meme flux OAuth que le bouton « Log in » du plugin, mais en headless.

    Le plugin ouvre le navigateur et attend le retour sur localhost:8181 ;
    tout tourne dans une seule boucle asyncio, donc aucun minuteur Blender
    n'est necessaire. L'utilisateur doit autoriser l'acces dans son navigateur.
    """
    timeout = int(request.get("loginTimeout") or DEFAULT_LOGIN_TIMEOUT)
    timeout = min(max(timeout, 20), 600)

    async def flow():
        return await asyncio.wait_for(client.login(), timeout=timeout)

    asyncio.run(flow())


def main():
    request = read_request()
    plugin_name = request.get("plugin") or DEFAULT_PLUGIN

    try:
        creator_details, oauth2_client_module = load_addon(plugin_name)
    except Exception as exception:
        traceback.print_exc()
        finish(request, {
            "ok": False,
            "needs_plugin": True,
            "message": (
                "Le plugin « Upload to Roblox » n'est pas disponible dans Blender. "
                "Installe-le et active-le dans Blender, puis reconnecte-toi."
            ),
            "detail": short_error(exception)
        })
        return

    window_manager = bpy.context.window_manager
    preferences = bpy.context.preferences
    rbx = window_manager.rbx

    try:
        creator_details.load_creator_details(window_manager, preferences)
    except Exception:
        traceback.print_exc()

    client = oauth2_client_module.RbxOAuth2Client(rbx)

    if request.get("action") == "login":
        try:
            login(client, request)
        except asyncio.TimeoutError:
            finish(request, {
                "ok": False,
                "needs_login": True,
                "message": (
                    "La connexion Roblox n'a pas été autorisée dans le délai imparti. "
                    "Relance l'outil et clique « Autoriser » dans le navigateur."
                )
            })
            return
        except Exception as exception:
            traceback.print_exc()
            finish(request, {
                "ok": False,
                "needs_login": True,
                "message": (
                    "La connexion Roblox a échoué. Réessaie, ou clique « Log in » dans le "
                    "panneau Roblox de Blender si le navigateur ne s'ouvre pas."
                ),
                "detail": short_error(exception)
            })
            return
    else:
        try:
            asyncio.run(client.refresh_login_if_needed())
        except Exception as exception:
            traceback.print_exc()
            finish(request, {
                "ok": False,
                "needs_login": True,
                "message": (
                    "Le plugin Roblox Blender n'est pas connecté. Relance avec "
                    "roblox_asset {\"action\":\"login\"} : l'outil ouvre la page Roblox "
                    "dans le navigateur et enregistre la session."
                ),
                "detail": short_error(exception)
            })
            return

    creator = select_creator(rbx, preferences, plugin_name, request.get("creatorId"))
    if creator is None:
        finish(request, {
            "ok": False,
            "needs_login": True,
            "message": "Aucun créateur Roblox n'est disponible dans le plugin. Reconnecte-toi dans Blender."
        })
        return

    rbx["creator"] = creator.id
    persist_session(client, rbx, preferences, plugin_name, creator_details)

    if request.get("action") in ("status", "login"):
        finish(request, status_payload(request, client, rbx, creator, plugin_name))
        return

    file_path = Path(str(request.get("file") or ""))
    if not file_path.is_file():
        finish(request, {"ok": False, "message": f"Fichier introuvable : {file_path}"})
        return

    try:
        from assets_upload_client import AssetsUploadClient
        from openapi_client.models import (
            RobloxOpenCloudAssetsV1Creator as AssetsCreator,
            RobloxOpenCloudAssetsV1AssetType as AssetType,
        )
    except Exception as exception:
        traceback.print_exc()
        finish(request, {
            "ok": False,
            "needs_plugin": True,
            "message": (
                "Les dépendances du plugin Roblox Blender sont incomplètes. "
                "Ouvre Blender, panneau Roblox, clique « Install Dependencies », puis redémarre Blender."
            ),
            "detail": short_error(exception)
        })
        return

    asset_type = getattr(AssetType, str(request.get("assetType") or "MODEL").upper(), None)
    if asset_type is None:
        finish(request, {"ok": False, "message": f"Type d'asset inconnu : {request.get('assetType')}"})
        return

    if creator.type == "GROUP":
        asset_creator = AssetsCreator(group_id=int(creator.id))
    else:
        asset_creator = AssetsCreator(user_id=int(creator.id))

    access_token = client.token_data.get("access_token")
    if not access_token:
        finish(request, {"ok": False, "needs_login": True, "message": "Jeton d'accès absent : reconnecte le plugin dans Blender."})
        return

    asset_name = str(request.get("name") or file_path.stem)[:50]
    description = str(request.get("description") or "")[:1000]
    asset_id = int(request.get("assetId") or 0)
    poll_tries = int(request.get("pollTries") or 24)

    async def upload():
        async with AssetsUploadClient(creator=asset_creator, oauth2_token=access_token) as upload_client:
            return await upload_client.upload_asset_and_wait_for_done_async(
                asset_type=asset_type,
                asset_name=asset_name,
                asset_description=description,
                file_path=str(file_path),
                asset_id=asset_id,
                upload_request_timeout_seconds=180,
                num_poll_status_tries=min(max(poll_tries, 1), 60),
                poll_status_request_timeout_seconds=20,
            )

    try:
        operation = asyncio.run(upload())
    except Exception as exception:
        traceback.print_exc()
        finish(request, {
            "ok": False,
            "message": f"Roblox a refusé l'upload : {short_error(exception)}",
            "detail": traceback.format_exc()[-2000:]
        })
        return

    if getattr(operation, "error", None):
        error = operation.error
        finish(request, {
            "ok": False,
            "message": f"Roblox a refusé l'upload : {getattr(error, 'message', 'erreur inconnue')}",
            "error": {
                "code": getattr(error, "code", None),
                "message": getattr(error, "message", None)
            }
        })
        return

    if not getattr(operation, "done", False):
        finish(request, {
            "ok": True,
            "pending": True,
            "operation": getattr(operation, "path", None),
            "creator": creator_payload(creator)
        })
        return

    response = getattr(operation, "response", None)
    if response is None:
        finish(request, {"ok": False, "message": "Roblox a terminé l'opération sans renvoyer d'asset."})
        return

    moderation = None
    moderation_result = getattr(response, "moderation_result", None)
    if moderation_result is not None:
        moderation = getattr(moderation_result, "moderation_state", None)

    finish(request, {
        "ok": True,
        "assetId": str(getattr(response, "asset_id", "") or ""),
        "revisionId": str(getattr(response, "revision_id", "") or ""),
        "moderation": moderation,
        "creator": creator_payload(creator),
        "operation": getattr(operation, "path", None),
        "message": f"Asset {getattr(response, 'asset_id', '?')} envoyé sur Roblox ({moderation or 'modération inconnue'})."
    })


try:
    main()
except Exception:
    traceback.print_exc()
    try:
        finish(read_request(), {
            "ok": False,
            "message": "Erreur inattendue du script d'upload du plugin.",
            "detail": traceback.format_exc()[-2000:]
        })
    except Exception:
        pass
