"use strict";

/**
 * Agents (modèles) disponibles sur l'API FranceStudent.
 *
 *   GET {apiUrl}/chats/agents -> Agent[]
 *   Agent : { id: int32, name, namespace, description, model, modelProvider, isActive, isDefault }
 *
 * La liste est mise en cache 5 minutes. Si l'API ne répond pas, seuls les agents
 * précédemment récupérés depuis cette API peuvent être réutilisés.
 */

const account = require("./account");
const { modelContext, OBSERVED_IDS } = require("./model-context");

const TTL_MS = 5 * 60_000;
let cache = null; // { agents, at }

function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = Number(raw.id);
    if (!Number.isInteger(id)) return null;
    const { model: contextModel, ...context } = modelContext(raw);
    return {
        id,
        name: String(raw.name || raw.model || id),
        model: raw.model ? String(raw.model) : "",
        provider: raw.modelProvider ? String(raw.modelProvider) : "",
        description: raw.description ? String(raw.description) : "",
        isDefault: raw.isDefault === true,
        isActive: raw.isActive !== false,
        ...context,
        contextModel
    };
}

/** Appel direct de l'API (agents actifs seulement). */
async function fetchAgents() {
    const data = await account.getJson("/chats/agents");
    const list = Array.isArray(data) ? data : data && Array.isArray(data.agents) ? data.agents : [];
    return list.map(normalize).filter(agent => agent && agent.isActive);
}

/** { agents, source: "api" | "cache" | "unavailable", error? } ; ne lève jamais. */
async function listAgents({ refresh = false } = {}) {
    if (!refresh && cache && Date.now() - cache.at < TTL_MS) return { agents: cache.agents, source: "api" };
    try {
        const agents = await fetchAgents();
        if (!agents.length) throw new Error("liste d'agents vide");
        cache = { agents, at: Date.now() };
        return { agents, source: "api" };
    } catch (error) {
        return { agents: cache ? cache.agents : [], source: cache ? "cache" : "unavailable", error };
    }
}

const norm = s => String(s || "").toLowerCase().replace(/[\s_.-]+/g, " ").trim();

/**
 * Trouve un agent par identifiant, nom ou nom de modèle (insensible à la casse,
 * espaces / tirets / points ignorés, préfixe ou fragment unique accepté).
 * -> { agent, matches }
 */
function resolveAgent(query, agents) {
    const q = String(query || "").trim();
    if (!q) return { agent: null, matches: [] };

    if (/^-?\d+$/.test(q)) {
        const agent = agents.find(a => a.id === Number(q)) || null;
        return { agent, matches: agent ? [agent] : [] };
    }

    const nq = norm(q);
    const exact = agents.filter(a => norm(a.name) === nq || (a.model && norm(a.model) === nq));
    if (exact.length === 1) return { agent: exact[0], matches: exact };
    if (exact.length > 1) return { agent: null, matches: exact };

    const partial = agents.filter(a => norm(a.name).includes(nq) || (a.model && norm(a.model).includes(nq)));
    return { agent: partial.length === 1 ? partial[0] : null, matches: partial };
}

/** Nom lisible d'un agent déjà confirmé par l'API, sinon son identifiant. */
function agentName(id) {
    const all = cache ? cache.agents : [];
    const agent = all.find(a => a.id === Number(id));
    return agent ? agent.name : String(id);
}

function resetCache() {
    cache = null;
}

function agentContext(id) {
    const agent = cache?.agents.find(item => item.id === Number(id));
    return agent ? { model: agent.contextModel, contextWindowTokens: agent.contextWindowTokens,
        maxOutputTokens: agent.maxOutputTokens, source: agent.source } : modelContext({ model: OBSERVED_IDS[id] || "" });
}

module.exports = { fetchAgents, listAgents, resolveAgent, agentName, agentContext, normalize, resetCache };
