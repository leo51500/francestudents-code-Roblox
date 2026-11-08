"use strict";

/**
 * Connexions MCP prêtes à l'emploi pour la chaîne Roblox + Blender.
 * Ces définitions ne démarrent rien : l'utilisateur les ajoute depuis
 * Extensions → Serveurs MCP, ou via l'action "add-preset".
 *
 * Les commandes sont des valeurs par défaut raisonnables pour Windows x64.
 * Si l'outil est installé ailleurs, l'utilisateur peut modifier mcp.json.
 */

const PRESETS = [
    {
        id: "blender",
        name: "blender",
        label: "Blender",
        description: "Pilote Blender : scène, code bpy, captures et export des modèles 3D.",
        command: "uvx",
        args: ["mcp-for-blender"],
        timeoutMs: 60_000
    },
    {
        id: "roblox-studio",
        name: "Roblox_Studio",
        label: "Roblox Studio",
        description: "Pilote Roblox Studio : insertion d'assets, Luau, inspection et captures.",
        command: "cmd.exe",
        args: ["/c", "%LOCALAPPDATA%\\Roblox\\mcp.bat"],
        timeoutMs: 60_000
    }
];

function clone(preset) {
    return { ...preset, args: [...preset.args] };
}

function listPresets() {
    return PRESETS.map(clone);
}

function getPreset(id) {
    const wanted = String(id || "").trim().toLowerCase();
    const preset = PRESETS.find(item => item.id === wanted || item.name.toLowerCase() === wanted);
    return preset ? clone(preset) : null;
}

module.exports = { PRESETS, listPresets, getPreset };
