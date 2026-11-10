"use strict";

/**
 * Outil roblox_asset — décrit et construit des modèles 3D réels dans Blender.
 * Le résultat est un ensemble de GLB LOD0–LOD3, des textures PNG, un aperçu et
 * une entrée dans assets/library.json.
 */

const path = require("node:path");

const { state } = require("../../state");
const { ui } = require("../../ui-bridge");
const { slugify } = require("../../roblox/blueprint");
const {
    KINDS,
    SHAPES,
    MATERIALS,
    IMPORT_EXTENSIONS,
    AUDIO_EXTENSIONS,
    SOURCES_DIR,
    AUDIO_DIR,
    saveSpec,
    listSpecs,
    readSpec,
    findAsset,
    findAudio,
    readAudioLibrary,
    updateAudioEntry,
    checkSpecInput,
    stageSource,
    stageAudio
} = require("../../roblox/assets");
const { buildAsset, importAsset, detectBlender } = require("../../roblox/blender");
const { uploadAsset } = require("../../roblox/opencloud");
const { pluginStatus, pluginLogin, uploadWithPlugin, uploadAudioWithPlugin } = require("../../roblox/plugin");
const { readLibrary } = require("../../roblox/project");
const { requireString } = require("../core/args");

const ACTIONS = new Set(["spec", "import", "build", "upload", "audio", "plugin", "login", "list", "show", "schema"]);

const EXAMPLE = {
    id: "wooden-sword",
    name: "Épée en bois",
    kind: "weapon",
    description: "Arme simple taillée dans une branche.",
    tags: ["starter", "melee"],
    lodRatios: [1, 0.5, 0.25, 0.1],
    parts: [
        {
            name: "Blade",
            shape: "box",
            size: [0.5, 0.18, 3.2],
            position: [0, 0, 2.4],
            rotation: [0, 0, 0],
            material: "wood",
            color: "#a8713f"
        },
        {
            name: "Guard",
            shape: "box",
            size: [1.4, 0.3, 0.22],
            position: [0, 0, 0.8],
            material: "metal",
            color: "#c8b06a"
        },
        {
            name: "Grip",
            shape: "cylinder",
            size: [0.34, 0.34, 0.9],
            position: [0, 0, 0.35],
            material: "fabric",
            color: "#5a3a24"
        }
    ]
};

const IMPORT_EXAMPLE = {
    action: "import",
    path: "C:/Users/moi/Downloads/chest.glb",
    id: "chest",
    name: "Coffre en bois",
    kind: "prop",
    height: 1.2,
    bevel: false
};

const AUDIO_EXAMPLE = {
    action: "audio",
    path: "C:/Users/moi/Downloads/sword_swing_01.ogg",
    id: "sword-swing-01",
    name: "Coup d'épée",
    usage: "épée, Activated",
    source_url: "https://freesound.org/s/…",
    author: "pseudo",
    license: "CC0"
};

function workspace() {
    if (!state.workspace) {
        throw new Error("Aucun projet ouvert. Choisis le dossier du jeu avant de continuer.");
    }
    return state.workspace;
}

