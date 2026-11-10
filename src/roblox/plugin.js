"use strict";

/**
 * Upload vers Roblox avec le plugin Roblox Blender déjà installé et connecté.
 *
 * Le plugin stocke un refresh token OAuth dans les préférences de l'add-on.
 * On lance Blender sans `--factory-startup`, on recharge ce jeton, puis on
 * appelle directement `AssetsUploadClient` avec le token obtenu. Aucune clé
 * Open Cloud n'est nécessaire et aucun asset n'est créé dans Studio.
 *
 * Le même jeton `asset:write` sert aux modèles 3D et aux fichiers audio.
 */

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { ui } = require("../ui-bridge");
const { runProcess } = require("../tools/command/runner");
const { findAsset, findAudio, readAudioLibrary, updateAudioEntry, updateLibraryAsset } = require("./assets");
const { readLibrary, writeGenerated } = require("./project");
const { detectBlender, template } = require("./blender");

const PLUGIN_SCRIPT = template("plugin_upload.py");
const PLUGIN_NAME = "roblox-blender-plugin-main";
const MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 540000;
const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav", ".flac"]);

function pluginResultPath(dir) {
    return path.join(dir, "result.json");
}

function cleanResult(result) {
    const text = String(result?.output || "");
    return text.trim().slice(-4000);
}

/**
 * Exécute le script Blender qui parle au plugin. `request` est écrit dans un
 * fichier temporaire pour éviter les problèmes de quoting des chemins Windows.
 */
async function runPlugin(workspace, request, options = {}) {
    const blender = detectBlender();
    if (!blender.found) {
        return {
            ok: false,
            blender,
            message:
                "Blender est introuvable. Le plugin Roblox Blender doit être installé dans Blender, " +
                "puis Blender doit être choisi dans les réglages."
        };
    }

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fsc-roblox-plugin-"));
    const requestFile = path.join(dir, "request.json");
    const resultFile = pluginResultPath(dir);
    await fs.writeFile(requestFile, JSON.stringify({ ...request, result: resultFile }, null, 2), "utf8");

    let result;
    try {
        result = await runProcess({
            file: blender.path,
            args: ["--background", "--python", PLUGIN_SCRIPT, "--", "--request", requestFile],
            cwd: workspace,
            timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS
        });
    } catch (error) {
        return {
            ok: false,
            blender,
            message: `Blender n'a pas pu démarrer : ${error.message}`
        };
    } finally {
        // Le dossier ne contient que la requête et le résultat, jamais le jeton.
        setTimeout(() => fs.rm(dir, { recursive: true, force: true }).catch(() => {}), 5000).unref?.();
    }

    let payload;
    try {
        payload = JSON.parse(await fs.readFile(resultFile, "utf8"));
    } catch {
        return {
            ok: false,
            blender,
            output: cleanResult(result),
            message: result?.timed_out
                ? "Blender n'a pas terminé dans le délai imparti."
                : `Le plugin Roblox n'a pas répondu (code ${result?.exit_code ?? "?"}). ` +
                  "Vérifie que Blender et le plugin « Upload to Roblox » sont installés."
        };
    }

    return {
        ...payload,
        blender,
        output: cleanResult(result)
    };
}

/** Vérifie la connexion au plugin sans rien envoyer. */
async function pluginStatus(workspace, options = {}) {
    return runPlugin(workspace, { action: "status", plugin: PLUGIN_NAME }, options);
}

/**
 * Rétablit la session OAuth du plugin quand le refresh token est révoqué.
 * Ouvre la page Roblox dans le navigateur et attend l'autorisation.
 */
async function pluginLogin(workspace, options = {}) {
    const loginSeconds = Number.isInteger(options.loginTimeout) ? Math.min(Math.max(options.loginTimeout, 20), 600) : 240;
    const budget = loginSeconds * 1000 + 120000;
    return runPlugin(workspace, {
        action: "login",
        plugin: PLUGIN_NAME,
        loginTimeout: loginSeconds,
        creatorId: options.creatorId
    }, { timeoutMs: Math.max(options.timeoutMs || 0, budget) });
}

/**
 * Envoie le LOD0 d'un modèle avec le compte connecté dans le plugin Blender.
 * Met à jour assets/library.json et src/shared/AssetIds.luau.
 */
