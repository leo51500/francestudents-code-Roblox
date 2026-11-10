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
    // Un jeu demandé sans préciser la plateforme reste une tâche Roblox.
    assert.equal(isRobloxTask("Fais-moi un jeu de combat"), true);
    assert.equal(isRobloxTask("Crée une map avec des arbres"), true);
    assert.equal(isRobloxTask("Ajoute un inventaire et une boutique"), true);
    assert.equal(isRobloxTask("Importe ce modèle GLB dans mon jeu"), true);

    const prompt = buildAgentPrompt({ ...baseContext, task: "Crée une lampe pour mon jeu Roblox" });
    assert.match(prompt, /ROUTAGE AUTOMATIQUE/);
    assert.match(prompt, /DANS BLENDER/);
    assert.match(prompt, /PREUVE VISUELLE OBLIGATOIRE/);
    assert.match(prompt, /roblox-ui/);
    assert.match(prompt, /action:import/);
    assert.match(prompt, /action:upload/);
    assert.match(prompt, /OBJECTIF : TÂCHE ROBLOX\/BLENDER/);
    // L'agent ouvre lui-même Blender/Studio au lieu de le demander à l'utilisateur.
    assert.match(prompt, /open_program/);
    assert.match(prompt, /ne demande pas à l'utilisateur de le faire avant d'avoir essayé/);
});

test("le suivi rappelle d’ouvrir Blender/Studio avant de se déclarer bloqué", () => {
    const prompt = buildFollowUpPrompt({ task: "Crée une épée Roblox", turn: 2, maxTurns: 15 });
    assert.match(prompt, /open_program/);
    assert.match(prompt, /relance le diagnostic/);
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

test("une demande hors Roblox ne reçoit pas le rappel Blender du suivi", () => {
    const prompt = buildFollowUpPrompt({ task: "Explique src/main.js", turn: 2, maxTurns: 15 });
    assert.doesNotMatch(prompt, /géométrie 3D dans Blender/);
    assert.doesNotMatch(prompt, /GUI natives cartoon/);
});

test("la spécialisation est bornée aux demandes Roblox/3D", () => {
    const prompt = buildAgentPrompt({ ...baseContext });
    assert.match(prompt, /PÉRIMÈTRE — ces règles s'appliquent à toute demande de jeu/);
    assert.match(prompt, /ne récite pas de limites d’opérateur/);
});
