"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ROLES, NAMES, roleOf, rolePrompt } = require("../src/agent/subagent-roles");
const { canWrite } = require("../src/agent/subagents");
const { buildPrompt, check, READ_TOOLS } = require("../src/agent/subagent");
const { validateToolCall } = require("../src/tools/registry");

test("les rôles de sous-agent sont connus, sans doublon et déclarent leur accès en écriture", () => {
    assert.deepEqual(NAMES, Object.keys(ROLES));
    assert.ok(NAMES.includes("general"));
    // Un rôle en écriture le dit explicitement ; les autres restent en lecture seule.
    for (const name of NAMES) assert.match(rolePrompt(name), canWrite(name) ? /MODIFIER le projet/ : /LECTURE SEULE/);
    assert.deepEqual(READ_TOOLS, ["list_directory", "read_file", "search_files"]);
});

test("le prompt du sous-agent garde la mission et ajoute la spécialité", () => {
    const prompt = buildPrompt({ prompt: "Inventorie les ScreenGui", role: "roblox-interface", observations: [], turn: 1 });
    assert.match(prompt, /MISSION :\nInventorie les ScreenGui/);
    assert.match(prompt, /SPÉCIALITÉ : Interfaces Roblox/);
    assert.match(prompt, /UIGridLayout|UIAspectRatioConstraint/);
    const general = buildPrompt({ prompt: "Lis src/app.js", observations: [], turn: 1 });
    assert.match(general, /SPÉCIALITÉ : Exploration générale/);
});

test("un rôle inconnu ou invalide est refusé au lieu d'inventer des consignes", () => {
    assert.equal(roleOf(undefined), "general");
    assert.equal(roleOf(" Roblox-3D "), "roblox-3d");
    assert.throws(() => roleOf("unity"), /Rôle de sous-agent inconnu/);
    assert.throws(() => check({ prompt: "Explorer", role: "unity" }), /Rôle de sous-agent inconnu/);
    assert.doesNotThrow(() => check({ prompt: "Explorer", role: "roblox-luau" }));
});

test("la description d'un sous-agent affiche son rôle", () => {
    const tool = require("../src/agent/subagent");
    assert.equal(tool.describe({ role: "blender", description: "Vérifier un GLB" }), "blender · Vérifier un GLB");
    assert.equal(tool.describe({ description: "Lire un module" }), "Lire un module");
});

test("task est validé par le registre avec ou sans rôle", () => {
    assert.doesNotThrow(() => validateToolCall({ name: "task", args: { prompt: "Explorer" } }));
    assert.doesNotThrow(() => validateToolCall({ name: "task", args: { prompt: "Explorer", role: "roblox-3d" } }));
    assert.throws(() => validateToolCall({ name: "task", args: { prompt: "Explorer", role: "unity" } }), /Rôle de sous-agent inconnu/);
    assert.throws(() => validateToolCall({ name: "task", args: {} }), /prompt/);
});
