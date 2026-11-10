"use strict";

/**
 * Spécifications d'assets 3D et bibliothèque du projet.
 *
 * Un asset est décrit par des primitives (boîtes, cylindres, sphères…) que le
 * script Blender transforme en un vrai maillage texturé, avec LOD0 à LOD3.
 * Aucune géométrie n'est créée dans Roblox Studio.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const { slugify } = require("./blueprint");
const { readLibrary, writeGenerated, writeProjectFiles, exists, json } = require("./project");
const { resolveInWorkspace } = require("../tools/security");
const { ensureParent } = require("../tools/core/fs-utils");

const SPECS_DIR = "assets/specs";
const MODELS_DIR = "assets/models";
const SOURCES_DIR = "assets/sources";
const AUDIO_DIR = "assets/audio";
const AUDIO_LIBRARY = `${AUDIO_DIR}/library.json`;
const MAX_PARTS = 40;
const MAX_DIMENSION = 80;
const MAX_SOURCE_BYTES = 200 * 1024 * 1024;
const IMPORT_EXTENSIONS = new Set([".glb", ".gltf", ".fbx", ".obj", ".stl", ".blend"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav", ".flac"]);
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

const KINDS = new Set(["prop", "weapon", "tool", "building", "creature", "terrain", "vehicle", "effect", "other"]);
const SHAPES = new Set(["box", "cylinder", "sphere", "cone", "torus"]);
const MATERIALS = new Set(["wood", "metal", "stone", "fabric", "glass", "plastic", "gold", "skin", "foliage"]);

const DEFAULT_PALETTE = {
    wood: "#8a5a32",
    metal: "#9aa4b2",
    stone: "#8a8e99",
    fabric: "#c84d4d",
    glass: "#7fd4e8",
    plastic: "#e0b13c",
    gold: "#e8b93c",
    skin: "#e0a878",
    foliage: "#4f9e4f"
};

function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
}

/** Couleur hexadécimale ou triplet 0-255 / 0-1 → triplet 0-1. */
function parseColor(value, fallback) {
    if (typeof value === "string" && /^#?[0-9a-f]{6}$/i.test(value.trim())) {
        const hex = value.trim().replace("#", "");
        return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
    }
    if (Array.isArray(value) && value.length >= 3) {
        const numbers = value.slice(0, 3).map(Number);
        if (numbers.every(number => Number.isFinite(number))) {
            const scaled = numbers.every(number => number <= 1) ? numbers : numbers.map(number => number / 255);
            return scaled.map(number => clamp(number, 0, 1, 0.5));
        }
    }
    return parseColor(fallback || "#9aa4b2", "#9aa4b2");
}

function parseRotation(value) {
    if (Array.isArray(value) && value.length >= 3) {
        const numbers = value.slice(0, 3).map(Number);
        if (numbers.every(number => Number.isFinite(number))) {
            return numbers.map(number => clamp(number, -360, 360, 0));
        }
    }
    return [0, 0, 0];
}

function parseVector(value, fallback, { positive = false } = {}) {
    if (Array.isArray(value) && value.length >= 3) {
        const numbers = value.slice(0, 3).map(Number);
        if (numbers.every(number => Number.isFinite(number))) {
            return numbers.map(number => positive
                ? clamp(number, 0.01, MAX_DIMENSION, fallback[0])
                : clamp(number, -MAX_DIMENSION, MAX_DIMENSION, 0));
        }
    }
    return [...fallback];
}

function normalizePart(raw, index) {
    if (!raw || typeof raw !== "object") {
        throw new Error(`parts[${index}] doit être un objet.`);
    }
    const shape = String(raw.shape || "box").toLowerCase();
    if (!SHAPES.has(shape)) {
        throw new Error(`parts[${index}].shape inconnu : ${shape}. Formes : ${[...SHAPES].join(", ")}.`);
    }
    const material = String(raw.material || "wood").toLowerCase();
    return {
        name: String(raw.name || `Part${index + 1}`).slice(0, 40),
        shape,
        size: parseVector(raw.size, [lengthOf(raw) || 1, lengthOf(raw) || 1, lengthOf(raw) || 1], { positive: true }),
        position: parseVector(raw.position, [0, 0, 0]),
        rotation: parseVector(raw.rotation, [0, 0, 0]),
        color: parseColor(raw.color, DEFAULT_PALETTE[material] || DEFAULT_PALETTE.wood),
        material: MATERIALS.has(material) ? material : "wood",
        texture: raw.texture !== false,
        smooth: raw.smooth === true
    };
}

function lengthOf(raw) {
    if (!Array.isArray(raw.size)) return 0;
    return Number(raw.size[0]);
}