async function uploadWithPlugin(workspace, id, options = {}) {
    const asset = await findAsset(workspace, id);
    if (!asset) {
        return {
            ok: false,
            message: `Asset inconnu : ${id}. Construis-le ou importe-le d'abord avec roblox_asset.`
        };
    }

    const fileRel = asset.files?.lod0;
    if (!fileRel) {
        return { ok: false, message: `« ${asset.name} » n'a pas de LOD0 : lance action:build ou action:import d'abord.` };
    }

    const fileAbs = path.join(workspace, fileRel);
    let info;
    try {
        info = await fs.stat(fileAbs);
    } catch {
        return { ok: false, message: `Fichier absent : ${fileRel}. Reconstruis l'asset.` };
    }
    if (info.size > MAX_BYTES) {
        return {
            ok: false,
            message: `Le GLB fait ${(info.size / 1024 / 1024).toFixed(1)} Mo : la limite Roblox est de 20 Mo.`
        };
    }

    if (options.confirm !== false && !(await ui.confirm(
        `Envoyer « ${asset.name} » (${(info.size / 1024).toFixed(0)} Ko) sur Roblox ` +
        "avec le compte connecté dans le plugin Blender ?"
    ))) {
        return { ok: false, denied: true, message: "Upload refusé par l'utilisateur." };
    }

    const result = await runPlugin(workspace, {
        action: "upload",
        plugin: PLUGIN_NAME,
        assetType: "Model",
        file: fileAbs,
        name: options.displayName || asset.name,
        description: options.description || asset.description || `Modèle importé par France-Students-code-Roblox : ${asset.id}`,
        creatorId: options.creatorId,
        assetId: options.assetId,
        pollTries: options.pollTries
    }, options);

    if (!result.ok) {
        return {
            ...result,
            blender: result.blender,
            message: result.message || "L'upload via le plugin a échoué."
        };
    }

    if (result.pending) {
        return {
            ...result,
            message:
                `Upload lancé avec l'opération ${result.operation}, mais Roblox n'a pas encore terminé. ` +
                "Ne relance pas l'envoi ; vérifie l'asset dans le Creator Dashboard."
        };
    }

    if (!result.assetId) {
        return {
            ...result,
            ok: false,
            message: "Roblox a terminé l'upload sans renvoyer d'assetId : ne considère pas le modèle comme envoyé."
        };
    }

    const entry = {
        ...asset,
        upload: {
            provider: "plugin",
            assetId: result.assetId,
            revisionId: result.revisionId,
            moderation: result.moderation || "unknown",
            creator: result.creator,
            file: fileRel,
            at: new Date().toISOString()
        }
    };
    await updateLibraryAsset(workspace, entry);
    await writeGenerated(workspace, `${path.dirname(fileRel)}/asset.json`, JSON.stringify(entry, null, 2) + "\n");
    const ids = await writeAssetIds(workspace);

    return {
        ok: true,
        provider: "plugin",
        assetId: result.assetId,
        revisionId: result.revisionId,
        moderation: result.moderation,
        creator: result.creator,
        file: fileRel,
        assetIds: ids,
        blender: result.blender,
        message:
            `Modèle envoyé sur Roblox via le plugin : assetId ${result.assetId} ` +
            `(${result.moderation || "modération inconnue"}). ` +
            `AssetIds.luau mis à jour (${ids.count} identifiant(s)). ` +
            `Utilise rbxassetid://${result.assetId} dans Studio.`
    };
}

