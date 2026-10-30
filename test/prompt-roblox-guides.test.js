"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAgentPrompt } = require("../src/agent/prompt");

function prompt(task, extra = {}) {
    return buildAgentPrompt({
        workspace: "/projet",
        env: {},
        task,
        history: [],
        memorySummary: "",
        observations: [],
        turn: 1,
        maxTurns: 15,
        ...extra
    });
}

// L'intention « lire » renvoie le brief de lecture sans les guides Roblox :
// les cas ci-dessous utilisent une demande de modification.

test("l'éclairage Compatibility → Voxel est expliqué avec le lien officiel", () => {
    const text = prompt("Corrige mon éclairage : Studio affiche Migration de la compatibilité vers Voxel Lighting, que faire ?");
    assert.match(text, /Voxel/);
    assert.match(text, /Compatibility Lighting/);
    assert.match(text, /n’est pas une erreur|n'est pas une erreur/);
    assert.match(text, /https:\/\/devforum\.roblox\.com\/t\/compatibility-lighting-becomes-retro-tone-mapping-sunset-migration\/3128560/);
    // Paragraphe complet (le prompt complet est découpé en morceaux par modèle).
    assert.match(text, /LIGHTING|lighting-becomes-retro|Voxel Lighting/);
});

test("un fichier gardé par Studio ne doit pas être réécrit, et les sons exigent un vrai identifiant", () => {
    const text = prompt("Ajoute un système de sons, mais ce fichier est utilisé par une autre instance du Studio");
    assert.match(text, /rbxassetid/);
    assert.match(text, /jamais une valeur supposée|n'invente jamais/i);
    assert.match(text, /SoundGroup/);
});

test("une image de référence impose une description avant la modélisation", () => {
    const text = prompt("Modélise cette épée pour Roblox", { attachments: [{ mime: "image/png" }] });
    assert.match(text, /RÉFÉRENCE FOURNIE/);
    assert.match(text, /Décris-la AVANT de modéliser/);
    assert.match(text, /silhouette/);
});

test("les demandes sans rapport (boutique) ne reçoivent ni guide éclairage, ni sons, ni outils Blender", () => {
    const text = prompt("Crée une commande pour ouvrir la boutique");
    assert.match(text, /TÂCHE DÉTECTÉE : create/);
    // Le catalogue des outils contient l'exemple rbxassetid : on vérifie le guide, pas le catalogue.
    assert.doesNotMatch(text, /SONS ROBLOX — Tu ne peux pas écouter/);
    assert.doesNotMatch(text, /BOÎTE À OUTILS BLENDER/);
    assert.doesNotMatch(text, /3128560/);
    assert.doesNotMatch(text, /Tu ne peux pas écouter ni téléverser/);
    assert.doesNotMatch(text, /bevel\(obj, width\)/);
});

test("le brief Roblox nomme les outils de géométrie et la palette", () => {
    const text = prompt("Modifie mes modèles Blender, ils sont trop simples");
    assert.match(text, /bevel/);
    assert.match(text, /lathe/);
    assert.match(text, /palette/);
    assert.match(text, /quatre angles/);
    assert.match(text, /deux fois au maximum/);
});
