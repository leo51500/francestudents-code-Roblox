"use strict";

/**
 * Schéma du projet Roblox produit par l'agent.
 *
 * Un blueprint est la source de vérité persistante de la production :
 * identité du jeu, systèmes attendus, écrans, audio et phases. Les assets
 * vivent dans assets/library.json, les fichiers Luau dans src/.
 */

const BLUEPRINT_FILE = "game.blueprint.json";
const LIBRARY_FILE = "assets/library.json";
const PROJECT_FILE = "default.project.json";
const BLUEPRINT_VERSION = 2;

const PHASES = [
    { id: "analyse", label: "Analyser la demande et le budget" },
    { id: "plan", label: "Planifier l'architecture et les systèmes" },
    { id: "structure", label: "Créer la structure Rojo" },
    { id: "assets", label: "Modéliser les assets dans Blender" },
    { id: "lod", label: "Générer et vérifier les LOD" },
    { id: "systems", label: "Développer les systèmes Luau" },
    { id: "ui", label: "Construire les interfaces natives" },
    { id: "integration", label: "Intégrer assets, données et interfaces" },
    { id: "validation", label: "Valider la syntaxe et la structure" },
    { id: "build", label: "Construire la place .rbxlx" },
    { id: "delivery", label: "Livrer et documenter le résultat" }
];

const PHASE_IDS = new Set(PHASES.map(phase => phase.id));
const SYSTEM_STATUSES = new Set(["planned", "code", "verified"]);

/**
 * Systèmes connus. `files` liste les fichiers créés par add_system ; les noms
 * sont résolus dans les dossiers du projet par scaffold.js.
 */
const SYSTEMS = {
    data: {
        label: "Données joueur",
        description: "Profil persistant, monnaie, autosave et réplication.",
        core: true,
        order: 0,
        files: [{ target: "server", name: "PlayerData.luau" }]
    },
    currency: {
        label: "Économie",
        description: "Solde, gains et dépenses validés côté serveur.",
        core: true,
        order: 5,
        deps: ["data"]
    },
    inventory: {
        label: "Inventaire",
        description: "Objets empilables, ajout/retrait serveur et panneau client.",
        order: 20,
        deps: ["data"],
        files: [
            { target: "server", name: "InventoryService.luau" },
            { target: "client", name: "InventoryController.luau" },
            { target: "shared", name: "Items.luau" }
        ],
        ui: ["inventory"]
    },
    combat: {
        label: "Combat",
        description: "Attaques validées (portée, cadence, cible) et dégâts.",
        order: 30,
        deps: ["data"],
        files: [
            { target: "server", name: "CombatService.luau" },
            { target: "client", name: "CombatController.luau" }
        ]
    },
    npc: {
        label: "PNJ",
        description: "Apparition de PNJ, patrouille et poursuite par PathfindingService.",
        order: 40,
        deps: ["data", "combat"],
        files: [
            { target: "server", name: "NpcService.luau" },
            { target: "shared", name: "NpcDefs.luau" }
        ]
    },
    quests: {
        label: "Missions",
        description: "Objectifs data-driven, progression et récompenses.",
        order: 50,
        deps: ["data", "inventory"],
        files: [
            { target: "server", name: "QuestService.luau" },
            { target: "client", name: "QuestController.luau" },
            { target: "shared", name: "QuestDefs.luau" }
        ],
        ui: ["quests"]
    },
    shop: {
        label: "Boutique",
        description: "Offres achetables, prix et livraison d'objets côté serveur.",
        order: 60,
        deps: ["data", "inventory"],
        files: [
            { target: "server", name: "ShopService.luau" },
            { target: "client", name: "ShopController.luau" },
            { target: "shared", name: "ShopDefs.luau" }
        ],
        ui: ["shop"]
    },
    building: {
        label: "Construction",
        description: "Placement sur grille, validation de distance et prefabs Blender.",
        order: 70,
        deps: ["data"],
        files: [
            { target: "server", name: "BuildService.luau" },
            { target: "client", name: "BuildController.luau" },
            { target: "shared", name: "BuildDefs.luau" }
        ],
        ui: ["building"]
    }
};

