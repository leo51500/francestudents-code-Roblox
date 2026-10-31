"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { testScenario } = require("../src/tools/roblox-playtest");
const { TOOL_CATALOG, buildAgentPrompt } = require("../src/agent/prompt");
const { robloxLibrary } = require("../src/skills/roblox-library");

test("roblox_playtest : scénario générique sans demande exploitable", () => {
    const steps = testScenario("");
    assert.equal(steps.length, 6);
    assert.match(steps[0], /F5/);
    assert.match(steps.join(" "), /Output/);
});

test("roblox_playtest : le comportement demandé apparaît dans le scénario", () => {
    const steps = testScenario("ajoute une porte qui s'ouvre quand le joueur s'approche");
    assert.ok(steps.some(step => /porte qui s'ouvre/.test(step)), steps.join(" | "));
});

test("prompt : la vérification Roblox est décrite comme bloquante", () => {
    assert.match(TOOL_CATALOG, /roblox_check/);
    assert.match(TOOL_CATALOG, /clean/);
    const prompt = buildAgentPrompt({
        workspace: process.cwd(),
        env: {},
        task: "ajoute une porte qui s'ouvre près du joueur",
        history: [],
        memorySummary: "",
        projectContext: "",
        observations: [],
        turn: 1
    });
    assert.match(prompt, /Vérification BLOQUANTE/);
    assert.match(prompt, /completed:false/);
    assert.match(prompt, /decisions/);
});

test("skills Roblox : le rappel de vérification est partagé", () => {
    assert.ok(robloxLibrary.length >= 16);
    for (const skill of robloxLibrary) {
        assert.match(skill.content || "", /roblox_check/, skill.id);
    }
});
