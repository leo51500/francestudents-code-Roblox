"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

/*
 * Faits de projet collectés localement à l'ouverture.
 *
 * L'objectif n'est pas de résumer le code, mais de retenir des repères stables
 * et vérifiables (outil de build, commande de test, structure Rojo) pour que
 * l'agent n'ait pas à les redécouvrir à chaque conversation. Chaque fait est
 * recalculé à l'ouverture : le fichier réel reste la source de vérité.
 */

async function exists(workspace, relative) {
    try {
        await fs.access(path.join(workspace, ...relative.split("/")));
        return true;
    } catch {
        return false;
    }
}

async function readJson(file) {
    try {
        return JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
        return null;
    }
}

async function rootProjectFiles(workspace) {
    try {
        return (await fs.readdir(workspace, { withFileTypes: true }))
            .filter(entry => entry.isFile() && entry.name.endsWith(".project.json"))
            .map(entry => entry.name)
            .sort();
    } catch {
        return [];
    }
}

async function packageFact(workspace, facts) {
    const pkg = await readJson(path.join(workspace, "package.json"));
    if (!pkg) return;

    const script = pkg?.scripts?.test;
    if (typeof script === "string" && script.trim() && !/no test specified/i.test(script)) {
        facts.push({ key: "test", value: `npm test → ${script.trim().slice(0, 160)}` });
    }

    for (const [file, manager] of [["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["package-lock.json", "npm"]]) {
        if (await exists(workspace, file)) {
            facts.push({ key: "gestionnaire-paquets", value: manager });
            break;
        }
    }
}

/**
 * Calcule les faits sans lire de contenu sensible. Le résultat est un tableau
 * {key, value} prêt pour memory.addFact.
 */
async function collectFacts(workspace) {
    if (!workspace) return [];

    const facts = [];
    const projects = await rootProjectFiles(workspace);

    if (projects.length) {
        facts.push({ key: "projet-rojo", value: projects.join(", ") });
    }

    const structure = [];
    for (const dir of ["src/server", "src/client", "src/shared", "src/ReplicatedStorage", "tests"]) {
        if (await exists(workspace, dir)) structure.push(dir);
    }
    if (structure.length) facts.push({ key: "structure", value: structure.join(", ") });

    const tools = [];
    for (const [file, label] of [
        ["selene.toml", "selene"],
        [".stylua.toml", "stylua"],
        ["wally.toml", "wally"],
        ["aftman.toml", "aftman"],
        [".luaurc", "luaurc"],
        ["rokit.toml", "rokit"]
    ]) {
        if (await exists(workspace, file)) tools.push(label);
    }
    if (tools.length) facts.push({ key: "outils-luau", value: tools.join(", ") });

    await packageFact(workspace, facts);

    const blobs = [];
    for (const dir of ["assets", "build/models", ".frst"]) {
        if (await exists(workspace, dir)) blobs.push(dir);
    }
    if (blobs.length) facts.push({ key: "dossiers-generes", value: blobs.join(", ") });

    return facts;
}

/** Met à jour la mémoire persistante ; renvoie les faits appliqués. */
async function refresh(memory, workspace) {
    const facts = await collectFacts(workspace);

    for (const fact of facts) memory.addFact(fact.key, fact.value);

    if (facts.length) await memory.save();

    return facts;
}

module.exports = { collectFacts, refresh, rootProjectFiles };
