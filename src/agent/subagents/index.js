"use strict";

/**
 * Registre des sous-agents spécialisés.
 *
 * Un rôle décrit OÙ le travail va (zone d'écriture), AVEC QUOI (outils précis) et SELON QUELLE
 * MÉTHODE (instructions + skills). L'orchestrateur lit le catalogue et délègue ; le moteur
 * (src/agent/subagent.js) exécute n'importe quel rôle sans connaître son métier.
 *
 * Pour ajouter un sous-agent : créer src/agent/subagents/<nom>.js (voir README.md du dossier)
 * et l'ajouter à BUILTIN. Rien à modifier ailleurs.
 */

/**
 * Normalisation du nom, sans dépendre de subagent-roles (qui importe ce registre) :
 * évite un cycle de require où roleOf serait encore incomplet.
 */
function roleOf(value) {
    if (value === undefined || value === null || value === "") return "general";
    const name = String(value).trim().toLowerCase();
    if (!REGISTRY.has(name)) throw new Error(`Rôle de sous-agent inconnu : ${name}. Rôles disponibles : ${[...REGISTRY.keys()].join(", ")}.`);
    return name;
}

/** Outils toujours permis : lire le projet, jamais le modifier. */
const READ_TOOLS = Object.freeze(["list_directory", "read_file", "search_files", "find_files"]);

/** Outils qu'un rôle peut demander en plus de la lecture (le reste est refusé). */
const WRITE_TOOLS = Object.freeze([
    "write_file", "edit_file", "create_directory", "move_path", "copy_path",
    "roblox_check", "roblox_game", "roblox_scene", "roblox_env", "rojo_serve", "roblox_playtest",
    "run_command", "job_output", "job_stop", "blender", "view_image", "semantic_search", "diagnostics"
]);

/**
 * Rôles génériques historiques (lecture seule, observation et exploration).
 * `general` est le rôle par défaut quand l'orchestrateur ne précise rien.
 */
const GENERIC = [
    {
        name: "general",
        label: "Exploration générale",
        summary: "Explorer le projet ou répondre à une question factuelle sans modifier de fichier.",
        instructions: "Comprends la structure du projet et rapporte les faits utiles avec leurs chemins.",
        tools: [],
        write: false,
        skills: [],
        maxTurns: 0,
        // Rôle de repli : catalogue vide pour ne pas gonfler le prompt de chaque sous-agent.
        quiet: true
    },
    {
        name: "roblox-luau",
        label: "Scripts Luau et architecture Roblox",
        summary: "Comprendre ou concevoir du Luau : modules, remotes, architecture client/serveur, sans toucher à l'interface ni aux modèles.",
        instructions: "Luau moderne (--!strict quand c'est possible), API actuelles et typées, remotes validés côté serveur, nettoyage des connexions, pas de boucle sans task.wait. Respecte Rojo (*.project.json, src/), Aftman/Wally et StyLua. Pour chaque constat, cite le service Roblox concerné (ServerScriptService, ReplicatedStorage, StarterPlayer…).",
        tools: [],
        write: false,
        skills: ["roblox-luau"],
        maxTurns: 0
    }
];

const BUILTIN = [
    require("./roblox-interface"),
    require("./roblox-3d")
];

function normalizeEntry(entry) {
    const name = String(entry.name || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`Nom de sous-agent invalide : ${entry.name}`);
    const write = entry.write === true;
    const requested = Array.isArray(entry.tools) ? entry.tools : [];
    const extra = requested.filter(tool => !READ_TOOLS.includes(tool));
    const forbidden = extra.filter(tool => !write || !WRITE_TOOLS.includes(tool));
    if (forbidden.length) {
        throw new Error(`Sous-agent ${name} : outil(s) non autorisé(s) sans écriture déclarée : ${forbidden.join(", ")}.`);
    }
    return Object.freeze({
        name,
        label: String(entry.label || name),
        summary: String(entry.summary || "").trim(),
        instructions: String(entry.instructions || "").trim(),
        skills: [...new Set((entry.skills || []).map(skill => String(skill).trim()).filter(Boolean))],
        writes: (entry.writes || []).map(String),
        write,
        quiet: entry.quiet === true,
        maxTurns: Number.isFinite(entry.maxTurns) && entry.maxTurns > 0 ? entry.maxTurns : 0,
        tools: write ? [...new Set([...READ_TOOLS, ...requested])] : [...READ_TOOLS]
    });
}

const REGISTRY = new Map();
for (const entry of [...GENERIC, ...BUILTIN]) {
    const role = normalizeEntry(entry);
    if (REGISTRY.has(role.name)) throw new Error(`Sous-agent dupliqué : ${role.name}`);
    REGISTRY.set(role.name, role);
}

/** Tous les rôles, ordre stable (génériques puis spécialisés). */
function roles() {
    return [...REGISTRY.values()];
}

function names() {
    return roles().map(role => role.name);
}

/** Outils réellement visibles par un rôle (lecture seule ou écriture déclarée). */
function toolsOf(name) {
    return REGISTRY.get(roleOf(name)).tools;
}

/** Vrai si le rôle peut modifier le projet. */
function canWrite(name) {
    return REGISTRY.get(roleOf(name)).write === true;
}

/** Limite de tours propre au rôle (0 = aucune). */
function maxTurnsOf(name) {
    return REGISTRY.get(roleOf(name)).maxTurns;
}

/** Skills déclarés par un rôle, tels quels (installés par le moteur avant la mission). */
function skillsOf(name) {
    return REGISTRY.get(roleOf(name)).skills;
}

/**
 * Catalogue compact pour le prompt de l'orchestrateur : qui existe, pour quoi, avec quels
 * outils. Vide si aucun rôle spécialisé (renvoie "" pour ne pas alourdir le prompt).
 */
function catalogText() {
    return roles()
        .filter(role => !role.quiet)
        .map(role => {
            const scope = role.write ? `écriture (${role.writes.join(", ") || "projet"})` : "lecture seule";
            return `- "${role.name}" — ${role.label} · ${scope} : ${role.summary}`;
        })
        .join("\n");
}

module.exports = {
    READ_TOOLS,
    WRITE_TOOLS,
    roles,
    names,
    toolsOf,
    canWrite,
    maxTurnsOf,
    skillsOf,
    catalogText
};
