"use strict";

/**
 * Upload des modèles vers Roblox avec l'API Open Cloud Assets.
 *
 * Alternative au plugin Roblox Blender, qui exige Blender en mode graphique et
 * une connexion OAuth. L'API accepte les GLB/FBX/glTF et crée un package Model.
 * La clé n'est jamais écrite dans le projet ni renvoyée à l'agent.
 *
 * Configuration (dans l'ordre) :
 *   1. variables d'environnement ROBLOX_OPEN_CLOUD_KEY, ROBLOX_CREATOR_ID,
 *      ROBLOX_CREATOR_TYPE (user ou group) ;
 *   2. fichier CONFIG.dataDir/roblox-open-cloud.json :
 *      { "apiKey": "...", "creatorId": "123", "creatorType": "user" }
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const { CONFIG } = require("../config");
const { ui } = require("../ui-bridge");
const { findAsset, updateLibraryAsset } = require("./assets");
const { writeGenerated, json } = require("./project");

const API = "https://apis.roblox.com/assets/v1";
const CONFIG_FILE = "roblox-open-cloud.json";
const MAX_BYTES = 20 * 1024 * 1024;
const POLL_ATTEMPTS = 30;
const POLL_DELAY_MS = 2000;

const CONTENT_TYPES = {
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".fbx": "model/fbx",
    ".rbxm": "model/x-rbxm",
    ".rbxmx": "model/x-rbxm"
};

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fileConfig() {
    try {
        const raw = JSON.parse(await fs.readFile(path.join(CONFIG.dataDir, CONFIG_FILE), "utf8"));
        return raw && typeof raw === "object" ? raw : {};
    } catch {
        return {};
    }
}

/**
 * Résout la configuration sans jamais exposer la clé dans le résultat public.
 * `creator_id` et `creator_type` peuvent venir des arguments de l'outil.
 */
async function resolveConfig({ creatorId, creatorType } = {}) {
    const file = await fileConfig();
    const apiKey = String(process.env.ROBLOX_OPEN_CLOUD_KEY || file.apiKey || "").trim();
    const id = String(creatorId || process.env.ROBLOX_CREATOR_ID || file.creatorId || "").trim();
    const type = String(creatorType || process.env.ROBLOX_CREATOR_TYPE || file.creatorType || "user").trim().toLowerCase();

    const missing = [];
    if (!apiKey) missing.push("ROBLOX_OPEN_CLOUD_KEY (ou apiKey dans " + CONFIG_FILE + ")");
    if (!id) missing.push("ROBLOX_CREATOR_ID (ou creatorId dans " + CONFIG_FILE + ")");
    if (!/^\d+$/.test(id)) missing.push("creatorId doit être un identifiant numérique Roblox");
    if (type !== "user" && type !== "group") missing.push("creatorType doit être user ou group");

    return {
        ready: missing.length === 0,
        apiKey,
        creatorId: id,
        creatorType: type,
        missing
    };
}

function contentError(message) {
    return message.replace(/x-api-key[^\s,;}]*/gi, "x-api-key (masquée)");
}

async function requestJson(url, options) {
    let response;
    try {
        response = await fetch(url, { ...options, signal: AbortSignal.timeout(120000) });
    } catch (error) {
        throw new Error(`Roblox est injoignable : ${error.message}`, { cause: error });
    }

    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }

    if (!response.ok) {
        const detail = data?.message || data?.error || text.slice(0, 500) || `HTTP ${response.status}`;
        throw new Error(`Open Cloud a refusé la requête (${response.status}) : ${contentError(String(detail))}`);
    }
    return data;
}

async function pollOperation(config, operationPath) {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        await delay(POLL_DELAY_MS);
        const data = await requestJson(`${API}/${operationPath}`, {
            headers: { "x-api-key": config.apiKey }
        });
        if (data?.done) {
            if (data.error) {
                throw new Error(`Upload échoué : ${contentError(String(data.error.message || JSON.stringify(data.error)))}`);
            }
            if (!data.response) {
                const detail = data.status?.message || data.status?.code || "aucune réponse de Roblox";
                throw new Error(`Upload échoué : ${contentError(String(detail))}`);
            }
            return data.response;
        }
    }
    return null;
}