const SYSTEM_ALIASES = {
    save: "data",
    saves: "data",
    economy: "currency",
    money: "currency",
    items: "inventory",
    combat_system: "combat",
    npcs: "npc",
    quest: "quests",
    mission: "quests",
    missions: "quests",
    builder: "building",
    construction: "building",
    store: "shop"
};

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "roblox-game";
}

function asSystemId(value) {
    if (typeof value === "string") return SYSTEM_ALIASES[value.trim().toLowerCase()] || value.trim().toLowerCase();
    if (value && typeof value === "object" && typeof value.id === "string") return asSystemId(value.id);
    return "";
}

/** Ordre stable et dépendances comprises. */
function resolveSystems(input = []) {
    const requested = new Set(["data", "currency"]);

    for (const item of Array.isArray(input) ? input : []) {
        const id = asSystemId(item);
        if (!id) throw new Error("Système invalide : utilise un nom comme inventory, combat, npc, quests, shop ou building.");
        const defined = id === "data" || id === "currency" || SYSTEMS[id];
        if (!defined) {
            throw new Error(`Système inconnu : ${id}. Disponibles : ${Object.keys(SYSTEMS).join(", ")}.`);
        }
        requested.add(id);
    }

    // Fermeture des dépendances.
    const queue = [...requested];
    while (queue.length) {
        const id = queue.shift();
        for (const dep of SYSTEMS[id]?.deps || []) {
            if (!requested.has(dep)) {
                requested.add(dep);
                queue.push(dep);
            }
        }
    }

    return Object.keys(SYSTEMS)
        .filter(id => requested.has(id))
        .sort((a, b) => (SYSTEMS[a].order ?? 100) - (SYSTEMS[b].order ?? 100));
}

function normalizeUiScreens(systems) {
    const screens = new Set(["HUD", "menu", "settings"]);
    for (const id of systems) {
        for (const screen of SYSTEMS[id]?.ui || []) {
            screens.add(screen);
        }
    }
    return [...screens].map(id => ({
        id,
        label: {
            HUD: "HUD",
            menu: "Menu principal",
            settings: "Paramètres",
            inventory: "Inventaire",
            shop: "Boutique",
            quests: "Missions",
            building: "Construction"
        }[id] || id,
        status: "planned"
    }));
}

function normalizeSystemEntry(entry, id) {
    const definition = SYSTEMS[id];
    const status = SYSTEM_STATUSES.has(entry?.status) ? entry.status : "planned";
    return {
        id,
        label: String(entry?.label || definition?.label || id),
        description: String(entry?.description || definition?.description || ""),
        status,
        files: Array.isArray(entry?.files) ? entry.files.filter(file => typeof file === "string") : []
    };
}

function normalizePhase(entry) {
    const known = PHASES.find(phase => phase.id === entry?.id);
    const status = ["pending", "in_progress", "completed", "blocked"].includes(entry?.status)
        ? entry.status
        : "pending";
    return {
        id: known ? known.id : String(entry?.id || ""),
        label: known ? known.label : String(entry?.label || entry?.id || ""),
        status,
        note: typeof entry?.note === "string" ? entry.note.slice(0, 500) : ""
    };
}

