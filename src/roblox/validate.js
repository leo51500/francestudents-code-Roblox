"use strict";

/**
 * Validation réelle du projet Roblox : structure Rojo, fichiers attendus,
 * syntaxe Luau (si luau-compile est installé), bibliothèque d'assets et
 * cohérence des prefabs déclarés dans les définitions Luau.
 */

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { SYSTEMS } = require("./blueprint");
const { readBlueprint, readLibrary, exists, listProjectFiles, readText } = require("./project");
const { readAudioLibrary } = require("./assets");
const { TARGET_DIRS } = require("./scaffold");
const { runProcess } = require("../tools/command/runner");

const MAX_FILES = 300;

const CORE_REQUIRED = [
    "default.project.json",
    "src/shared/GameConfig.luau",
    "src/shared/Remotes.luau",
    "src/server/ServerMain.server.luau",
    "src/server/lib/ServiceRegistry.luau",
    "src/server/lib/GameEvents.luau",
    "src/server/services/PlayerData.luau",
    "src/client/ClientMain.client.luau",
    "src/client/ClientState.luau",
    "src/client/ui/Theme.luau",
    "src/client/ui/Hud.luau",
    "src/client/controllers/HudController.luau"
];

async function isFile(file) {
    try {
        return (await fs.stat(file)).isFile();
    } catch {
        return false;
    }
}

/** Cherche luau-compile dans le PATH, le projet ou le dossier temporaire de l'outil. */
async function findLuauCompile(workspace) {
    const names = process.platform === "win32"
        ? ["luau-compile.exe", "luau-compile"]
        : ["luau-compile"];

    const directories = [
        workspace,
        path.join(workspace, "node_modules", ".bin"),
        path.join(process.env.TEMP || os.tmpdir(), "opencode", "luau"),
        path.join(process.env.LOCALAPPDATA || "", "luau")
    ].filter(Boolean);

    for (const directory of directories) {
        for (const name of names) {
            const candidate = path.join(directory, name);
            if (await isFile(candidate)) return candidate;
        }
    }

    for (const directory of String(process.env.PATH || "").split(path.delimiter)) {
        for (const name of names) {
            const candidate = path.join(directory.replace(/^"|"$/g, ""), name);
            if (await isFile(candidate)) return candidate;
        }
    }
    return "";
}

function cleanCompilerOutput(output) {
    return String(output || "")
        .split(/\r?\n/)
        .filter(line => line.trim() && !line.includes("Compile success"))
        .slice(0, 6)
        .join("\n")
        .slice(0, 1200);
}

async function compileFile(binary, file) {
    const result = await runProcess({
        file: binary,
        args: ["--null", file],
        cwd: path.dirname(file),
        timeoutMs: 15000,
        discardStdout: true
    });
    if (result.timed_out) {
        return { ok: false, message: "délai dépassé" };
    }
    if (result.exit_code === 0) return { ok: true };
    return {
        ok: false,
        message: cleanCompilerOutput(result.output) || `luau-compile a renvoyé le code ${result.exit_code}`
    };
}

function projectPaths(project) {
    const tree = project?.tree;
    if (!tree || typeof tree !== "object") return [];
    const paths = [];
    const walk = node => {
        if (!node || typeof node !== "object") return;
        if (typeof node.$path === "string") paths.push(node.$path);
        for (const value of Object.values(node)) walk(value);
    };
    walk(tree);
    return paths;
}

/** Identifiants de prefabs déclarés par les modules *Defs.luau d'un système. */
function declaredPrefabs(text) {
    const ids = new Set();
    const patterns = [
        /prefab\s*=\s*["']([^"']+)["']/g,
        /model\s*=\s*["']([^"']+)["']/g
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text))) ids.add(match[1]);
    }
    return [...ids];
}

