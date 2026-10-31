#!/usr/bin/env node
"use strict";

/**
 * Génère la liste des symboles déclarés au niveau racine par les modules du
 * renderer. Ces modules sont concaténés dans une seule portée : ESLint ne peut
 * pas les relier entre eux, mais il peut au moins signaler un nom inconnu.
 *
 * Usage :
 *   node scripts/renderer-globals.js          -> écrit globals.generated.json
 *   node scripts/renderer-globals.js --check  -> code 1 si le fichier est périmé
 */

const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");

const RENDERER = path.join(__dirname, "..", "desktop", "renderer");
const SRC = path.join(RENDERER, "src");
const TARGET = path.join(RENDERER, "globals.generated.json");

// Globals fournis par les bundles vendor ou par Electron/le navigateur.
const MANUAL = ["StudioVendor", "CM", "Terminal", "FitAddon"];

function moduleFiles() {
    return fs.readdirSync(SRC).filter((file) => /^\d{2}-[\w-]+\.js$/.test(file)).sort();
}

function addPattern(pattern, names) {
    if (!pattern) return;
    if (pattern.type === "Identifier") names.add(pattern.name);
    else if (pattern.type === "ObjectPattern") {
        for (const property of pattern.properties) addPattern(property.value || property.argument, names);
    } else if (pattern.type === "ArrayPattern") {
        for (const element of pattern.elements) addPattern(element, names);
    } else if (pattern.type === "RestElement") addPattern(pattern.argument, names);
    else if (pattern.type === "AssignmentPattern") addPattern(pattern.left, names);
}

function collect(file, names) {
    const code = fs.readFileSync(path.join(SRC, file), "utf8");
    const ast = espree.parse(code, { ecmaVersion: 2024, sourceType: "script", range: false, loc: false });
    for (const node of ast.body) {
        if (node.type === "FunctionDeclaration" && node.id) names.add(node.id.name);
        else if (node.type === "ClassDeclaration" && node.id) names.add(node.id.name);
        else if (node.type === "VariableDeclaration") {
            for (const declaration of node.declarations) addPattern(declaration.id, names);
        }
    }
}

const names = new Set(MANUAL);
for (const file of moduleFiles()) collect(file, names);
// « writable » : ces symboles sont déclarés par un module et réassignés par un
// autre (état partagé). no-undef reste actif pour les noms absents de la liste.
const output = `${JSON.stringify(Object.fromEntries([...names].sort().map((name) => [name, "writable"])), null, 2)}\n`;

if (process.argv.includes("--check")) {
    const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
    if (current !== output) {
        console.error("desktop/renderer/globals.generated.json n'est pas à jour : lance npm run build:renderer-globals.");
        process.exitCode = 1;
    } else {
        console.log(`Globals du renderer à jour (${names.size} symboles).`);
    }
} else {
    fs.writeFileSync(TARGET, output);
    console.log(`Globals du renderer générés (${names.size} symboles).`);
}
