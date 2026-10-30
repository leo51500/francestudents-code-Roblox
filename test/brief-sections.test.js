"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { briefSections, briefFor, detectIntent } = require("../src/agent/prompt");

// Ces tests contrôlent le ROUTAGE des guides, section par section. Chercher un mot
// dans le prompt complet donne des faux positifs (le catalogue d'outils contient
// déjà « rbxassetid », et « tourne » apparaît dans le texte de base).
function sectionsOf(task, attachments = []) {
    return briefSections(detectIntent(task), task, attachments);
}

test("éclairage : seul le guide Voxel est ajouté, avec le lien officiel", () => {
    const task = "Corrige mon éclairage : Studio affiche Migration de la compatibilité vers Voxel Lighting";
    const sections = sectionsOf(task);
    assert.deepEqual(sections, ["roblox", "lighting"]);
    const brief = briefFor(detectIntent(task), task);
    assert.match(brief, /3128560/);
    assert.doesNotMatch(brief, /SONS ROBLOX — Tu ne peux pas écouter/);
    assert.doesNotMatch(brief, /BOÎTE À OUTILS BLENDER/);
});

test("sons : seule la demande de sons reçoit le guide, sans les autres", () => {
    const task = "Ajoute un système de sons à mon jeu Roblox";
    assert.deepEqual(sectionsOf(task), ["roblox", "sound"]);
    const brief = briefFor(detectIntent(task), task);
    assert.match(brief, /jamais une valeur supposée/);
    assert.doesNotMatch(brief, /3128560/);
    assert.doesNotMatch(brief, /bevel\(obj, width\)/);
});

test("blender : la demande de modèle reçoit la boîte à outils, pas le guide audio", () => {
    const task = "Modélise une caisse pour Roblox, style low-poly";
    assert.deepEqual(sectionsOf(task), ["roblox", "blender"]);
    const brief = briefFor(detectIntent(task), task);
    assert.match(brief, /bevel\(obj, width\)/);
    assert.match(brief, /assign_material/);
    assert.doesNotMatch(brief, /Tu ne peux pas écouter/);
});

test("une demande sans rapport ne reçoit aucun guide", () => {
    const task = "Crée une commande pour ouvrir la boutique";
    assert.deepEqual(sectionsOf(task), []);
    const brief = briefFor(detectIntent(task), task);
    assert.doesNotMatch(brief, /3128560/);
    assert.doesNotMatch(brief, /BOÎTE À OUTILS BLENDER/);
    assert.doesNotMatch(brief, /SONS ROBLOX/);
});

test("« asset » seul ne déclenche pas les outils Blender (mot trop courant)", () => {
    assert.deepEqual(sectionsOf("Répare le chargement de cet asset Roblox"), ["roblox"]);
});

test("une image jointe ajoute le brief de référence, avant le guide des sons", () => {
    const task = "Reproduis cette épée pour Roblox";
    assert.deepEqual(sectionsOf(task, [{ mime: "image/png" }]), ["roblox", "reference"]);
    // Une épée décrite par une image n'est pas forcément modélisée : le guide Blender
    // reste réservé aux demandes qui parlent de modèle, mesh ou 3D.
    const withSound = "Modélise une caisse en 3D pour Roblox comme sur l'image, avec un son de coup";
    assert.deepEqual(sectionsOf(withSound, [{ mime: "image/png" }]), ["roblox", "blender", "reference", "sound"]);
});

test("une lecture ou une recherche ne reçoit aucun guide (elle ne modifie rien)", () => {
    // Détection d'intention : « explique » et « cherche » passent en lecture/recherche
    // même quand le sujet (Blender) existe.
    for (const task of ["Explique ce que fait ce fichier de test", "Cherche la fonction de connexion"]) {
        assert.deepEqual(sectionsOf(task), [], task);
    }
});