async function run(args = {}) {
    const action = String(args.action || "").trim().toLowerCase();
    const root = workspace();

    if (action === "schema") {
        return {
            blender: detectBlender(),
            example: EXAMPLE,
            kinds: [...KINDS],
            shapes: [...SHAPES],
            materials: [...MATERIALS],
            importFormats: [...IMPORT_EXTENSIONS],
            audioFormats: [...AUDIO_EXTENSIONS],
            importExample: IMPORT_EXAMPLE,
            audioExample: AUDIO_EXAMPLE,
            upload: {
                action: "upload",
                provider: "plugin",
                requires: [
                    "Blender installé",
                    "plugin « Upload to Roblox » activé dans Blender",
                    "session Roblox valide (action:login si elle a expiré)"
                ],
                optional: "provider:opencloud utilise une clé API à la place du plugin"
            },
            message:
                "Décris un asset avec parts puis action:spec, ou importe un modèle existant avec " +
                "action:import (GLB, glTF, FBX, OBJ, STL, BLEND). Ensuite action:build/import, " +
                "examine l'aperçu avec view_image, puis action:upload. L'upload passe par le compte " +
                "déjà connecté dans le plugin Roblox Blender, sans clé Open Cloud. " +
                "action:audio importe un son, action:upload l'envoie avec le même compte. " +
                "action:login rétablit la session OAuth dans le navigateur si elle a expiré."
        };
    }

    if (action === "plugin") {
        return pluginStatus(root, { timeoutMs: Number.isInteger(args.timeout_ms) ? args.timeout_ms : undefined });
    }

    if (action === "login") {
        if (args.confirm !== false && !(await ui.confirm(
            "Ouvrir la page Roblox dans ton navigateur pour reconnecter le plugin Blender ? " +
            "Tu devras cliquer « Autoriser » ; aucun mot de passe n'est demandé à l'application."
        ))) {
            return { ok: false, denied: true, message: "Connexion refusée par l'utilisateur." };
        }
        const result = await pluginLogin(root, {
            timeoutMs: Number.isInteger(args.timeout_ms) ? args.timeout_ms : undefined,
            loginTimeout: Number.isInteger(args.login_timeout_s) ? args.login_timeout_s : undefined,
            creatorId: args.creator_id
        });
        return {
            ...result,
            message: result.ok
                ? `${result.message} Tu peux relancer l'upload.`
                : result.message
        };
    }

    if (action === "audio") {
        requireString(args.path, "path");
        const rawId = String(args.id || args.name || path.basename(args.path, path.extname(args.path)) || "").trim();
        const id = slugify(rawId);
        if (!id) throw new Error("Identifiant audio invalide : renseigne id ou name.");

        if (args.confirm !== false && !(await ui.confirm(
            `Importer le son « ${args.name || id} » depuis ${args.path} ? ` +
            `Copie dans ${AUDIO_DIR}/, puis upload possible avec le plugin Blender.`
        ))) {
            return { ok: false, denied: true, message: "Import audio refusé par l'utilisateur." };
        }

        let staged;
        try {
            staged = await stageAudio(root, args.path, id);
        } catch (error) {
            return { ok: false, message: error.message };
        }

        const entry = await updateAudioEntry(root, {
            id,
            name: String(args.name || id).slice(0, 60),
            description: String(args.description || args.usage || "").slice(0, 500),
            file: staged.rel,
            format: staged.extension.replace(".", ""),
            bytes: staged.bytes,
            usage: args.usage ? String(args.usage).slice(0, 120) : "",
            credit: {
                source: args.source_url ? String(args.source_url).slice(0, 500) : "",
                author: args.author ? String(args.author).slice(0, 120) : "",
                license: args.license ? String(args.license).slice(0, 80) : ""
            },
            createdAt: new Date().toISOString()
        });

        return {
            ok: true,
            sound: entry,
            source: {
                original: staged.absolute,
                staged: staged.rel,
                bytes: staged.bytes,
                copied: staged.copied
            },
            message:
                `Son « ${entry.name} » copié dans ${entry.file}. ` +
                `Envoie-le sur Roblox avec roblox_asset {"action":"upload","id":"${entry.id}"} : ` +
                "le compte connecté dans le plugin Blender sera utilisé."
        };
    }

    if (action === "import") {
        requireString(args.path, "path");
        const rawId = String(args.id || args.name || path.basename(args.path, path.extname(args.path)) || "").trim();
        const id = slugify(rawId);
        if (!id) throw new Error("Identifiant d'import invalide : renseigne id ou name.");
        const source = String(args.path).trim();

        if (args.confirm !== false && !(await ui.confirm(
            `Importer « ${args.name || id} » depuis ${source} ? ` +
            `Copie dans ${SOURCES_DIR}/, puis Blender produit LOD0–LOD3 et un aperçu.`
        ))) {
            return { ok: false, denied: true, message: "Import refusé par l'utilisateur." };
        }

        let staged;
        try {
            staged = await stageSource(root, source, id);
        } catch (error) {
            return { ok: false, message: error.message };
        }

        const saved = await saveSpec(root, {
            id,
            name: args.name || id,
            kind: args.kind || "prop",
            description: args.description,
            tags: args.tags,
            source: staged.rel,
            height: args.height,
            scale: args.scale,
            rotation: args.rotation,
            lodRatios: args.lod_ratios,
            bevel: args.bevel === true
        }, { confirm: false });

        const result = await importAsset(root, saved.spec.id, {
            confirm: false,
            timeoutMs: Number.isInteger(args.timeout_ms) ? args.timeout_ms : undefined
        });

        return {
            ...result,
            spec: saved.path,
            source: {
                original: staged.absolute,
                staged: staged.rel,
                bytes: staged.bytes,
                copied: staged.copied
            }
        };
    }

    if (action === "spec") {
        checkSpecInput(args.asset);
        const result = await saveSpec(root, args.asset, { confirm: args.confirm !== false });
        return {
            spec: result.spec,
            path: result.path,
            write: result.write,
            message: `Spécification enregistrée : ${result.path}. Lance action:build avec id "${result.spec.id}".`
        };
    }

    if (action === "build") {
        requireString(args.id, "id");
        const result = await buildAsset(root, args.id, {
            confirm: args.confirm !== false,
            timeoutMs: Number.isInteger(args.timeout_ms) ? args.timeout_ms : undefined
        });
        return result;
    }

    if (action === "upload") {
        requireString(args.id, "id");
        const provider = String(args.provider || "plugin").trim().toLowerCase();
        if (!["plugin", "opencloud", "auto"].includes(provider)) {
            return { ok: false, message: `provider inconnu : ${provider}. Utilise plugin (défaut) ou opencloud.` };
        }

        const [model, sound] = await Promise.all([findAsset(root, args.id), findAudio(root, args.id)]);
        if (!model && !sound) {
            return {
                ok: false,
                message:
                    `Asset inconnu : ${args.id}. Construis/importe un modèle (action:build ou action:import) ` +
                    "ou un son (action:audio) avant action:upload."
            };
        }

        const common = {
            confirm: args.confirm !== false,
            displayName: args.display_name,
            description: args.description,
            creatorId: args.creator_id,
            timeoutMs: Number.isInteger(args.timeout_ms) ? args.timeout_ms : undefined,
            pollTries: Number.isInteger(args.poll_tries) ? args.poll_tries : undefined
        };

        if (sound && !model) {
            if (provider === "opencloud") {
                return {
                    ok: false,
                    message:
                        "L'upload audio passe par le compte connecté dans le plugin Blender ; " +
                        "l'option provider:opencloud ne concerne que les modèles 3D."
                };
            }
            return uploadAudioWithPlugin(root, args.id, common);
        }

        if (provider === "opencloud") {
            return uploadAsset(root, args.id, {
                ...common,
                creatorType: args.creator_type
            });
        }

        return uploadWithPlugin(root, args.id, common);
    }

    if (action === "list") {
        const [specs, library, audio] = await Promise.all([listSpecs(root), readLibrary(root), readAudioLibrary(root)]);
        return {
            specs,
            assets: library.assets.map(asset => ({
                id: asset.id,
                name: asset.name,
                kind: asset.kind,
                lods: asset.lods || 0,
                preview: asset.preview || null,
                builtAt: asset.builtAt || null,
                assetId: asset.upload?.assetId || null
            })),
            sounds: audio.sounds.map(sound => ({
                id: sound.id,
                name: sound.name,
                file: sound.file,
                format: sound.format,
                bytes: sound.bytes,
                assetId: sound.upload?.assetId || null
            })),
            blender: detectBlender(),
            message:
                `${specs.length} spécification(s), ${library.assets.length} asset(s), ` +
                `${audio.sounds.length} son(s) dans le projet.`
        };
    }

    if (action === "show") {
        requireString(args.id, "id");
        const [spec, asset, sound] = await Promise.all([
            readSpec(root, args.id).catch(() => null),
            findAsset(root, args.id),
            findAudio(root, args.id)
        ]);
        return {
            spec,
            asset,
            sound,
            message: asset
                ? `Asset ${args.id} construit le ${asset.builtAt}. Aperçu : ${asset.preview}`
                : sound
                    ? `Son ${args.id} prêt : ${sound.file}${sound.upload?.assetId ? ` (rbxassetid://${sound.upload.assetId})` : " (pas encore uploadé)"}.`
                    : `Aucun asset ni son nommé ${args.id}.`
        };
    }

    throw new Error(`Action inconnue : ${action}. Actions : ${[...ACTIONS].join(", ")}.`);
}

function check(args = {}) {
    const action = String(args.action || "").trim().toLowerCase();
    if (!ACTIONS.has(action)) {
        throw new Error(`action doit être : ${[...ACTIONS].join(", ")}.`);
    }
    if (action === "spec") checkSpecInput(args.asset);
    if (action === "import" || action === "audio") requireString(args.path, "path");
    if (action === "build" || action === "show" || action === "upload") requireString(args.id, "id");
}

function describe(args = {}) {
    if (args.action === "spec") return args.asset?.name || args.asset?.id || "spécification";
    if (args.action === "import") return args.name || args.path || "import";
    if (args.action === "audio") return args.name || args.path || "son";
    if (args.action === "plugin") return "plugin Roblox";
    if (args.action === "login") return "connexion Roblox";
    return args.id || args.action || "?";
}

module.exports = { name: "roblox_asset", run, check, describe, ACTIONS, EXAMPLE, IMPORT_EXAMPLE, AUDIO_EXAMPLE };