/** Normalise une spécification complète, avec des valeurs sûres. */
function normalizeSpec(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("La spécification d'asset doit être un objet JSON.");
    }

    const name = String(raw.name || raw.id || "").trim();
    if (!name) throw new Error("Le nom de l'asset est obligatoire.");
    const id = slugify(raw.id || name);
    if (!id) throw new Error("Identifiant d'asset invalide.");

    const kind = String(raw.kind || "prop").toLowerCase();
    if (!KINDS.has(kind)) {
        throw new Error(`kind inconnu : ${kind}. Types : ${[...KINDS].join(", ")}.`);
    }

    const source = typeof raw.source === "string" ? raw.source.trim().replace(/\\/g, "/") : "";
    if (source) {
        const extension = path.extname(source).toLowerCase();
        if (!source.startsWith(`${SOURCES_DIR}/`) || source.includes("..") || !IMPORT_EXTENSIONS.has(extension)) {
            throw new Error(
                `source invalide : ${source}. Place le fichier via action:import ` +
                `(formats : ${[...IMPORT_EXTENSIONS].join(", ")}).`
            );
        }
    }

    let parts = source
        ? []
        : (Array.isArray(raw.parts) ? raw.parts.map(normalizePart) : []);
    if (parts.length > MAX_PARTS) {
        throw new Error(`Trop de pièces : ${parts.length} (maximum ${MAX_PARTS}).`);
    }
    if (!parts.length && !source) {
        const size = parseVector(raw.size, [2, 2, 2], { positive: true });
        parts = [normalizePart({
            name: "Body",
            shape: "box",
            size,
            position: [0, size[1] / 2, 0],
            material: raw.material || "wood",
            color: raw.color
        }, 0)];
    }

    const lodRatios = Array.isArray(raw.lodRatios)
        ? raw.lodRatios.slice(0, 4).map((ratio, index) => clamp(ratio, 0.05, 1, [1, 0.5, 0.25, 0.1][index]))
        : [1, 0.5, 0.25, 0.1];

    while (lodRatios.length < 4) lodRatios.push([1, 0.5, 0.25, 0.1][lodRatios.length]);
    lodRatios[0] = 1;

    return {
        version: 1,
        id,
        name: name.slice(0, 60),
        kind,
        description: String(raw.description || "").slice(0, 500),
        tags: Array.isArray(raw.tags)
            ? raw.tags.map(tag => String(tag).slice(0, 30)).filter(Boolean).slice(0, 12)
            : [],
        seed: Number.isInteger(raw.seed) ? raw.seed : undefined,
        lodRatios,
        ...(source ? {
            source,
            height: Number.isFinite(Number(raw.height)) && Number(raw.height) > 0
                ? clamp(raw.height, 0.01, MAX_DIMENSION, 1)
                : undefined,
            scale: Number.isFinite(Number(raw.scale)) ? clamp(raw.scale, 0.001, 1000, 1) : 1,
            rotation: parseRotation(raw.rotation),
            bevel: raw.bevel === true
        } : {}),
        parts
    };
}

function specPath(id) {
    return `${SPECS_DIR}/${id}.json`;
}

function modelDir(id) {
    return `${MODELS_DIR}/${id}`;
}

async function saveSpec(workspace, spec, { confirm = true } = {}) {
    const normalized = normalizeSpec(spec);
    const result = await writeProjectFiles(workspace, [{
        rel: specPath(normalized.id),
        content: json(normalized)
    }], {
        overwrite: true,
        label: `Enregistrer la spécification de l'asset « ${normalized.name} »`,
        confirm
    });
    return { spec: normalized, write: result, path: specPath(normalized.id) };
}

async function readSpec(workspace, id) {
    const rel = specPath(slugify(id));
    let raw;
    try {
        raw = await fs.readFile(path.join(workspace, rel), "utf8");
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error(
                `Spécification absente : ${rel}. ` +
                "Utilise roblox_asset action:spec (asset {name, parts}) ou action:import (path) avant action:build.",
                { cause: error }
            );
        }
        throw error;
    }
    return normalizeSpec(JSON.parse(raw.replace(/^\uFEFF/, "")));
}

async function listSpecs(workspace) {
    const dir = path.join(workspace, SPECS_DIR);
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const specs = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
        try {
            const spec = normalizeSpec(JSON.parse((await fs.readFile(path.join(dir, entry.name), "utf8")).replace(/^\uFEFF/, "")));
            specs.push({
                id: spec.id,
                name: spec.name,
                kind: spec.kind,
                parts: spec.parts.length,
                path: `${SPECS_DIR}/${entry.name}`
            });
        } catch {
            specs.push({ id: entry.name.replace(/\.json$/i, ""), name: entry.name, kind: "invalid", parts: 0, path: `${SPECS_DIR}/${entry.name}` });
        }
    }
    return specs.sort((left, right) => left.id.localeCompare(right.id, "fr"));
}