/** Envoie un son préparé avec le même compte OAuth que le plugin. */
async function uploadAudioWithPlugin(workspace, id, options = {}) {
    const sound = await findAudio(workspace, id);
    if (!sound) {
        return {
            ok: false,
            message: `Son inconnu : ${id}. Importe-le d'abord avec roblox_asset action:audio (path).`
        };
    }

    const fileRel = sound.file;
    const fileAbs = path.join(workspace, fileRel);
    let info;
    try {
        info = await fs.stat(fileAbs);
    } catch {
        return { ok: false, message: `Fichier audio absent : ${fileRel}. Réimporte-le avec action:audio.` };
    }
    if (!AUDIO_EXTENSIONS.has(path.extname(fileAbs).toLowerCase())) {
        return { ok: false, message: `Format audio non pris en charge : ${path.extname(fileAbs) || "(sans extension)"}.` };
    }
    if (info.size > MAX_BYTES) {
        return {
            ok: false,
            message: `Le son fait ${(info.size / 1024 / 1024).toFixed(1)} Mo : la limite Roblox est de 20 Mo.`
        };
    }

    if (options.confirm !== false && !(await ui.confirm(
        `Envoyer « ${sound.name} » (${(info.size / 1024).toFixed(0)} Ko) sur Roblox ` +
        "avec le compte connecté dans le plugin Blender ?"
    ))) {
        return { ok: false, denied: true, message: "Upload refusé par l'utilisateur." };
    }

    const result = await runPlugin(workspace, {
        action: "upload",
        plugin: PLUGIN_NAME,
        assetType: "Audio",
        file: fileAbs,
        name: options.displayName || sound.name,
        description: options.description || sound.description || `Son importé par France-Students-code-Roblox : ${sound.id}`,
        creatorId: options.creatorId,
        pollTries: options.pollTries
    }, options);

    if (!result.ok) {
        return { ...result, blender: result.blender, message: result.message || "L'upload audio via le plugin a échoué." };
    }

    if (result.pending) {
        return {
            ...result,
            message:
                `Upload audio lancé (opération ${result.operation}) mais pas encore terminé. ` +
                "Ne relance pas l'envoi ; vérifie le son dans le Creator Dashboard."
        };
    }

    if (!result.assetId) {
        return {
            ...result,
            ok: false,
            message: "Roblox a terminé l'upload audio sans renvoyer d'assetId : ne considère pas le son comme envoyé."
        };
    }

    const entry = {
        ...sound,
        upload: {
            provider: "plugin",
            assetId: result.assetId,
            revisionId: result.revisionId,
            moderation: result.moderation || "unknown",
            creator: result.creator,
            file: fileRel,
            at: new Date().toISOString()
        }
    };
    await updateAudioEntry(workspace, entry);
    const ids = await writeAssetIds(workspace);

    return {
        ok: true,
        provider: "plugin",
        assetId: result.assetId,
        revisionId: result.revisionId,
        moderation: result.moderation,
        creator: result.creator,
        file: fileRel,
        assetIds: ids,
        blender: result.blender,
        message:
            `Son envoyé sur Roblox via le plugin : assetId ${result.assetId} ` +
            `(${result.moderation || "modération inconnue"}). ` +
            `AssetIds.luau mis à jour (${ids.count} identifiant(s)). ` +
            `Utilise rbxassetid://${result.assetId} dans un Sound.`
    };
}

function luauKey(id, used) {
    let key = String(id || "asset").replace(/[^A-Za-z0-9_]/g, "_");
    if (!key || /^[0-9]/.test(key)) key = `_${key || "asset"}`;
    let candidate = key;
    let index = 2;
    while (used.has(candidate)) candidate = `${key}_${index++}`;
    used.add(candidate);
    return candidate;
}

function luauString(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");
}

/**
 * Génère src/shared/AssetIds.luau à partir des uploads réels. Les systèmes
 * Luau peuvent référencer `AssetIds.chest` au lieu de copier un ID à la main.
 */
async function writeAssetIds(workspace) {
    const [library, audio] = await Promise.all([readLibrary(workspace), readAudioLibrary(workspace)]);
    const rows = [];
    for (const asset of library.assets) {
        if (asset.upload?.assetId) rows.push({ id: asset.id, name: asset.name, assetId: asset.upload.assetId, kind: "Model" });
    }
    for (const sound of audio.sounds) {
        if (sound.upload?.assetId) rows.push({ id: sound.id, name: sound.name, assetId: sound.upload.assetId, kind: "Audio" });
    }
    rows.sort((left, right) => String(left.id).localeCompare(String(right.id), "fr"));

    const used = new Set();
    const lines = rows.map(row => {
        const key = luauKey(row.id, used);
        return `\t${key} = "rbxassetid://${row.assetId}", -- ${row.kind} : ${luauString(row.name || row.id)}`;
    });

    const content =
        "-- Généré par France-Students-code-Roblox à partir des uploads Roblox réels.\n" +
        "-- Ne pas éditer à la main : relance roblox_asset action:upload après un nouvel envoi.\n" +
        "local AssetIds = {\n" +
        (lines.length ? lines.join("\n") + "\n" : "") +
        "}\n\n" +
        "return AssetIds\n";

    await writeGenerated(workspace, "src/shared/AssetIds.luau", content);
    return { path: "src/shared/AssetIds.luau", count: rows.length, ids: rows.map(row => ({ id: row.id, assetId: row.assetId, kind: row.kind })) };
}

module.exports = {
    PLUGIN_NAME,
    pluginStatus,
    pluginLogin,
    uploadWithPlugin,
    uploadAudioWithPlugin,
    writeAssetIds
};
