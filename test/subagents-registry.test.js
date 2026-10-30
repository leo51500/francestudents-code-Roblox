"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const registry = require("../src/agent/subagents");
const { ROLES, NAMES, roleOf, rolePrompt } = require("../src/agent/subagent-roles");
const { buildPrompt, check, READ_TOOLS, needsWriteAccess } = require("../src/agent/subagent");
const { validateToolCall } = require("../src/tools/registry");
const { TOOL_CATALOG, buildAgentPrompt } = require("../src/agent/prompt");

test("le registre expose les rôles spécialisés demandés, en plus des rôles génériques", () => {
    assert.ok(NAMES.includes("general"));
    assert.ok(NAMES.includes("roblox-interface"));
    assert.ok(NAMES.includes("roblox-3d"));
    assert.deepEqual(NAMES, registry.names());
    assert.equal(new Set(NAMES).size, NAMES.length, "un rôle ne doit pas être déclaré deux fois");
});

test("chaque rôle déclare des outils connus, et l'écriture n'est ouverte que si elle est déclarée", () => {
    const known = new Set([...registry.READ_TOOLS, ...registry.WRITE_TOOLS]);

    for (const role of registry.roles()) {
        for (const tool of role.tools) assert.ok(known.has(tool), `${role.name} demande l'outil inconnu ${tool}`);
        if (!role.write) assert.deepEqual([...role.tools].sort(), [...READ_TOOLS].sort(), `${role.name} doit rester en lecture seule`);
        else assert.ok(role.tools.some(tool => !READ_TOOLS.includes(tool)), `${role.name} doit disposer d'au moins un outil d'écriture`);
    }

    assert.throws(
        () => registry.READ_TOOLS.push("write_file"),
        TypeError,
        "la liste des outils de lecture ne doit pas être modifiable"
    );
    assert.throws(
        () => registry.WRITE_TOOLS.push("delete_path"),
        TypeError,
        "la liste des outils d'écriture ne doit pas être modifiable"
    );
});

test("les sous-agents spécialisés ont des instructions verrouillées et leurs skills", () => {
    const ui = registry.roles().find(role => role.name === "roblox-interface");
    assert.match(ui.instructions, /ScreenGui/);
    assert.match(ui.instructions, /TweenService/);
    assert.match(ui.instructions, /mobile/i);
    assert.ok(ui.skills.includes("roblox-ui"));
    assert.ok(Object.isFrozen(ui));

    const threeD = registry.roles().find(role => role.name === "roblox-3d");
    assert.match(threeD.instructions, /Blender/);
    assert.match(threeD.instructions, /0,28/);
    assert.ok(threeD.tools.includes("blender"));
    assert.ok(threeD.skills.includes("blender-model"));
});

test("le prompt du sous-agent reprend la mission, ses outils et son rôle", () => {
    const prompt = buildPrompt({ prompt: "Crée un HUD de munitions", role: "roblox-interface", observations: [], turn: 1 });
    assert.match(prompt, /MISSION :\nCrée un HUD de munitions/);
    assert.match(prompt, /OUTILS AUTORISÉS : .*write_file/);
    assert.match(prompt, /SPÉCIALITÉ : Interfaces Roblox/);
    assert.match(prompt, /ÉCRITURE/);

    const readOnly = buildPrompt({ prompt: "Inventorie les écrans", role: "general", observations: [], turn: 1 });
    assert.doesNotMatch(readOnly, /OUTILS AUTORISÉS : .*write_file/);
    assert.doesNotMatch(readOnly, /ÉCRITURE/);
});

test("un rôle inconnu reste refusé", () => {
    assert.throws(() => roleOf("unity"), /Rôle de sous-agent inconnu/);
    assert.throws(() => check({ prompt: "Explorer", role: "unity" }), /Rôle de sous-agent inconnu/);
    assert.doesNotThrow(() => check({ prompt: "Crée le HUD", role: "roblox-interface" }));
    assert.doesNotThrow(() => validateToolCall({ name: "task", args: { prompt: "Modèle", role: "roblox-3d" } }));
});

test("le catalogue cite chaque rôle ; le mode d'accès est dit dans le prompt du rôle", () => {
    const catalog = registry.catalogText();
    for (const name of NAMES) {
        if (name === "general") continue;
        assert.match(catalog, new RegExp(`"${name}"`));
    }
    assert.match(catalog, /roblox-interface[^\n]*écriture/);
    assert.match(rolePrompt("roblox-interface"), /MODIFIER le projet/);
    assert.match(rolePrompt("roblox-luau"), /LECTURE SEULE/);
});

test("l'agent principal reçoit le catalogue et la règle de découpage", () => {
    const catalog = registry.catalogText();
    assert.match(catalog, /roblox-interface/);
    assert.match(catalog, /roblox-3d/);
    assert.doesNotMatch(catalog, /"general"/, "le rôle de repli ne gonfle pas le catalogue");

    // Le catalogue est cité tel quel : il suffit d'ajouter un rôle pour qu'il soit proposé.
    const prompt = buildAgentPrompt({
        workspace: "/projet",
        env: {},
        task: "Une arme avec son inventaire",
        history: [],
        memorySummary: "vide",
        projectContext: "",
        observations: [],
        mcpCatalog: "",
        skillsCatalog: "",
        turn: 1
    });
    assert.match(prompt, /CATALOGUE DES SOUS-AGENTS/);
    assert.match(prompt, /"roblox-interface"/);
    assert.match(prompt, /"roblox-3d"/);
    assert.match(prompt, /DEMANDE QUI COUVRE LES DEUX/);
});

test("l'outil task est admis en mode plan, et l'écriture est détectée par outil", () => {
    assert.equal(needsWriteAccess({ name: "task", args: { role: "roblox-interface" } }), true);
    assert.equal(needsWriteAccess({ name: "write_file", args: { path: "a" } }), true);
    assert.equal(needsWriteAccess({ name: "read_file", args: { path: "a" } }), false);
    assert.equal(needsWriteAccess({ calls: [{ name: "read_file" }, { name: "search_files" }] }), false);
    assert.equal(needsWriteAccess({ calls: [{ name: "read_file" }, { name: "blender" }] }), true);
    assert.ok(TOOL_CATALOG.includes('"task"'), "le catalogue principal doit documenter task");
    assert.match(TOOL_CATALOG, /task — délègue à un SOUS-AGENT/);
});

test("les rôles sont visibles dans le document exposé aux consommateurs existants", () => {
    assert.deepEqual(Object.keys(ROLES), NAMES);
    for (const name of NAMES) {
        assert.equal(typeof ROLES[name].label, "string");
        assert.equal(typeof ROLES[name].instructions, "string");
    }
});

test("ajouter un sous-agent se limite à un fichier de rôle + son import", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const source = fs.readFileSync(path.join(__dirname, "..", "src", "agent", "subagents", "index.js"), "utf8");
    assert.match(source, /const BUILTIN = \[/);
    assert.match(source, /require\("\.\/roblox-interface"\)/);
    assert.match(source, /require\("\.\/roblox-3d"\)/);
});
