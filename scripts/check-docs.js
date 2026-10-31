#!/usr/bin/env node
"use strict";

/**
 * Vérifie que les documents visibles citent la version réellement publiée.
 *
 * Sans ce garde-fou, le README et le contexte de reprise dérivent de plusieurs
 * versions et les assistants travaillent sur un état qui n'existe plus.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const version = require(path.join(ROOT, "package.json")).version;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const problems = [];

const readme = read("README.md");
if (!new RegExp(`Nouveautés\\s+${version.replace(/\./g, "\\.")}`).test(readme)) {
    problems.push(`README.md : la section « Nouveautés » ne cite pas la version ${version}.`);
}
if (/Lance FranceStudent IDE/.test(readme)) {
    problems.push("README.md : le nom « FranceStudent IDE » est encore utilisé pour lancer l'application.");
}

const context = read("docs/AI_CONTEXT.md");
if (!new RegExp(`Version en cours\\s*:\\s*\\*{0,2}\\s*${version.replace(/\./g, "\\.")}`).test(context)) {
    problems.push(`docs/AI_CONTEXT.md : « Version en cours » ne cite pas ${version}.`);
}

const highlights = read("desktop/release-highlights.js");
if (!new RegExp(`"${version.replace(/\./g, "\\.")}"\\s*:`).test(highlights)) {
    problems.push(`desktop/release-highlights.js : aucune entrée pour ${version}.`);
}

if (problems.length) {
    console.error("Documents désynchronisés :");
    for (const problem of problems) console.error(`- ${problem}`);
    console.error("Mets à jour les documents, puis relance npm run check:docs.");
    process.exitCode = 1;
} else {
    console.log(`Documents alignés sur la version ${version}.`);
}
