"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { briefFor, briefSections, detectIntent } = require("../src/agent/prompt");

// Un guide qui ne dit rien de plus coûte des jetons et dilue l'attention du modèle.
// Ces bornes sont hautes mais réelles : elles attrapent une section qui double de taille,
// pas une reformulation de quelques lignes. Les ajuster est un choix ponctuel, pas un réflexe.
const BUDGETS = {
    roblox: 2000,
    lighting: 2200,
    blender: 2400,
    reference: 1200,
    sound: 1400
};

// Cas couvrant toutes les combinaisons, y compris le pire cas (tout déclenché).
const CASES = {
    éclairage: "Corrige mon éclairage : Studio affiche Migration de la compatibilité vers Voxel Lighting",
    sons: "Ajoute des sons d'ambiance à mon jeu Roblox",
    blender: "Modélise une caisse en 3D pour Roblox",
    référence: "Reproduis cette image pour Roblox",
    complet: "Modélise en 3D une caisse comme sur l'image, ajoute un son de coup et corrige l'éclairage Voxel"
};

// Marqueur de début de chaque section, et ordre réel d'injection (briefSections).
const MARKERS = {
    roblox: "OBJECTIF : JEU ROBLOX JOUABLE",
    lighting: "ÉCLAIRAGE ROBLOX",
    blender: "BOÎTE À OUTILS BLENDER",
    reference: "OBJECTIF : RESPECTER LA RÉFÉRENCE FOURNIE",
    sound: "SONS ROBLOX"
};

/** Taille de la section seule : du début d'un guide au début du suivant. */
function sizeOf(section, task, attachments = []) {
    const full = briefFor(detectIntent(task), task, attachments);
    const sections = briefSections(detectIntent(task), task, attachments);
    const start = full.indexOf(MARKERS[section]);
    if (start < 0) return null;
    const next = sections.slice(sections.indexOf(section) + 1).map(name => full.indexOf(MARKERS[name])).find(index => index > start);
    return (next === undefined ? full.length : next) - start;
}

test("chaque guide tient dans son budget", () => {
    const failures = [];
    for (const [name, task] of Object.entries(CASES)) {
        const sections = briefSections(detectIntent(task), task, [{ mime: "image/png" }]);
        for (const section of sections) {
            const size = sizeOf(section, task, [{ mime: "image/png" }]);
            if (size === null) {
                failures.push(`${name} : guide « ${section} » annoncé mais absent du brief`);
            } else if (size > BUDGETS[section]) {
                failures.push(`${name} : guide « ${section} » = ${size} caractères (budget ${BUDGETS[section]})`);
            }
        }
    }
    assert.deepEqual(failures, [], failures.join("\n"));
});

test("le pire cas réunit bien tous les guides et reste mesurable", () => {
    const sections = briefSections(detectIntent(CASES.complet), CASES.complet, [{ mime: "image/png" }]);
    assert.deepEqual(sections, ["roblox", "lighting", "blender", "reference", "sound"]);
    const total = briefFor(detectIntent(CASES.complet), CASES.complet, [{ mime: "image/png" }]).length;
    // Le brief complet ne doit jamais dépasser la moitié d'un budget de message confortable.
    assert.ok(total < 12000, `brief complet : ${total} caractères`);
});
