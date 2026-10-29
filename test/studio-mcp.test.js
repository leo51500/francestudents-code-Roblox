"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const studio = require("../src/mcp/studio-mcp");

const STUDIO_TOOLS = [{ name: "list_roblox_studios" }, { name: "execute_luau" }, { name: "search_game_tree" }];
const BLENDER_TOOLS = [{ name: "get_scene_info" }, { name: "execute_blender_code" }];
const OTHER_TOOLS = [{ name: "read_file" }];

test("Arc Studio MCP : jeton local lu depuis l'installation de l'extension", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-token-"));
    const file = path.join(dir, "auth.token");
    fs.writeFileSync(file, "  jeton-local-123 \n");
    const previous = process.env.FRST_STUDIO_MCP_TOKEN;
    process.env.FRST_STUDIO_MCP_TOKEN = file;
    try {
        assert.equal(studio.readAuthToken(), "jeton-local-123");
    } finally {
        if (previous === undefined) delete process.env.FRST_STUDIO_MCP_TOKEN;
        else process.env.FRST_STUDIO_MCP_TOKEN = previous;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("StudioMCP et Blender sont détectés par leur nom ou leurs outils, pas par hasard", () => {
    assert.equal(studio.isStudioServer("Roblox_Studio", []), true);
    assert.equal(studio.isStudioServer("autre", STUDIO_TOOLS), true);
    assert.equal(studio.isStudioServer("autre", OTHER_TOOLS), false);
    assert.equal(studio.isBlenderServer("blender", []), true);
    assert.equal(studio.isBlenderServer("autre", BLENDER_TOOLS), true);
    assert.equal(studio.isBlenderServer("Roblox_Studio", STUDIO_TOOLS), false);
});

test("les identifiants Studio sont fournis par l'application, jamais demandés au modèle", () => {
    const cache = { token: "jeton", studioId: "75c2c367-6cfd-47e8-8795-500a970707bb" };
    const prepared = studio.prepareArgs({ serverName: "Roblox_Studio", tools: STUDIO_TOOLS, cache, toolName: "execute_luau", args: { code: "print('x')" } });
    assert.equal(prepared.auth_token, "jeton");
    assert.equal(prepared.studio_id, "75c2c367-6cfd-47e8-8795-500a970707bb");
    assert.equal(prepared.datamodel_type, "Edit");
    assert.equal(prepared.code, "print('x')");

    // Un identifiant déjà fourni n'est jamais remplacé.
    const explicit = studio.prepareArgs({ serverName: "Roblox_Studio", tools: STUDIO_TOOLS, cache, toolName: "execute_luau", args: { code: "x", datamodel_type: "Play", studio_id: "autre" } });
    assert.equal(explicit.datamodel_type, "Play");
    assert.equal(explicit.studio_id, "autre");
});

test("un serveur quelconque et Blender ne reçoivent aucun champ Roblox", () => {
    const cache = { token: "jeton", studioId: "id" };
    assert.deepEqual(studio.prepareArgs({ serverName: "notes", tools: OTHER_TOOLS, cache, toolName: "read_file", args: { path: "a" } }), { path: "a" });
    assert.deepEqual(studio.prepareArgs({ serverName: "blender", tools: BLENDER_TOOLS, cache, toolName: "execute_blender_code", args: { code: "x" } }), { code: "x" });
});

test("la session Studio ouverte est mémorisée puis rappelée dans l'explication", () => {
    const cache = { token: "", studioId: null };
    assert.equal(studio.rememberStudio(cache, JSON.stringify([{ id: "s-1", name: "Ma place" }])), "s-1");
    assert.equal(cache.studioName, "Ma place");
    const notes = studio.callNotes({ serverName: "Roblox_Studio", tools: STUDIO_TOOLS, cache, toolName: "execute_luau" });
    assert.ok(notes.some(note => /Jeton StudioMCP introuvable/.test(note)));
    assert.equal(notes.some(note => /Aucune session Studio/.test(note)), false);

    const missing = studio.callNotes({ serverName: "Roblox_Studio", tools: STUDIO_TOOLS, cache: { token: "t", studioId: null }, toolName: "execute_luau" });
    assert.ok(missing.some(note => /Aucune session Studio/.test(note)));
});

test("le client MCP envoie les métadonnées de protocole attendues par l'extension", () => {
    const code = fs.readFileSync(path.join(__dirname, "../src/mcp/client.js"), "utf8");
    assert.match(code, /io\.modelcontextprotocol\/protocolVersion/);
    assert.match(code, /io\.modelcontextprotocol\/clientCapabilities/);
});
