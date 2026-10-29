"use strict";

/**
 * Adaptation de l'Extension Roblox Studio (StudioMCP) et du serveur Blender.
 *
 * StudioMCP identifie une session par `studio_id` et exige un `auth_token` local.
 * Ces valeurs sont découvertes une seule fois par serveur actif : l'agent n'a jamais
 * à deviner un identifiant, et le jeton reste dans le processus principal (jamais
 * envoyé au modèle). Un serveur qui n'est ni Roblox ni Blender n'est pas modifié.
 */

const fs = require("node:fs");
const path = require("node:path");

const STUDIO_TOOLS_NEEDING_SESSION = /execute_luau|run_script|search_game_tree|get_console_output|screen_capture|get_studio_state|start_stop_play/;

/** Emplacements du jeton posé par l'extension Roblox Studio. */
function authTokenCandidates() {
    const files = [];
    if (process.env.FRST_STUDIO_MCP_TOKEN) files.push(process.env.FRST_STUDIO_MCP_TOKEN);
    if (process.env.LOCALAPPDATA) files.push(path.join(process.env.LOCALAPPDATA, "Roblox", "StudioMCP", "auth.token"));
    return files;
}

/** Jeton d'authentification StudioMCP, relu depuis l'installation de l'extension. */
function readAuthToken() {
    for (const file of authTokenCandidates()) {
        try {
            const token = fs.readFileSync(file, "utf8").trim();
            if (token) return token;
        } catch {
            // extension absente : le serveur répondra explicitement, voir callNotes
        }
    }
    return "";
}

function isStudioServer(name, tools) {
    if (/roblox.*studio|studio.*mcp/i.test(String(name))) return true;
    const names = new Set((tools || []).map(tool => tool.name));
    return names.has("list_roblox_studios") || (names.has("execute_luau") && names.has("search_game_tree"));
}

function isBlenderServer(name, tools) {
    if (/blender/i.test(String(name))) return true;
    return (tools || []).some(tool => /^(get_scene_info|execute_blender_code)$/.test(tool.name));
}

/**
 * Arguments réellement envoyés au serveur. `cache` appartient à un serveur actif et
 * contient déjà `studioId` (découverte) et `token`.
 */
function prepareArgs({ serverName, tools, cache, toolName, args }) {
    const prepared = { ...(args || {}) };
    if (isStudioServer(serverName, tools)) {
        if (!prepared.auth_token && cache.token) prepared.auth_token = cache.token;
        if (STUDIO_TOOLS_NEEDING_SESSION.test(toolName)) {
            if (!prepared.studio_id && cache.studioId) prepared.studio_id = cache.studioId;
            // Le serveur exige `datamodel_type` sur TOUTES ses opérations, pas seulement
            // l'exécution : sans lui, search_game_tree répond « datamodel_type is required ».
            // Edit est le mode le moins destructeur ; Play reste un choix explicite.
            if (!prepared.datamodel_type) prepared.datamodel_type = "Edit";
        }
    }
    if (isBlenderServer(serverName, tools) && !prepared.port && cache.blenderPort) prepared.port = cache.blenderPort;
    return prepared;
}

/** Conseils ajoutés au résultat quand l'appel ne peut pas aboutir faute de session. */
function callNotes({ serverName, tools, cache, toolName }) {
    const notes = [];
    if (!isStudioServer(serverName, tools)) return notes;
    const toolNames = new Set((tools || []).map(tool => tool.name));
    const needsSession = STUDIO_TOOLS_NEEDING_SESSION.test(toolName);
    if (!cache.token) {
        notes.push("Jeton StudioMCP introuvable : reconnecte l'extension Roblox Studio (StudioMCP) dans Roblox Studio, puis réessaie.");
    }
    if (needsSession && !cache.studioId && toolNames.has("list_roblox_studios")) {
        notes.push("Aucune session Studio connue : ouvre la place dans Roblox Studio (plugin StudioMCP connecté), puis relance l'appel ; la session sera détectée automatiquement.");
    }
    return notes;
}

/** Mémorise la session renvoyée par `list_roblox_studios` (le premier studio ouvert). */
function rememberStudio(cache, resultText) {
    try {
        const parsed = JSON.parse(String(resultText || "[]"));
        const list = Array.isArray(parsed) ? parsed : parsed.studios || parsed.result || [];
        const first = list[0] || null;
        if (first) {
            cache.studioId = first.id || first.studio_id || first.studioId || null;
            cache.studioName = first.name || first.place_name || null;
        }
        cache.studioCount = list.length;
    } catch {
        // sortie non JSON : on ne devine pas d'identifiant
    }
    return cache.studioId || null;
}

module.exports = {
    authTokenCandidates,
    readAuthToken,
    isStudioServer,
    isBlenderServer,
    prepareArgs,
    callNotes,
    rememberStudio
};
