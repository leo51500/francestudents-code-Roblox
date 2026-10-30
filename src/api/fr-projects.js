"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const { CONFIG } = require("../config");
const { state } = require("../state");
const { auth, getAccessToken } = require("./auth");

/*
 * Projets FranceStudent (https://ia.francestudent.org/projects), via l'API :
 * GET /projects -> ProjectDto[] ; POST /projects { name } -> ProjectDto.
 * Le projet choisi avec /fr-project est mémorisé dans dataDir/fr-project.json
 * et rattaché (projectId) à chaque nouvelle conversation.
 */

const FILE = path.join(CONFIG.dataDir, "fr-project.json");
const MAX_NAME_CHARS = 255;

async function requestJson(method, route, body, retried = false) {
    const token = await getAccessToken(retried);
    const response = await fetch(`${CONFIG.apiUrl.replace(/\/$/, "")}${route}`, {
        method,
        headers: {
            Accept: "application/json",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            Authorization: `Bearer ${token}`,
            "User-Agent": CONFIG.userAgent,
            "francestudent-client-platform": CONFIG.clientPlatform,
            "francestudent-client-version": CONFIG.clientVersion,
            "francestudent-device-id": auth.deviceId,
            Origin: CONFIG.origin,
            Referer: `${CONFIG.origin}/`
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000)
    });

    if (response.status === 401 && !retried) return requestJson(method, route, body, true);
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        const detail = text.replace(/[\r\n\t]+/g, " ").slice(0, 300);
        const error = new Error(`HTTP ${response.status} sur ${method} ${route}${detail ? ` : ${detail}` : ""}`);
        error.status = response.status;
        throw error;
    }

    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Réponse non JSON de l’API FranceStudent sur ${method} ${route}.`);
    }
}

async function listProjects() {
    const asList = data => Array.isArray(data) ? data : Array.isArray(data?.projects) ? data.projects : [];
    const owned = await requestJson("GET", "/projects");
    const projects = asList(owned);
    let sharedUnavailable = false;
    try {
        const shared = await requestJson("GET", "/projects/shared");
        projects.push(...asList(shared));
    } catch (error) {
        // Route partagée absente ou désactivée (400, 403, 404, 405) : elle ne doit ni
        // priver l'utilisateur de ses projets personnels ni faire croire à une session
        // expirée alors que « GET /projects » vient de répondre. Un 401, une panne
        // serveur ou le réseau remontent tels quels.
        if (![400, 403, 404, 405].includes(error.status)) throw error;
        sharedUnavailable = true;
    }
    const unique = new Map(projects.filter(project => project?.id != null).map(project => [String(project.id), project]));
    return { projects: [...unique.values()], sharedUnavailable };
}

const createProject = name => requestJson("POST", "/projects", { name });

const normalizeName = name => String(name || "").trim().toLocaleLowerCase("fr-FR");

/** Cherche un projet par nom (sans tenir compte de la casse) ; le crée s'il n'existe pas. */
async function findOrCreateProject(name) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("Nom de projet vide.");
    if (clean.length > MAX_NAME_CHARS) {
        throw new Error(`Nom de projet trop long (${MAX_NAME_CHARS} caractères au maximum).`);
    }

    const wanted = normalizeName(clean);
    const existing = (await listProjects()).find(project => normalizeName(project?.name) === wanted);
    if (existing) return { project: existing, created: false };

    const project = await createProject(clean);
    if (!project || !project.id) throw new Error("L'API n'a pas renvoyé l'identifiant du projet créé.");
    return { project, created: true };
}

/** Recharge le projet FranceStudent mémorisé dans state.frProject. */
async function loadSelected() {
    try {
        const raw = JSON.parse(await fs.readFile(FILE, "utf8"));
        if (raw && typeof raw.id === "string" && raw.id) {
            state.frProject = { id: raw.id, name: String(raw.name || "") };
        }
    } catch {
        // aucun projet mémorisé ou fichier illisible
    }
    return state.frProject || null;
}

/** Mémorise (ou oublie avec null) le projet FranceStudent utilisé pour les nouvelles conversations. */
async function saveSelected(project) {
    state.frProject = project ? { id: project.id, name: String(project.name || "") } : null;

    if (!state.frProject) {
        await fs.rm(FILE, { force: true });
        return null;
    }

    await fs.mkdir(CONFIG.dataDir, { recursive: true, mode: 0o700 });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state.frProject, null, 2), { mode: 0o600 });
    await fs.rename(tmp, FILE);
    return state.frProject;
}

/** Rattache (ou déplace) un chat au projet : PUT /projects/{projectId}/chats/{chatId}. */
const attachChat = (projectId, chatId) =>
    requestJson("PUT", `/projects/${encodeURIComponent(projectId)}/chats/${encodeURIComponent(chatId)}`);

const attached = new Set();

/** Rattache le chat au projet sélectionné, une seule fois par couple projet/chat. Ne lève jamais. */
async function ensureAttached(chatId) {
    const projectId = state.frProject?.id;
    if (!projectId || !chatId) return false;

    const key = `${projectId}:${chatId}`;
    if (attached.has(key)) return true;

    try {
        await attachChat(projectId, chatId);
        attached.add(key);
        return true;
    } catch {
        return false;
    }
}

/*
 * Chats créés automatiquement (reprise après 409, rattachement tardif) : le site ne doit
 * pas accumuler des fils « Tour 28/40 » invisibles. On les rattache et on les nomme
 * d'après la demande réelle, une seule fois par identifiant.
 */
const named = new Set();

/** PATCH /chats/{id} { title } : renomme un fil. Ne lève jamais. */
async function renameChat(chatId, title) {
    const clean = String(title || "").replace(/\s+/g, " ").trim().slice(0, 100);
    if (!chatId || !clean) return false;
    const key = `${chatId}:${clean}`;
    if (named.has(key)) return true;
    try {
        await requestJson("PATCH", `/chats/${encodeURIComponent(chatId)}`, { title: clean });
        named.add(key);
        return true;
    } catch {
        // Un titre refusé par le service ne bloque jamais la conversation.
        return false;
    }
}

/**
 * Titre lisible d'après la demande : court, sans consigne d'outil ni numéro de tour.
 * Retourne "" quand la demande ne donne rien d'exploitable.
 */
function chatTitleFrom(text) {
    const raw = String(text || "");
    // Les tours de suivi ne décrivent pas le sujet : on ne leur invente pas de titre.
    if (!raw.trim() || /^\s*(tour\s+\d+\s*\/|CORRECTION|RAPPEL|RÉSULTATS DES OUTILS|CONTEXTE TEXTUEL PRÉCÉDENT)/i.test(raw)) return "";
    // Une demande peut arriver dans un message complet (consignes + demande) : on garde
    // la demande dès qu'elle est nommée, plus besoin d'être au tout début du message.
    const asked = /DEMANDE(?: DE L['’]UTILISATEUR| À POURSUIVRE)?\s*:?\s*([\s\S]+)/i.exec(raw);
    const source = asked ? asked[1] : raw;
    const first = source.split(/\n\s*\n/)[0].replace(/[`*_#>]/g, " ").replace(/\s+/g, " ").trim();
    const title = first.split(/(?<=[.!?])\s/)[0].trim();
    return title.length > 80 ? `${title.slice(0, 77).trimEnd()}…` : title;
}

/**
 * Appelé dès qu'un identifiant de chat est connu (premier ou nouveau fil) : rattache au
 * projet choisi et donne un vrai titre. Sans projet choisi, choisit le projet de
 * l'espace de travail si un seul porte ce nom, sans jamais en créer.
 */
async function adoptChat(chatId, prompt) {
    if (!chatId) return { attached: false, named: false };
    const title = chatTitleFrom(prompt);
    // Un seul renommage par fil dans la vie du processus : les tours suivants ne
    // redemandent pas le réseau pour un titre déjà posé.
    const shouldName = Boolean(title) && ![...named].some(key => key.startsWith(`${chatId}:`));
    const namedOk = shouldName ? await renameChat(chatId, title) : false;
    const attachedOk = await ensureAttached(chatId);
    return { attached: attachedOk, named: namedOk };
}

module.exports = {
    listProjects,
    createProject,
    attachChat,
    ensureAttached,
    renameChat,
    chatTitleFrom,
    adoptChat,
    findOrCreateProject,
    loadSelected,
    saveSelected,
    FILE,
    MAX_NAME_CHARS
};