async function updateLibraryAsset(workspace, entry) {
    const library = await readLibrary(workspace);
    const assets = library.assets.filter(asset => asset.id !== entry.id);
    assets.push(entry);
    assets.sort((left, right) => String(left.id).localeCompare(String(right.id), "fr"));
    await writeGenerated(workspace, "assets/library.json", json({ version: 1, assets }));
    return entry;
}

async function findAsset(workspace, id) {
    const library = await readLibrary(workspace);
    return library.assets.find(asset => asset.id === slugify(id)) || null;
}

async function readAudioLibrary(workspace) {
    let raw;
    try {
        raw = JSON.parse(await fs.readFile(path.join(workspace, AUDIO_LIBRARY), "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") return { version: 1, sounds: [] };
        throw new Error(`${AUDIO_LIBRARY} : JSON invalide (${error.message}).`, { cause: error });
    }
    return {
        version: 1,
        ...raw,
        sounds: Array.isArray(raw.sounds) ? raw.sounds : []
    };
}

async function updateAudioEntry(workspace, entry) {
    const library = await readAudioLibrary(workspace);
    const sounds = library.sounds.filter(sound => sound.id !== entry.id);
    sounds.push(entry);
    sounds.sort((left, right) => String(left.id).localeCompare(String(right.id), "fr"));
    await writeGenerated(workspace, AUDIO_LIBRARY, json({ version: 1, sounds }));
    await writeGenerated(workspace, `${AUDIO_DIR}/README.md`, audioReadme(sounds));
    return entry;
}

/** Tableau lisible des sons : fichier, ID Roblox réel, usage et licence. */
function audioReadme(sounds) {
    const cell = value => String(value ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "/").trim();
    const rows = sounds.map(sound => {
        const assetId = sound.upload?.assetId ? `rbxassetid://${sound.upload.assetId}` : "à envoyer";
        const license = [sound.credit?.license, sound.credit?.author].filter(Boolean).join(" · ");
        return `| ${cell(sound.file)} | ${assetId} | ${cell(sound.usage || sound.name)} | ${cell(license)} |`;
    });

    return [
        "# Sons du projet",
        "",
        "Généré par France-Students-code-Roblox. Les IDs réels sont écrits par",
        "`roblox_asset action:upload` ; ne pas les recopier à la main.",
        "",
        "| Fichier | Asset ID | Usage | Licence / auteur |",
        "| --- | --- | --- | --- |",
        ...(rows.length ? rows : ["| _aucun son_ | | | |"]),
        "",
        "Un son ne joue en jeu qu'après son upload Roblox et le câblage d'un `Sound`",
        "avec `rbxassetid://…` (ou `AssetIds.luau`).",
        ""
    ].join("\n");
}

async function findAudio(workspace, id) {
    const library = await readAudioLibrary(workspace);
    return library.sounds.find(sound => sound.id === slugify(id)) || null;
}

/**
 * Copie un son dans assets/audio pour que le projet reste reproductible.
 * Le fichier d'origine n'est jamais modifié.
 */
async function stageAudio(workspace, sourcePath, id) {
    const raw = String(sourcePath || "").trim();
    if (!raw) throw new Error("Indique le chemin du fichier audio à importer (path).");

    const absolute = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(workspace, raw);
    const extension = path.extname(absolute).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(extension)) {
        throw new Error(
            `Format audio non pris en charge : ${extension || "(sans extension)"}. ` +
            `Formats acceptés : ${[...AUDIO_EXTENSIONS].join(", ")}.`
        );
    }

    let info;
    try {
        info = await fs.stat(absolute);
    } catch {
        throw new Error(`Fichier audio introuvable : ${absolute}`);
    }
    if (!info.isFile()) throw new Error(`Le chemin n'est pas un fichier : ${absolute}`);
    if (info.size > MAX_AUDIO_BYTES) {
        throw new Error(`Son trop volumineux : ${(info.size / 1024 / 1024).toFixed(1)} Mo (maximum 20 Mo).`);
    }

    const rel = `${AUDIO_DIR}/${id}${extension}`;
    const { target } = await resolveInWorkspace(workspace, rel);
    let copied = false;
    if (path.resolve(target) !== path.resolve(absolute)) {
        await ensureParent(target, workspace);
        await fs.copyFile(absolute, target);
        copied = true;
    }

    return { rel, absolute, target, extension, bytes: info.size, copied };
}

function checkSpecInput(spec) {
    if (!spec || typeof spec !== "object") throw new Error("asset doit être un objet JSON.");
    if (typeof spec.name !== "string" || !spec.name.trim()) throw new Error("asset.name est obligatoire.");
    if (spec.parts !== undefined && !Array.isArray(spec.parts)) throw new Error("asset.parts doit être un tableau.");
}

async function specsExist(workspace) {
    return exists(workspace, SPECS_DIR);
}