/** Normalise un blueprint lu sur disque (tolère les versions antérieures). */
function normalizeBlueprint(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("game.blueprint.json doit contenir un objet JSON.");
    }

    const name = String(raw.name || "").trim();
    if (!name) throw new Error("game.blueprint.json : name est obligatoire.");

    const systems = Array.isArray(raw.systems)
        ? raw.systems
            .map(item => {
                const id = asSystemId(item);
                return id ? normalizeSystemEntry(item, id) : null;
            })
            .filter(Boolean)
        : [];

    const byId = new Map(systems.map(system => [system.id, system]));
    for (const id of resolveSystems(systems.map(system => system.id))) {
        if (!byId.has(id)) byId.set(id, normalizeSystemEntry({}, id));
    }

    const ordered = resolveSystems([...byId.keys()]).map(id => byId.get(id));

    return {
        version: BLUEPRINT_VERSION,
        name,
        slug: String(raw.slug || slugify(name)),
        genre: String(raw.genre || "adventure").slice(0, 60),
        pitch: String(raw.pitch || "").slice(0, 2000),
        style: String(raw.style || "cartoon Roblox").slice(0, 200),
        createdAt: String(raw.createdAt || new Date().toISOString()),
        updatedAt: String(raw.updatedAt || new Date().toISOString()),
        systems: ordered,
        uiScreens: Array.isArray(raw.uiScreens) && raw.uiScreens.length
            ? raw.uiScreens.map(screen => ({
                id: String(screen?.id || ""),
                label: String(screen?.label || screen?.id || ""),
                status: ["planned", "code", "verified"].includes(screen?.status) ? screen.status : "planned"
            })).filter(screen => screen.id)
            : normalizeUiScreens(ordered.map(system => system.id)),
        phases: Array.isArray(raw.phases) && raw.phases.length
            ? raw.phases.map(normalizePhase).filter(phase => phase.id)
            : PHASES.map(phase => ({ ...phase, status: "pending", note: "" })),
        notes: Array.isArray(raw.notes) ? raw.notes.filter(note => typeof note === "string").slice(0, 50) : []
    };
}

/** Blueprint initial à partir d'une demande utilisateur. */
function createBlueprint({ name, genre = "adventure", pitch = "", style = "cartoon Roblox", systems = [] } = {}) {
    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("Le nom du jeu est obligatoire (2 à 60 caractères).");
    if (cleanName.length < 2 || cleanName.length > 60) throw new Error("Le nom du jeu doit faire entre 2 et 60 caractères.");

    const ids = resolveSystems(systems);
    const blueprint = normalizeBlueprint({
        name: cleanName,
        slug: slugify(cleanName),
        genre,
        pitch,
        style,
        systems: ids.map(id => normalizeSystemEntry({}, id)),
        uiScreens: normalizeUiScreens(ids),
        phases: PHASES.map(phase => ({ ...phase, status: "pending" })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    return blueprint;
}

/** Étapes de plan affichées à l'utilisateur et au suivi de tâche. */
function blueprintPlan(blueprint) {
    return blueprint.phases.map(phase => ({
        step: phase.label,
        status: phase.status === "completed"
            ? "completed"
            : phase.status === "in_progress" ? "in_progress" : "pending"
    }));
}

function systemState(id, blueprint) {
    return blueprint.systems.find(system => system.id === id) || null;
}

function markSystem(blueprint, id, { status, files } = {}) {
    const system = systemState(id, blueprint);
    if (!system) throw new Error(`Système absent du blueprint : ${id}`);
    if (status && SYSTEM_STATUSES.has(status)) system.status = status;
    if (Array.isArray(files)) {
        system.files = [...new Set([...system.files, ...files])];
    }
    blueprint.updatedAt = new Date().toISOString();
    return system;
}

function setPhase(blueprint, id, status, note = "") {
    if (!PHASE_IDS.has(id)) throw new Error(`Phase inconnue : ${id}. Phases : ${PHASES.map(p => p.id).join(", ")}.`);
    if (!["pending", "in_progress", "completed", "blocked"].includes(status)) {
        throw new Error("Statut de phase invalide : pending, in_progress, completed ou blocked.");
    }
    const phase = blueprint.phases.find(item => item.id === id);
    if (!phase) throw new Error(`Phase absente du blueprint : ${id}`);
    phase.status = status;
    phase.note = String(note || "").slice(0, 500);
    blueprint.updatedAt = new Date().toISOString();
    return phase;
}

module.exports = {
    BLUEPRINT_FILE,
    BLUEPRINT_VERSION,
    LIBRARY_FILE,
    PROJECT_FILE,
    PHASES,
    PHASE_IDS,
    SYSTEMS,
    SYSTEM_STATUSES,
    slugify,
    resolveSystems,
    normalizeBlueprint,
    createBlueprint,
    blueprintPlan,
    systemState,
    markSystem,
    setPhase,
    normalizeUiScreens
};
