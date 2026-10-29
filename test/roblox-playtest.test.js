"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const playtest = require("../src/tools/roblox-playtest");

test("roblox_playtest valide ses arguments", () => {
    assert.throws(() => playtest.check({ action: "delete" }), /action doit valoir/);
    assert.throws(() => playtest.check({ build: "oui" }), /build/);
    assert.throws(() => playtest.check({ open: 1 }), /open/);
    assert.doesNotThrow(() => playtest.check({}));
    assert.doesNotThrow(() => playtest.check({ action: "logs", since_ms: 60000 }));
});

test("readStudioErrors ne prétend pas avoir lu un log absent", () => {
    const result = playtest.readStudioErrors(0);
    assert.equal(typeof result.available, "boolean");
    assert.ok(Array.isArray(result.errors));
    assert.ok(Array.isArray(result.warnings));
    if (!result.available) assert.match(result.message, /introuvable/);
});

test("runPlaytest bloque proprement sans projet Rojo", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-playtest-"));
    const state = require("../src/state").state;
    const previous = state.workspace;
    state.workspace = dir;
    try {
        const result = await playtest.runPlaytest({ build: false });
        assert.equal(result.status, "blocked");
        assert.ok(typeof result.message === "string" && result.message.length > 0);
    } finally {
        state.workspace = previous;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("runPlaytest exige un projet sélectionné", async () => {
    const state = require("../src/state").state;
    const previous = state.workspace;
    state.workspace = null;
    try {
        await assert.rejects(() => playtest.runPlaytest({}), /Aucun projet/);
    } finally {
        state.workspace = previous;
    }
});
