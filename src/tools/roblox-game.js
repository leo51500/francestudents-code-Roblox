"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const { state } = require("../state");
const { resolveInWorkspace } = require("./security");
const { requireString, optionalString, optionalBool } = require("./core/args");
const { walkFiles } = require("./core/walk");

/*
 * Modèles de jeux Roblox complets.
 *
 * Un modèle n'est pas un extrait de code : il décrit une boucle de jeu jouable
 * (structure Rojo, autorité serveur, HUD, persistance) que l'agent adapte. Il
 * évite les projets « vides » où chaque script est inventé sans cohérence.
 */

const TEMPLATE_DIR = path.join(__dirname, "..", "game-templates");

const TEMPLATES = {
    obby: {
        label: "Parcours (obby)",
        description: "Parcours vertical généré, checkpoints, pièces, chrono, meilleur temps DataStore et HUD PC/mobile."
    }
};

const TEXT_FILE = /\.(luau|lua|json|md|toml|txt)$/i;
const PLACEHOLDER = /__([A-Z_]+)__/g;

function projectNameFor(name) {
    const clean = String(name || "Orbital Obby").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return (clean || "Orbital-Obby").slice(0, 40);
}

function replacePlaceholders(text, values) {
    return text.replace(PLACEHOLDER, (match, key) => (Object.hasOwn(values, key) ? values[key] : match));
}

async function templateFiles(template) {
    const root = path.join(TEMPLATE_DIR, template);
    return walkFiles(root, ".");
}

async function listTemplates() {
    return {
        templates: Object.entries(TEMPLATES).map(([name, item]) => ({ name, ...item })),
        message: `${Object.keys(TEMPLATES).length} modèle(s) de jeu disponible(s).`
    };
}

async function scaffold(args = {}) {
    const workspace = state.workspace;
    if (!workspace) throw new Error("Aucun projet sélectionné.");

    const template = (args.template || "obby").trim();
    if (!Object.hasOwn(TEMPLATES, template)) {
        throw new Error(`Modèle de jeu inconnu : ${template}. Modèles : ${Object.keys(TEMPLATES).join(", ")}.`);
    }

    const displayName = String(args.name || "Orbital Obby").trim();
    const projectName = projectNameFor(displayName);
    const storeName = `Obby_${projectName.replace(/-/g, "_")}_BestTimes_v1`.slice(0, 50);

    const targetRel = args.path ?? ".";
    await resolveInWorkspace(workspace, targetRel);
    const files = await templateFiles(template);

    const plan = [];

    for (const file of files) {
        const destinationRel = targetRel === "." ? file.rel : `${targetRel.replace(/\/+$/, "")}/${file.rel}`;
        const absolute = path.join(workspace, ...destinationRel.split("/"));
        plan.push({ file, destinationRel, absolute });
    }

    if (args.force !== true) {
        const existing = [];
        for (const item of plan) {
            const found = await fs.access(item.absolute).then(() => true, () => false);
            if (found) existing.push(item.destinationRel);
        }
        if (existing.length) {
            throw new Error(
                `Le dossier contient déjà ${existing.length} fichier(s) du modèle (ex. ${existing[0]}). ` +
                "Choisis un dossier vide avec \"path\" (ex. \"games/mon-jeu\"), ou force:true pour remplacer ces fichiers."
            );
        }
    }

    const values = {
        GAME_NAME: displayName.replace(/[{}"'`\r\n]/g, "").slice(0, 60),
        PROJECT_NAME: projectName,
        STORE_NAME: storeName
    };

    const created = [];

    for (const item of plan) {
        const raw = await fs.readFile(item.file.abs, "utf8");
        const content = TEXT_FILE.test(item.file.rel) ? replacePlaceholders(raw, values) : raw;

        await fs.mkdir(path.dirname(item.absolute), { recursive: true });
        await fs.writeFile(item.absolute, content, "utf8");
        created.push(item.destinationRel);
    }

    return {
        template,
        path: targetRel,
        project: projectName,
        files: created,
        created: created.length,
        next_steps: [
            "roblox_check sur ce sous-dossier (build compris).",
            "roblox_playtest {build:true}, puis action:logs pour relire les erreurs Studio.",
            "Adapter Config.luau avant de modifier la logique serveur."
        ],
        message: `${created.length} fichier(s) créés pour le jeu « ${displayName} » dans ${targetRel}.`
    };
}

async function robloxGame(args = {}) {
    const action = args.action || "scaffold";

    if (action === "templates") return listTemplates();
    if (action === "scaffold") return scaffold(args);

    throw new Error(`Action inconnue : ${action}. Actions : templates, scaffold.`);
}

function check(args = {}) {
    if (args.action !== undefined && !["templates", "scaffold"].includes(args.action)) {
        throw new Error("action doit valoir templates ou scaffold.");
    }
    optionalString(args.template, "template");
    optionalString(args.path, "path");
    optionalString(args.name, "name");
    optionalBool(args.force, "force");

    if (args.name !== undefined) {
        const name = requireString(args.name, "name");
        if (name.length > 60) throw new Error("name : 60 caractères au maximum.");
        if (/[\\/:*?"<>|\r\n]/.test(name)) throw new Error("name ne doit pas contenir de caractère de chemin.");
    }
}

function describe(a = {}) {
    if ((a.action || "scaffold") === "templates") return "modèles de jeux";
    return `${a.template || "obby"} → ${a.path || "."}`;
}

module.exports = {
    name: "roblox_game",
    run: robloxGame,
    check,
    describe,
    scaffold,
    listTemplates,
    TEMPLATES,
    projectNameFor
};
