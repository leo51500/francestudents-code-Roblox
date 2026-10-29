"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dashboard = require("../desktop/roblox-dashboard");

function makeProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-dashboard-"));
    fs.mkdirSync(path.join(dir, "src", "server"), { recursive: true });
    fs.writeFileSync(path.join(dir, "default.project.json"), JSON.stringify({ name: "Jeu", tree: { ServerScriptService: { $path: "src/server" } } }));
    fs.writeFileSync(path.join(dir, "src", "server", "Main.server.luau"), "print('ok')\n");
    return dir;
}

test("wally : lecture de wally.toml et indexation de Packages / ServerPackages", () => {
    const dir = makeProject();
    try {
        fs.writeFileSync(path.join(dir, "wally.toml"), [
            "[package]",
            'name = "joueur/jeu"',
            'version = "0.1.0"',
            "",
            "[dependencies]",
            'Promise = "evaera/promise@4.0.0"',
            'Trove = "sleitnick/trove@1.0.1"',
            "",
            "[server-dependencies]",
            'Lapis = "nezuo/lapis@0.0.4"'
        ].join("\n"));
        fs.writeFileSync(path.join(dir, "wally.lock"), "");
        fs.mkdirSync(path.join(dir, "Packages", "Promise@4.0.0"), { recursive: true });
        fs.writeFileSync(path.join(dir, "Packages", "Promise@4.0.0", "package.json"), JSON.stringify({ version: "4.0.0" }));
        fs.mkdirSync(path.join(dir, "ServerPackages", "Lapis@0.0.4"), { recursive: true });
        fs.writeFileSync(path.join(dir, "ServerPackages", "Lapis@0.0.4", "wally.toml"), 'version = "0.0.4"\n');

        const manifest = dashboard.readWallyManifest(dir);
        assert.equal(manifest.file, "wally.toml");
        assert.deepEqual(manifest.dependencies.map(d => d.name), ["Promise", "Trove", "Lapis"]);

        const status = dashboard.wallyStatus(dir);
        assert.equal(status.lock, true);
        assert.equal(status.packages.length, 2);
        assert.ok(status.packages.some(p => p.name === "Promise@4.0.0" && p.version === "4.0.0" && p.folder === "Packages"));
        assert.ok(status.packages.some(p => p.name === "Lapis@0.0.4" && p.version === "0.0.4" && p.folder === "ServerPackages"));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("wally : .luaurc reçoit les alias sans écraser un fichier existant", () => {
    const dir = makeProject();
    try {
        fs.mkdirSync(path.join(dir, "Packages"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".luaurc"), JSON.stringify({ languageMode: "strict", aliases: { client: "src/client" } }, null, 2));
        assert.equal(dashboard.ensureLuaurcAliases(dir), ".luaurc");
        const data = JSON.parse(fs.readFileSync(path.join(dir, ".luaurc"), "utf8"));
        assert.equal(data.languageMode, "strict");
        assert.deepEqual(data.aliases, { client: "src/client", shared: "Packages" });

        // Un fichier non JSON n'est jamais réécrit.
        const other = makeProject();
        try {
            fs.mkdirSync(path.join(other, "Packages"), { recursive: true });
            fs.writeFileSync(path.join(other, ".luaurc"), "{ \"languageMode\": \"strict\", } // commentaire\n");
            assert.equal(dashboard.ensureLuaurcAliases(other), null);
            assert.match(fs.readFileSync(path.join(other, ".luaurc"), "utf8"), /commentaire/);
        } finally {
            fs.rmSync(other, { recursive: true, force: true });
        }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("wally : aucune action arbitraire et wally.toml requis", async () => {
    const dir = makeProject();
    try {
        await assert.rejects(() => dashboard.wally("publish", dir), /Action Wally inconnue/);
        await assert.rejects(() => dashboard.wally("install", dir), /wally\.toml/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("build : état du dernier build et retard sur un script modifié", () => {
    const dir = makeProject();
    try {
        let info = dashboard.buildInfo(dir);
        assert.equal(info.exists, false);
        assert.equal(info.project, "default.project.json");

        fs.mkdirSync(path.join(dir, ".frst", "build"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".frst", "build", "game.rbxlx"), "<roblox/>");
        info = dashboard.buildInfo(dir);
        assert.equal(info.exists, true);
        assert.equal(info.project, "default.project.json");

        // Un script modifié après le build rend le build en retard.
        const later = Date.now() + 5000;
        fs.utimesSync(path.join(dir, "src", "server", "Main.server.luau"), later / 1000, later / 1000);
        assert.equal(dashboard.buildInfo(dir).stale, true);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("rojo : état hors serveur, actions inconnues refusées", async () => {
    const dir = makeProject();
    try {
        const state = dashboard.status(dir);
        assert.equal(state.running, false);
        assert.equal(state.tone, "offline");
        assert.equal(state.project, "default.project.json");
        await assert.rejects(() => dashboard.rojo("explode", dir), /Action Rojo inconnue/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