function recommendedConfigMessage(missing) {
    return (
        "Upload Open Cloud non configuré : " + missing.join(" ; ") + ". " +
        "Crée une clé API sur create.roblox.com (Open Cloud → API Keys) avec la permission " +
        "« assets » en lecture/écriture, puis renseigne ROBLOX_OPEN_CLOUD_KEY, " +
        "ROBLOX_CREATOR_ID (ton ID utilisateur ou de groupe) et ROBLOX_CREATOR_TYPE (user ou group). " +
        `Alternative sans clé : fichier ${path.join(CONFIG.dataDir, CONFIG_FILE)} ou upload manuel/plugin Blender.`
    );
}

/**
 * Envoie le LOD0 d'un asset dans Roblox. Roblox applique ensuite son propre
 * LOD ; les LOD1–LOD3 restent locaux pour une bascule manuelle.
 */
async function uploadAsset(workspace, id, options = {}) {
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
            message: `Le GLB fait ${(info.size / 1024 / 1024).toFixed(1)} Mo : la limite Open Cloud est de 20 Mo. Réduis le maillage ou les textures.`
        };
    }

    const config = await resolveConfig({
        creatorId: options.creatorId,
        creatorType: options.creatorType
    });
    if (!config.ready) {
        return { ok: false, needs_config: true, missing: config.missing, message: recommendedConfigMessage(config.missing) };
    }

    const creatorLabel = config.creatorType === "group" ? `groupe ${config.creatorId}` : `utilisateur ${config.creatorId}`;
    if (options.confirm !== false && !(await ui.confirm(
        `Envoyer « ${asset.name} » (${(info.size / 1024).toFixed(0)} Ko) sur Roblox pour le ${creatorLabel} ?`
    ))) {
        return { ok: false, denied: true, message: "Upload refusé par l'utilisateur." };
    }

    const request = {
        assetType: "Model",
        displayName: String(options.displayName || asset.name).slice(0, 50),
        description: String(options.description || asset.description || `Modèle importé par France-Students-code-Roblox : ${asset.id}`).slice(0, 1000),
        creationContext: {
            creator: config.creatorType === "group"
                ? { groupId: config.creatorId }
                : { userId: config.creatorId }
        }
    };

    const extension = path.extname(fileRel).toLowerCase();
    const contentType = CONTENT_TYPES[extension] || "application/octet-stream";
    const buffer = await fs.readFile(fileAbs);
    const form = new FormData();
    form.append("request", JSON.stringify(request));
    form.append("fileContent", new Blob([buffer], { type: contentType }), path.basename(fileRel));

    let created;
    try {
        created = await requestJson(`${API}/assets`, {
            method: "POST",
            headers: { "x-api-key": config.apiKey },
            body: form
        });
    } catch (error) {
        return { ok: false, message: error.message };
    }

    const operationPath = String(created?.path || "").replace(/^\//, "");
    if (!operationPath) {
        return { ok: false, message: "Open Cloud n'a pas renvoyé d'opération d'upload.", response: created };
    }

    let result;
    try {
        result = await pollOperation(config, operationPath);
    } catch (error) {
        return { ok: false, operation: operationPath, message: error.message };
    }

    if (!result) {
        return {
            ok: true,
            pending: true,
            operation: operationPath,
            message:
                `Upload lancé mais encore en cours (opération ${operationPath}). ` +
                "Vérifie plus tard l'opération avec la clé Open Cloud ; ne relance pas l'envoi."
        };
    }

    const assetId = String(result.assetId || "");
    if (!assetId) {
        return { ok: false, operation: operationPath, response: result, message: "Opération terminée sans identifiant d'asset." };
    }

    const moderation = result.moderationResult?.moderationState || "unknown";
    const entry = {
        ...asset,
        upload: {
            assetId,
            operation: operationPath,
            creator: { type: config.creatorType, id: config.creatorId },
            moderation,
            file: fileRel,
            at: new Date().toISOString()
        }
    };
    await updateLibraryAsset(workspace, entry);
    await writeGenerated(workspace, `${path.dirname(fileRel)}/asset.json`, json(entry));

    return {
        ok: true,
        assetId,
        moderation,
        operation: operationPath,
        creator: { type: config.creatorType, id: config.creatorId },
        file: fileRel,
        message:
            `Modèle envoyé sur Roblox : assetId ${assetId} (${moderation}). ` +
            `Il apparaît comme package dans le Toolbox ; utilise rbxassetid://${assetId} ou insert_asset côté Studio.`
    };
}

module.exports = {
    API,
    CONFIG_FILE,
    resolveConfig,
    uploadAsset,
    recommendedConfigMessage
};
