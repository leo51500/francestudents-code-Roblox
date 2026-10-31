"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { state } = require("../src/state");
const { findFiles, scoreFile } = require("../src/tools/fs/find-files");

function workspaceWith(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-find-"));
    for (const [rel, content] of Object.entries(files)) {
        const abs = path.join(dir, ...rel.split("/"));
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content || "");
    }
    return dir;
}

const BASE = {
    "src/client/Hud.client.luau": "-- hud",
    "src/server/Save.server.luau": "-- save",
    "src/shared/Config.luau": "return {}",
    "assets/icone.png": "",
    "docs/guide.md": "# guide"
};

test("find_files retrouve un fichier par son nom, sans tenir compte des accents", async () => {
    const dir = workspaceWith(BASE);
    const previous = state.workspace;
    state.workspace = dir;
    try {
        const result = await findFiles({ query: "hud" });
        assert.equal(result.matches[0].path, "src/client/Hud.client.luau");
        assert.equal(result.matches[0].score, 85);
    } finally {
        state.workspace = previous;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("find_files accepte une sous-séquence et un filtre d'extension", async () => {
    const dir = workspaceWith(BASE);
    const previous = state.workspace;
    state.workspace = dir;
    try {
        const fuzzy = await findFiles({ query: "hudclt" });
        assert.ok(fuzzy.matches.some(item => item.path === "src/client/Hud.client.luau"));

        const filtered = await findFiles({ query: "config", ext: ".luau" });
        assert.deepEqual(filtered.matches.map(item => item.path), ["src/shared/Config.luau"]);

        const images = await findFiles({ query: "icone", ext: "png" });
        assert.deepEqual(images.matches.map(item => item.path), ["assets/icone.png"]);
    } finally {
        state.workspace = previous;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("find_files tronque et signale les résultats au-delà de max_results", async () => {
    const dir = workspaceWith({
        "src/a/hud.luau": "",
        "src/b/hud.luau": "",
        "src/c/hud.luau": ""
    });
    const previous = state.workspace;
    state.workspace = dir;
    try {
        const result = await findFiles({ query: "hud", max_results: 2 });
        assert.equal(result.matches.length, 2);
        assert.equal(result.truncated, true);
    } finally {
        state.workspace = previous;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("find_files refuse un chemin hors du projet", async () => {
    const dir = workspaceWith(BASE);
    const previous = state.workspace;
    state.workspace = dir;
    try {
        await assert.rejects(findFiles({ query: "hud", path: "../" }));
    } finally {
        state.workspace = previous;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("scoreFile classe le nom exact avant le contenu d'un chemin", () => {
    assert.equal(scoreFile("src/shared/Config.luau", "config"), 100);
    assert.ok(scoreFile("src/shared/Config.luau", "conf") > scoreFile("src/config/notes.md", "conf"));
    assert.equal(scoreFile("src/shared/Config.luau", "zzz"), 0);
});