/**
 * Un .gltf peut référencer des buffers et des textures externes. On copie ces
 * dépendances en conservant leur chemin relatif, sinon Blender importerait un
 * modèle incomplet.
 */
async function gltfDependencies(absolute) {
    let document;
    try {
        document = JSON.parse(await fs.readFile(absolute, "utf8"));
    } catch (error) {
        throw new Error(`Fichier glTF illisible : ${absolute} (${error.message})`, { cause: error });
    }

    const uris = [];
    for (const list of [document?.buffers, document?.images]) {
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
            const uri = typeof entry?.uri === "string" ? entry.uri.trim() : "";
            if (!uri || /^data:/i.test(uri) || /^https?:/i.test(uri)) continue;
            uris.push(uri.replace(/\\/g, "/"));
        }
    }
    return uris;
}

async function stageGltf(workspace, absolute, id, bytes) {
    const folder = `${SOURCES_DIR}/${id}`;
    const rel = `${folder}/model.gltf`;
    const { target } = await resolveInWorkspace(workspace, rel);
    await ensureParent(target, workspace);
    let copied = false;
    if (path.resolve(target) !== path.resolve(absolute)) {
        await fs.copyFile(absolute, target);
        copied = true;
    }

    const base = path.dirname(absolute);
    for (const uri of await gltfDependencies(absolute)) {
        let decoded;
        try {
            decoded = decodeURIComponent(uri);
        } catch {
            decoded = uri;
        }
        const normalized = path.posix.normalize(decoded);
        if (normalized.startsWith("../") || normalized.startsWith("/") || /^[a-z]:/i.test(normalized)) {
            throw new Error(`Dépendance glTF hors du dossier source : ${uri}`);
        }
        const from = path.join(base, normalized);
        try {
            const dependency = await fs.stat(from);
            if (!dependency.isFile()) throw new Error("not a file");
        } catch {
            throw new Error(`Dépendance glTF introuvable : ${uri} (à côté de ${path.basename(absolute)})`);
        }
        const toRel = `${folder}/${normalized}`;
        const { target: to } = await resolveInWorkspace(workspace, toRel);
        await ensureParent(to, workspace);
        if (path.resolve(to) !== path.resolve(from)) {
            await fs.copyFile(from, to);
        }
    }

    return { rel, absolute, target, extension: ".gltf", bytes, copied };
}

/**
 * Copie un modèle source dans assets/sources pour que le projet reste
 * reproductible. Le fichier d'origine n'est jamais modifié.
 */
async function stageSource(workspace, sourcePath, id) {
    const raw = String(sourcePath || "").trim();
    if (!raw) throw new Error("Indique le chemin du modèle à importer (path).");

    const absolute = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(workspace, raw);
    const extension = path.extname(absolute).toLowerCase();
    if (!IMPORT_EXTENSIONS.has(extension)) {
        throw new Error(
            `Format non pris en charge : ${extension || "(sans extension)"}. ` +
            `Formats acceptés : ${[...IMPORT_EXTENSIONS].join(", ")}.`
        );
    }

    let info;
    try {
        info = await fs.stat(absolute);
    } catch {
        throw new Error(`Modèle introuvable : ${absolute}`);
    }
    if (!info.isFile()) throw new Error(`Le chemin n'est pas un fichier : ${absolute}`);
    if (info.size > MAX_SOURCE_BYTES) {
        throw new Error(`Modèle trop volumineux : ${(info.size / 1024 / 1024).toFixed(1)} Mo (maximum 200 Mo).`);
    }

    if (extension === ".gltf") {
        return stageGltf(workspace, absolute, id, info.size);
    }

    const rel = `${SOURCES_DIR}/${id}${extension}`;
    const { target } = await resolveInWorkspace(workspace, rel);
    let copied = false;
    if (path.resolve(target) !== path.resolve(absolute)) {
        await ensureParent(target, workspace);
        await fs.copyFile(absolute, target);
        copied = true;
    }

    return { rel, absolute, target, extension, bytes: info.size, copied };
}

module.exports = {
    SPECS_DIR,
    MODELS_DIR,
    SOURCES_DIR,
    AUDIO_DIR,
    AUDIO_LIBRARY,
    KINDS,
    SHAPES,
    MATERIALS,
    DEFAULT_PALETTE,
    IMPORT_EXTENSIONS,
    AUDIO_EXTENSIONS,
    MAX_SOURCE_BYTES,
    MAX_AUDIO_BYTES,
    normalizeSpec,
    parseColor,
    specPath,
    modelDir,
    saveSpec,
    readSpec,
    listSpecs,
    updateLibraryAsset,
    findAsset,
    readAudioLibrary,
    updateAudioEntry,
    findAudio,
    audioReadme,
    stageAudio,
    checkSpecInput,
    specsExist,
    stageSource
};
