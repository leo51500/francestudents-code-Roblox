"use strict";

/**
 * Outil roblox_game — pilote un projet Roblox complet :
 * création, systèmes, suivi, validation et build Rojo.
 */

const { state } = require("../../state");
const {
    readBlueprint,
    exists
} = require("../../roblox/project");
const { blueprintPlan, setPhase, PHASES } = require("../../roblox/blueprint");
const { createGame, addSystems, listSystems } = require("../../roblox/systems");
const { scaffoldProject, buildFiles, writeBlueprint } = require("../../roblox/scaffold");
const { projectStatus } = require("../../roblox/status");
const { validateProject } = require("../../roblox/validate");
const { buildProject } = require("../../roblox/build");
const { requireString } = require("../core/args");

const ACTIONS = new Set([
    "init",
    "add_system",
    "scaffold",
    "status",
    "validate",
    "build",
    "phase",
    "systems",
    "plan"
]);

function workspace() {
    if (!state.workspace) {
        throw new Error("Aucun projet ouvert. Choisis le dossier du jeu avant de continuer.");
    }
    return state.workspace;
}

function asList(value) {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(/[,;]+/).map(item => item.trim()).filter(Boolean);
    throw new Error("systems doit être un tableau ou une chaîne séparée par des virgules.");
}

async function run(args = {}) {
    const action = String(args.action || "").trim().toLowerCase();
    const root = workspace();

    if (action === "init") {
        if (await exists(root, "game.blueprint.json")) {
            throw new Error(
                "Un projet Roblox existe déjà dans ce dossier. " +
                "Utilise action:status, action:add_system, action:validate ou action:build."
            );
        }
        const result = await createGame(root, {
            name: args.name,
            genre: args.genre,
            pitch: args.pitch,
            style: args.style,
            systems: asList(args.systems)
        }, { confirm: args.confirm !== false });
        return result;
    }

    if (action === "systems") {
        return {
            actions: [...ACTIONS],
            systems: listSystems(),
            message: `${listSystems().length} système(s) disponible(s).`
        };
    }

    if (action === "plan" && !(await exists(root, "game.blueprint.json"))) {
        // Le plan peut être consulté avant la création du projet.
        const phases = PHASES.map(phase => ({ ...phase, status: "pending", note: "" }));
        return {
            name: null,
            phases,
            plan: blueprintPlan({ phases }),
            next: phases[0],
            message: "Plan initial : aucun projet dans ce dossier. Utilise action:init pour le créer."
        };
    }

    const blueprint = await readBlueprint(root);

    if (action === "add_system") {
        const ids = asList(args.systems ?? args.system ?? args.id);
        if (!ids.length) throw new Error("Indique les systèmes à ajouter dans systems.");
        return addSystems(root, blueprint, ids, { confirm: args.confirm !== false });
    }

    if (action === "scaffold") {
        const files = await buildFiles(blueprint);
        const result = await scaffoldProject(root, blueprint, {
            overwrite: args.overwrite === true,
            confirm: args.confirm !== false
        });
        return {
            blueprint,
            expected: files.length,
            scaffold: result,
            message: result.message
        };
    }

    if (action === "status") {
        return projectStatus(root);
    }

    if (action === "validate") {
        return validateProject(root);
    }

    if (action === "build") {
        return buildProject(root, {
            skipChecks: args.skip_checks === true
        });
    }

    if (action === "phase") {
        requireString(args.id, "id");
        requireString(args.status, "status");
        if (!PHASES.some(phase => phase.id === args.id)) {
            throw new Error(`Phase inconnue : ${args.id}. Phases : ${PHASES.map(phase => phase.id).join(", ")}.`);
        }
        const phase = setPhase(blueprint, args.id, args.status, args.note || "");
        await writeBlueprint(root, blueprint);
        return {
            phase,
            plan: blueprintPlan(blueprint),
            message: `${phase.label} → ${phase.status}.`
        };
    }

    if (action === "plan") {
        return {
            name: blueprint.name,
            phases: blueprint.phases,
            plan: blueprintPlan(blueprint),
            next: blueprint.phases.find(phase => phase.status !== "completed") || null,
            message: "Plan du projet."
        };
    }

    throw new Error(`Action inconnue : ${action}. Actions : ${[...ACTIONS].join(", ")}.`);
}

function check(args = {}) {
    const action = String(args.action || "").trim().toLowerCase();
    if (!ACTIONS.has(action)) {
        throw new Error(`action doit être : ${[...ACTIONS].join(", ")}.`);
    }
    if (action === "init") requireString(args.name, "name");
    if (action === "phase") {
        requireString(args.id, "id");
        requireString(args.status, "status");
    }
    if (args.systems !== undefined && !Array.isArray(args.systems) && typeof args.systems !== "string") {
        throw new Error("systems doit être un tableau ou une chaîne.");
    }
}

function describe(args = {}) {
    const action = args.action || "?";
    if (action === "init") return `initialiser « ${args.name || "?"} »`;
    if (action === "add_system") return `systèmes ${asList(args.systems).join(", ") || "?"}`;
    return action;
}

module.exports = { name: "roblox_game", run, check, describe, ACTIONS };
