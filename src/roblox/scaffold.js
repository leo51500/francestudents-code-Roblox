"use strict";

/**
 * Génération de la structure Rojo d'un jeu à partir des templates Luau.
 *
 * Tous les fichiers produits restent dans le dossier du projet. Les templates
 * ne contiennent aucune donnée personnelle : le nom, le slug et le genre sont
 * remplacés à la génération.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const { SYSTEMS } = require("./blueprint");
const { exists, writeProjectFiles, writeGenerated, json } = require("./project");

const TEMPLATES = path.join(__dirname, "templates");

const CORE_FILES = [
    { template: "core/default.project.json", rel: "default.project.json" },
    { template: "core/README.md", rel: "README.md" },
    { template: "core/GameConfig.luau", rel: "src/shared/GameConfig.luau" },
    { template: "core/Remotes.luau", rel: "src/shared/Remotes.luau" },
    { template: "core/AssetIds.luau", rel: "src/shared/AssetIds.luau" },
    { template: "core/ClientState.luau", rel: "src/client/ClientState.luau" },
    { template: "core/Theme.luau", rel: "src/client/ui/Theme.luau" },
    { template: "core/Hud.luau", rel: "src/client/ui/Hud.luau" },
    { template: "core/HudController.luau", rel: "src/client/controllers/HudController.luau" },
    { template: "core/ClientMain.client.luau", rel: "src/client/ClientMain.client.luau" },
    { template: "core/ServiceRegistry.luau", rel: "src/server/lib/ServiceRegistry.luau" },
    { template: "core/GameEvents.luau", rel: "src/server/lib/GameEvents.luau" },
    { template: "core/PlayerData.luau", rel: "src/server/services/PlayerData.luau" },
    { template: "core/ServerMain.server.luau", rel: "src/server/ServerMain.server.luau" }
];

const TARGET_DIRS = {
    shared: "src/shared",
    server: "src/server/services",
    client: "src/client/controllers"
};

const GITIGNORE = [
    "build/",
    "*.blend1",
    ""
].join("\n");

function render(text, values) {
    return String(text).replace(/\{\{([A-Z_]+)\}\}/g, (match, key) =>
        Object.hasOwn(values, key) ? String(values[key]) : match
    );
}

async function readTemplate(relative) {
    return fs.readFile(path.join(TEMPLATES, relative), "utf8");
}

function variables(blueprint) {
    return {
        GAME_NAME: blueprint.name,
        SLUG: blueprint.slug,
        GENRE: blueprint.genre,
        PITCH: blueprint.pitch || "",
        STYLE: blueprint.style || "cartoon Roblox"
    };
}

/** Fichiers d'un système (sans doublon) d'après sa déclaration dans SYSTEMS. */
function systemTemplates(id) {
    const definition = SYSTEMS[id];
    if (!definition || !Array.isArray(definition.files)) return [];
    return definition.files
        .filter(file => Object.hasOwn(TARGET_DIRS, file.target))
        .map(file => ({
            template: `systems/${id}/${file.name}`,
            rel: `${TARGET_DIRS[file.target]}/${file.name}`
        }));
}

async function buildFiles(blueprint, { core = true, systems = null } = {}) {
    const vars = variables(blueprint);
    const requested = systems
        ? new Set(systems)
        : new Set(blueprint.systems.map(system => system.id));

    const entries = [];
    if (core) entries.push(...CORE_FILES);
    for (const id of requested) entries.push(...systemTemplates(id));

    const files = [];
    const seen = new Set();
    for (const entry of entries) {
        if (seen.has(entry.rel)) continue;
        seen.add(entry.rel);
        const content = render(await readTemplate(entry.template), vars);
        files.push({ rel: entry.rel, content });
    }

    return files;
}

async function writeBlueprint(workspace, blueprint) {
    await writeGenerated(workspace, "game.blueprint.json", json(blueprint));
}

/**
 * Crée la structure complète (ou les fichiers manquants) du projet.
 * Ne remplace jamais un fichier existant sans `overwrite`.
 */
async function scaffoldProject(workspace, blueprint, options = {}) {
    const files = await buildFiles(blueprint);
    const result = await writeProjectFiles(workspace, files, {
        overwrite: options.overwrite === true,
        label: `Créer la structure du jeu « ${blueprint.name} »`,
        confirm: options.confirm !== false
    });

    if (result.denied) {
        // Refus utilisateur : ne pas enregistrer un blueprint qui décrit des
        // fichiers inexistants.
        return { ...result, expected: files.length, written: [], skipped: result.skipped || [] };
    }

    if (options.includeMeta !== false) {
        if (!(await exists(workspace, "assets/library.json"))) {
            await writeGenerated(workspace, "assets/library.json", json({ version: 1, assets: [] }));
        }
        if (!(await exists(workspace, ".gitignore"))) {
            await writeGenerated(workspace, ".gitignore", GITIGNORE);
        }
        await writeBlueprint(workspace, blueprint);
    }

    return {
        ...result,
        expected: files.length,
        written: result.files || [],
        skipped: result.skipped || []
    };
}

module.exports = {
    TEMPLATES,
    CORE_FILES,
    TARGET_DIRS,
    render,
    readTemplate,
    variables,
    systemTemplates,
    buildFiles,
    writeBlueprint,
    scaffoldProject
};
