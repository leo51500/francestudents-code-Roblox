"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { state } = require("../src/state");
const { buildAgentPrompt, buildFollowUpPrompt } = require("../src/agent/prompt");

test("stateful follow-ups stay compact while fresh prompts retain permissions and plan labels", () => {
    const previous = state.fullAccess;
    const plan = [{ step: "Inspecter la composition", status: "completed" }, { step: "Contrôler le rendu", status: "in_progress" }];
    try {
        for (const full of [false, true]) {
            state.fullAccess = full;
            const next = buildFollowUpPrompt({ turn: 3, task: "Demande initiale à conserver", plan, lastObservation: { tool: "read_file", ok: true, result: { content: "fichier court" } } });
            assert.ok(next.length < 2600, `unnecessary follow-up overhead: ${next.length}`);
            assert.match(next, /OUTILS LOCAUX ENREGISTRÉS/);
            assert.match(next, /plan_progress/);
            assert.match(next, /completed/);
            assert.match(next, /Demande initiale à conserver/);
            assert.match(next, /Inspecter la composition/);
            assert.match(next, /Contrôler le rendu/);
            assert.doesNotMatch(next, /OUTILS MOTION DESIGN/);
            const fresh = buildAgentPrompt({ workspace: null, task: "Continuer", history: [], observations: [], plan });
            assert.match(fresh, /Inspecter la composition/);
            assert.doesNotMatch(fresh, /OUTILS MOTION DESIGN/);
            if (full) assert.match(fresh, /MODE FULL ACCÈS/);
        }
    } finally { state.fullAccess = previous; }
});

test("tool guidance covers local Git actions and uncertain command results", () => {
    const fresh = buildAgentPrompt({ workspace: null, task: "Git", history: [], observations: [], plan: [] });
    assert.match(fresh, /git status --short --branch/);
    assert.match(fresh, /git diff/);
    assert.match(fresh, /Ces commandes n’effectuent aucune publication distante/);
    const command = buildFollowUpPrompt({ turn: 2, lastObservation: { tool: "run_command", ok: false, result: { exit_code: 1 } } });
    assert.match(command, /Commande non aboutie ou incertaine/);
});

test("large logs keep their beginning, final errors and execution metadata without mutating stored results", () => {
    const previous = state.ecoMode; state.ecoMode = false;
    try {
        const output = "START_LOG\n" + "diagnostic\n".repeat(4000) + "\nFINAL_FAILURE";
        const observation = { tool: "run_command", ok: true, result: { output, exit_code: 1, timed_out: true, truncated: false } };
        const prompt = buildFollowUpPrompt({ turn: 2, lastObservation: observation });
        const delivered = JSON.parse(prompt.split("\n").find(line => line.startsWith('{"tool":')));
        assert.ok(prompt.length < 9500);
        assert.ok(delivered.result.output.length < 6200);
        assert.match(delivered.result.output, /^START_LOG/);
        assert.match(delivered.result.output, /FINAL_FAILURE$/);
        assert.equal(delivered.result.exit_code, 1);
        assert.equal(delivered.result.timed_out, true);
        assert.equal(delivered.result.truncated_in_prompt, true);
        assert.equal(observation.result.output, output);
        state.ecoMode = true;
        assert.ok(buildFollowUpPrompt({ turn: 2, lastObservation: observation }).length < prompt.length);
    } finally { state.ecoMode = previous; }
});

test("the five-request checkpoint survives context restart and is absent without a plan", () => {
    const plan = [{ step: "Vérifier", status: "in_progress" }];
    const context = { workspace: null, task: "Continuer", history: [], observations: [], plan, turn: 4, requestNumber: 5 };
    assert.match(buildAgentPrompt(context), /POINT PLAN/);
    assert.match(buildFollowUpPrompt(context), /POINT PLAN/);
    assert.doesNotMatch(buildFollowUpPrompt({ ...context, requestNumber: 6 }), /POINT PLAN/);
    assert.doesNotMatch(buildFollowUpPrompt({ ...context, plan: [] }), /POINT PLAN/);
});