async function validateProject(workspace) {
    const errors = [];
    const warnings = [];
    const checks = {};

    const blueprint = await readBlueprint(workspace);

    // 1. Structure Rojo.
    let project = null;
    try {
        project = JSON.parse((await readText(workspace, "default.project.json")).replace(/^\uFEFF/, ""));
        checks.rojo = true;
    } catch (error) {
        errors.push(`default.project.json : ${error.message}`);
        checks.rojo = false;
    }

    if (project) {
        const paths = projectPaths(project);
        checks.rojoPaths = paths;
        if (!paths.length) {
            errors.push("default.project.json ne mappe aucun dossier ($path).");
        }
        for (const rel of paths) {
            if (!(await exists(workspace, rel))) {
                errors.push(`Chemin Rojo absent : ${rel}`);
            }
        }
    }

    for (const rel of CORE_REQUIRED) {
        if (!(await exists(workspace, rel))) errors.push(`Fichier de base absent : ${rel}`);
    }

    // 2. Systèmes déclarés.
    const files = await listProjectFiles(workspace);
    const fileSet = new Set(files);
    const missing = [];
    for (const system of blueprint.systems) {
        const definition = SYSTEMS[system.id];
        for (const file of definition?.files || []) {
            const dir = TARGET_DIRS[file.target];
            if (!dir) continue;
            const rel = `${dir}/${file.name}`;
            if (!fileSet.has(rel)) missing.push(`${system.id} → ${rel}`);
        }
    }
    if (missing.length) errors.push(`Fichiers de système absents : ${missing.join(", ")}`);
    checks.systems = blueprint.systems.length;

    // 3. Syntaxe Luau.
    const luauFiles = files.filter(rel => rel.endsWith(".luau")).slice(0, MAX_FILES);
    const compiler = await findLuauCompile(workspace);
    checks.luauCompiler = compiler || null;
    checks.luauFiles = luauFiles.length;

    if (compiler) {
        let failed = 0;
        for (const rel of luauFiles) {
            const result = await compileFile(compiler, path.join(workspace, rel));
            if (!result.ok) {
                failed++;
                errors.push(`${rel} : ${result.message}`);
            }
        }
        if (!failed) checks.luau = `${luauFiles.length} fichier(s) compilé(s)`;
    } else {
        warnings.push(
            "luau-compile introuvable : la syntaxe Luau n'a pas été vérifiée. " +
            "Installe Luau ou place luau-compile.exe dans le PATH."
        );
        checks.luau = "non vérifié";
    }

    // 4. Assets et prefabs.
    let library = { assets: [] };
    try {
        library = await readLibrary(workspace);
        checks.assets = library.assets.length;
    } catch (error) {
        errors.push(`assets/library.json : ${error.message}`);
    }

    const built = [];
    for (const asset of library.assets) {
        if (!asset || typeof asset.id !== "string") {
            errors.push("assets/library.json : une entrée sans id.");
            continue;
        }
        if (asset.files?.lod0) {
            if (!(await exists(workspace, asset.files.lod0))) {
                errors.push(`Asset ${asset.id} : ${asset.files.lod0} est déclaré mais absent.`);
            } else {
                built.push(asset.id);
            }
        }
    }
    checks.builtAssets = built;

    // 4 bis. Sons préparés et envoyés.
    let audio = { sounds: [] };
    try {
        audio = await readAudioLibrary(workspace);
        checks.sounds = audio.sounds.length;
    } catch (error) {
        errors.push(`assets/audio/library.json : ${error.message}`);
    }
    const uploadedSounds = [];
    for (const sound of audio.sounds) {
        if (!sound || typeof sound.id !== "string") {
            errors.push("assets/audio/library.json : une entrée sans id.");
            continue;
        }
        if (!sound.file) {
            errors.push(`Son ${sound.id} : aucun fichier déclaré.`);
            continue;
        }
        if (!(await exists(workspace, sound.file))) {
            errors.push(`Son ${sound.id} : ${sound.file} déclaré mais absent.`);
            continue;
        }
        if (sound.upload?.assetId) uploadedSounds.push(sound.id);
    }
    checks.uploadedSounds = uploadedSounds;

    const prefabChecks = [];
    for (const system of blueprint.systems) {
        if (system.id !== "building" && system.id !== "npc") continue;
        const rels = {
            building: "src/shared/BuildDefs.luau",
            npc: "src/shared/NpcDefs.luau"
        };
        const rel = rels[system.id];
        if (!(await exists(workspace, rel))) continue;
        const text = await readText(workspace, rel);
        const prefabs = declaredPrefabs(text);
        prefabChecks.push({ system: system.id, prefabs });
        if (!prefabs.length) {
            warnings.push(`${rel} ne déclare aucun prefab/modele.`);
        } else if (!library.assets.length) {
            warnings.push(
                `${rel} attend ${prefabs.join(", ")} mais la bibliothèque d'assets est vide. ` +
                "Construis ces modèles avec roblox_asset puis insère-les dans Studio."
            );
        }
    }
    checks.prefabs = prefabChecks;

    const ok = errors.length === 0;
    return {
        ok,
        errors,
        warnings,
        checks,
        message: ok
            ? `Validation réussie : ${checks.systems} système(s), ${checks.luauFiles} fichier(s) Luau, ${built.length} asset(s) exporté(s), ${audio.sounds.length} son(s) préparé(s).` +
                (warnings.length ? ` ${warnings.length} avertissement(s).` : "")
            : `Validation échouée : ${errors.length} erreur(s), ${warnings.length} avertissement(s).`
    };
}

module.exports = { validateProject, findLuauCompile, declaredPrefabs, CORE_REQUIRED };
