"use strict";

/**
 * Création et extension d'un projet Roblox : blueprint, structure Rojo et
 * systèmes Luau. Chaque ajout écrit uniquement les fichiers manquants.
 */

const {
    SYSTEMS,
    createBlueprint,
    normalizeBlueprint,
    resolveSystems,
    markSystem,
    setPhase
} = require("./blueprint");
const { buildFiles, scaffoldProject, writeBlueprint } = require("./scaffold");
const { writeProjectFiles } = require("./project");

const CORE_SYSTEMS = new Set(["data", "currency"]);

function systemSummary(id) {
    const definition = SYSTEMS[id];
    return {
        id,
        label: definition?.label || id,
        description: definition?.description || "",
        requires: definition?.deps || [],
        files: (definition?.files || []).map(file => `${file.target}/${file.name}`),
        ui: definition?.ui || []
    };
}

function listSystems() {
    return Object.keys(SYSTEMS).map(systemSummary);
}

/** Identifiants demandés + dépendances, dans l'ordre de démarrage. */
function expandedIds(ids) {
    return resolveSystems(ids);
}

/** Marque les systèmes fournis comme écrits et enregistre leurs fichiers. */
function markFiles(blueprint, ids) {
    for (const id of ids) {
        if (CORE_SYSTEMS.has(id)) continue;
        const definition = SYSTEMS[id];
        if (!definition) continue;
        const files = (definition.files || []).map(file => {
            const dir = file.target === "shared" ? "src/shared"
                : file.target === "server" ? "src/server/services"
                    : "src/client/controllers";
            return `${dir}/${file.name}`;
        });
        markSystem(blueprint, id, { status: "code", files });
    }
    return blueprint;
}

/** Crée le blueprint et toute la structure demandée. */
async function createGame(workspace, input = {}, options = {}) {
    const blueprint = createBlueprint(input);
    const files = await buildFiles(blueprint);
    const result = await scaffoldProject(workspace, blueprint, options);

    if (result.denied) {
        return {
            blueprint,
            scaffold: result,
            systems: [],
            files: [],
            message: "Création refusée : aucun fichier ni blueprint n'a été écrit."
        };
    }

    markFiles(blueprint, blueprint.systems.map(system => system.id));
    setPhase(blueprint, "structure", "completed", `${files.length} fichier(s) de structure.`);
    setPhase(blueprint, "systems", "in_progress", "Systèmes de base écrits ; il reste à les adapter au jeu.");
    await writeBlueprint(workspace, blueprint);

    return {
        blueprint,
        scaffold: result,
        systems: blueprint.systems.map(system => system.id),
        files: files.map(file => file.rel),
        message:
            `Projet « ${blueprint.name} » créé : ${result.created} fichier(s) créé(s), ` +
            `${result.skipped.length} déjà présent(s). Systèmes : ${blueprint.systems.map(s => s.id).join(", ")}.`
    };
}

/** Ajoute des systèmes à un projet existant. */
async function addSystems(workspace, blueprint, ids, options = {}) {
    const requested = expandedIds([...blueprint.systems.map(system => system.id), ...ids]);
    const known = new Set(blueprint.systems.map(system => system.id));
    const missing = requested.filter(id => !known.has(id));

    const existingById = new Map(blueprint.systems.map(system => [system.id, system]));
    const next = normalizeBlueprint({
        ...blueprint,
        systems: requested.map(id => existingById.get(id) || { id }),
        updatedAt: new Date().toISOString()
    });

    const files = await buildFiles(next, {
        core: false,
        systems: requested.filter(id => !CORE_SYSTEMS.has(id))
    });

    const result = await writeProjectFiles(workspace, files, {
        overwrite: options.overwrite === true,
        label: `Ajouter les systèmes : ${requested.join(", ")}`,
        confirm: options.confirm !== false
    });

    if (result.denied) {
        return {
            blueprint,
            added: [],
            alreadyPresent: requested.filter(id => known.has(id)),
            scaffold: result,
            files: [],
            message: "Ajout refusé : le blueprint et les fichiers existants n'ont pas changé."
        };
    }

    markFiles(next, missing);
    setPhase(next, "systems", "in_progress", `Systèmes présents : ${next.systems.map(s => s.id).join(", ")}.`);
    await writeBlueprint(workspace, next);

    return {
        blueprint: next,
        added: missing,
        alreadyPresent: requested.filter(id => known.has(id)),
        scaffold: result,
        files: files.map(file => file.rel),
        message: missing.length
            ? `Systèmes ajoutés : ${missing.join(", ")}. ${result.created} fichier(s) créé(s).`
            : `Ces systèmes étaient déjà présents : ${requested.join(", ")}.`
    };
}

module.exports = {
    CORE_SYSTEMS,
    listSystems,
    expandedIds,
    createGame,
    addSystems,
    markFiles
};
