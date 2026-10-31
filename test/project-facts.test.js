"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { collectFacts, refresh } = require("../src/project/project-facts");

function makeProject(extra = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-facts-"));
    const files = {
        "default.project.json": "{}",
        "src/server/main.server.luau": "",
        "src/client/main.client.luau": "",
        "src/shared/util.luau": "",
        "selene.toml": "",
        "package.json": JSON.stringify({ scripts: { test: "node --test test/*.test.js" } }),
        "package-lock.json": "{}",
        ...extra
    };
    for (const [rel, content] of Object.entries(files)) {
        const abs = path.join(dir, ...rel.split("/"));
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }
    return dir;
}

test("collectFacts retient la structure, le build Rojo et la commande de test", async () => {
    const dir = makeProject({ "build/models/Coffre.glb": "" });
    try {
        const facts = await collectFacts(dir);
        const byKey = Object.fromEntries(facts.map(fact => [fact.key, fact.value]));
        assert.equal(byKey["projet-rojo"], "default.project.json");
        assert.match(byKey.structure, /src\/server/);
        assert.match(byKey.structure, /src\/shared/);
        assert.equal(byKey["outils-luau"], "selene");
        assert.match(byKey.test, /^npm test → node --test/);
        assert.equal(byKey["gestionnaire-paquets"], "npm");
        assert.equal(byKey["dossiers-generes"], "build/models");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("collectFacts ne lit que les noms : un projet vide ne produit aucun fait", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-facts-empty-"));
    try {
        assert.deepEqual(await collectFacts(dir), []);
        assert.deepEqual(await collectFacts(""), []);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("refresh enregistre les faits dans la mémoire et sauvegarde", async () => {
    const dir = makeProject();
    const stored = new Map();
    let saved = 0;
    const memory = {
        addFact(key, value) { stored.set(key, value); },
        async save() { saved++; }
    };
    try {
        const facts = await refresh(memory, dir);
        assert.equal(facts.length, stored.size);
        assert.equal(stored.get("projet-rojo"), "default.project.json");
        assert.equal(saved, 1);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
