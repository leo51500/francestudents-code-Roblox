"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Avant tout require du projet : la config lit l'environnement au chargement.
process.env.FS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "fscli-prompt-roblox-"));

const { buildAgentPrompt, buildFollowUpPrompt, isRobloxTask } = require("../src/agent/prompt");

const baseContext = {
    workspace: "/tmp/projet",
    env: { git: true, branch: "dev", node: "v22" },
    task: "Explique src/main.js",
    history: [],
    memorySummary: "aucune note",
    projectContext: "",
    observations: [],
    turn: 1,
    maxTurns: 15,
    correction: null
};

test("le routage Roblox/Blender est automatique et la preuve visuelle est imposée", () => {
    assert.equal(isRobloxTask("Crée une épée en 3D"), true);
    assert.equal(isRobloxTask("Ajoute une boutique à mon jeu Roblox"), true);
    assert.equal(isRobloxTask("Explique src/main.js"), false);
    assert.equal(isRobloxTask("Ouvre Visual Studio Code"), false);

    const prompt = buildAgentPrompt({ ...baseContext, task: "Crée une lampe pour mon jeu Roblox" });
    assert.match(prompt, /ROUTAGE AUTOMATIQUE/);
    assert.match(prompt, /DANS BLENDER/);
    assert.match(prompt, /PREUVE VISUELLE OBLIGATOIRE/);
    assert.match(prompt, /roblox-ui/);
    assert.match(prompt, /OBJECTIF : TÂCHE ROBLOX\/BLENDER/);
});

test("une demande sans 3D garde le brief générique mais la spécialisation reste rappelée", () => {
    const prompt = buildAgentPrompt({ ...baseContext });
    assert.doesNotMatch(prompt, /OBJECTIF : TÂCHE ROBLOX\/BLENDER/);
    assert.match(prompt, /SPÉCIALISATION ROBLOX \+ BLENDER/);
    assert.match(prompt, /CONTRÔLE DE ROUTAGE/);
});

test("le suivi de tâche rappelle le routage et la capture", () => {
    const prompt = buildFollowUpPrompt({ task: "Crée un décor Roblox", turn: 2, maxTurns: 15 });
    assert.match(prompt, /géométrie 3D dans Blender/);
    assert.match(prompt, /GUI natives cartoon/);
    assert.match(prompt, /capture examinée/);
});
