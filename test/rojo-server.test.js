"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rojo = require("../src/tools/rojo-server");
const rojoServe = require("../src/tools/rojo-serve");

function workspaceWithProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-rojo-"));
    fs.writeFileSync(path.join(dir, "default.project.json"), "{}\n");
    return dir;
}

test("freePort renvoie un port réellement libre et distinct d'un port occupé", async () => {
    const net = require("node:net");
    const blocker = net.createServer();
    const taken = await new Promise(resolve => blocker.listen(0, "127.0.0.1", () => resolve(blocker.address().port)));
    const free = await rojo.freePort(taken, 5);
    assert.ok(free === null || free !== taken, "un port occupé ne doit jamais être proposé");
    blocker.close();
});

test("statusOf est neutre sans serveur et stopServer ne plante pas", () => {
    const status = rojo.statusOf();
    assert.equal(status.running, false);
    assert.equal(status.connected, false);
    assert.equal(status.port, null);
    assert.equal(rojo.stopServer(), null);
});

test("startServer refuse un dossier sans projet Rojo", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-rojo-vide-"));
    await assert.rejects(() => rojo.startServer(dir), /project\.json/);
    fs.rmSync(dir, { recursive: true, force: true });
});

test("rojo_serve valide ses arguments avant d'agir", () => {
    assert.throws(() => rojoServe.checkArgs({ action: "delete" }), /action doit valoir/);
    assert.throws(() => rojoServe.checkArgs({ action: "start", port: 80 }), /port/);
    assert.throws(() => rojoServe.checkArgs({ action: "start", port: "abc" }), /port/);
    assert.doesNotThrow(() => rojoServe.checkArgs({ action: "start", port: 34872 }));
    assert.doesNotThrow(() => rojoServe.checkArgs({}));
});

test("connect renvoie l'adresse Studio même sans serveur actif", async () => {
    const dir = workspaceWithProject();
    const state = require("../src/state").state;
    const previous = state.workspace;
    state.workspace = dir;
    try {
        const result = await rojoServe.runRojoServe({ action: "connect" });
        assert.equal(result.host, "127.0.0.1");
        assert.equal(result.project, "default.project.json");
        assert.match(result.command, /rojo serve default\.project\.json/);
        assert.equal(result.running, false);
    } finally {
        state.workspace = previous;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("startServer signale l'absence de rojo au lieu de prétendre avoir démarré", async () => {
    const dir = workspaceWithProject();
    const sandbox = require("../src/tools/sandbox");
    const original = sandbox.findRobloxTool;
    sandbox.findRobloxTool = () => null;
    try {
        const result = await rojo.startServer(dir);
        assert.equal(result.running, false);
        assert.match(result.error, /rojo absent/);
        assert.equal(result.install, "aftman add rojo-rbx/rojo");
    } finally {
        sandbox.findRobloxTool = original;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
