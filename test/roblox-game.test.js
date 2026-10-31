"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { state } = require("../src/state");
const game = require("../src/tools/roblox-game");

function tempWorkspace() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-game-"));
    const previous = state.workspace;
    state.workspace = dir;
    return { dir, restore: () => { state.workspace = previous; fs.rmSync(dir, { recursive: true, force: true }); } };
}

test("roblox_game liste le modèle obby", async () => {
    const result = await game.listTemplates();
    assert.deepEqual(result.templates.map(item => item.name), ["obby"]);
});

test("scaffold crée un jeu Rojo complet avec les placeholders remplacés", async () => {
    const { dir, restore } = tempWorkspace();
    try {
        const result = await game.scaffold({ name: "Mon Obby" });
        assert.equal(result.template, "obby");
        assert.ok(result.created >= 4);
        for (const rel of [
            "default.project.json",
            "src/shared/Config.luau",
            "src/server/Main.server.luau",
            "src/client/Hud.client.luau"
        ]) {
            assert.ok(result.files.includes(rel), `${rel} manquant`);
            assert.ok(fs.existsSync(path.join(dir, rel)), `${rel} absent du disque`);
        }
        const config = fs.readFileSync(path.join(dir, "src/shared/Config.luau"), "utf8");
        assert.match(config, /Mon Obby/);
        assert.doesNotMatch(config, /__GAME_NAME__/);
        const project = fs.readFileSync(path.join(dir, "default.project.json"), "utf8");
        assert.match(project, /Mon-Obby/);
        assert.doesNotMatch(project, /__PROJECT_NAME__/);
    } finally {
        restore();
    }
});

test("scaffold refuse d'écraser un modèle existant sans force", async () => {
    const { restore } = tempWorkspace();
    try {
        await game.scaffold({ name: "Premier" });
        await assert.rejects(game.scaffold({ name: "Second" }), /contient déjà/);
        const forced = await game.scaffold({ name: "Second", force: true });
        assert.equal(forced.project, "Second");
    } finally {
        restore();
    }
});

test("scaffold accepte un sous-dossier de destination", async () => {
    const { dir, restore } = tempWorkspace();
    try {
        const result = await game.scaffold({ name: "Course", path: "games/course" });
        assert.ok(result.files.every(rel => rel.startsWith("games/course/")));
        assert.ok(fs.existsSync(path.join(dir, "games/course/src/server/Main.server.luau")));
    } finally {
        restore();
    }
});

test("projectNameFor et check nettoient les noms", () => {
    assert.equal(game.projectNameFor("Mon Obby!"), "Mon-Obby");
    assert.equal(game.projectNameFor(""), "Orbital-Obby");
    assert.throws(() => game.check({ name: "../evil" }), /caractère de chemin/);
    assert.throws(() => game.check({ action: "inconnu" }), /action doit valoir/);
});
