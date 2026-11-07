"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { listPresets, getPreset, PRESETS } = require("../src/mcp/presets");
const { parseConfig } = require("../src/mcp/manager");

test("presets MCP Roblox + Blender : définitions et compatibilité mcp.json", () => {
    const presets = listPresets();
    assert.deepEqual(presets.map(p => p.id), ["blender", "roblox-studio"]);
    assert.deepEqual(presets.map(p => p.name), ["blender", "Roblox_Studio"]);
    assert.ok(presets.every(p => p.command && Array.isArray(p.args) && p.args.length > 0));
    assert.equal(getPreset("blender").command, "uvx");
    assert.equal(getPreset("Roblox_Studio").name, "Roblox_Studio");

    const config = parseConfig({
        mcpServers: Object.fromEntries(PRESETS.map(p => [
            p.name,
            { command: p.command, args: p.args, timeoutMs: p.timeoutMs }
        ]))
    });
    assert.equal(config.length, 2);
    assert.equal(config.find(s => s.name === "blender").timeoutMs, 60_000);
    assert.equal(config.find(s => s.name === "Roblox_Studio").command, "cmd.exe");
});

test("presets MCP : un preset inconnu ne produit pas de serveur", () => {
    assert.equal(getPreset("inconnu"), null);
    assert.equal(getPreset(""), null);
});
