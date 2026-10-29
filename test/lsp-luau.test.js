"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { languageIdFor, serverFamilyFor } = require("../desktop/lsp");

test("lsp : les fichiers Luau sont reconnus et routés vers luau-lsp", () => {
    assert.equal(languageIdFor("src/server/main.server.luau"), "luau");
    assert.equal(languageIdFor("src/shared/util.lua"), "luau");
    assert.equal(serverFamilyFor("src/server/main.server.luau"), "luau");
    assert.equal(serverFamilyFor("src/app.ts"), "typescript");
    assert.equal(languageIdFor("README.md"), null);
    assert.equal(serverFamilyFor("README.md"), null);
});

test("lsp : luau-lsp est trouvé dans .aftman/bin du projet", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-lsp-"));
    try {
        const bin = path.join(dir, ".aftman", "bin");
        fs.mkdirSync(bin, { recursive: true });
        const name = process.platform === "win32" ? "luau-lsp.exe" : "luau-lsp";
        fs.writeFileSync(path.join(bin, name), "");
        fs.writeFileSync(path.join(dir, "globalTypes.d.luau"), "-- types Roblox");
        // Recharge pour tester le même chemin que l'application.
        delete require.cache[require.resolve("../desktop/lsp")];
        const { findLuauLsp } = require("../desktop/lsp");
        const found = findLuauLsp(dir);
        assert.ok(found, "luau-lsp devrait être détecté dans .aftman/bin");
        assert.equal(found.path, path.join(bin, name));
        assert.equal(found.definitions, path.join(dir, "globalTypes.d.luau"));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("lsp : luau-lsp.json du projet prioritaire", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-lspcfg-"));
    try {
        const custom = path.join(dir, "outils", "luau-lsp");
        fs.mkdirSync(path.dirname(custom), { recursive: true });
        fs.writeFileSync(custom, "");
        fs.writeFileSync(path.join(dir, "luau-lsp.json"), JSON.stringify({ executable: custom }));
        delete require.cache[require.resolve("../desktop/lsp")];
        const { findLuauLsp } = require("../desktop/lsp");
        assert.equal(findLuauLsp(dir).path, custom);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
