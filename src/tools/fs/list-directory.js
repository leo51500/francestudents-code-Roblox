"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const { CONFIG } = require("../../config");
const { state } = require("../../state");
const { normalizeRelative, resolveInWorkspace } = require("../security");
const memory = require("../../project/memory");
const { optionalString, optionalBool } = require("../core/args");

async function walkDirectory(absDir, relDir, depth, maxDepth, out) {
    const dirents = await fs.readdir(absDir, { withFileTypes: true });

    dirents.sort((a, b) =>
        Number(b.isDirectory()) - Number(a.isDirectory()) ||
        a.name.localeCompare(b.name, "fr")
    );

    for (const dirent of dirents) {
        if (out.length > CONFIG.maxDirectoryEntries) return;
        if (dirent.isSymbolicLink()) continue;

        const childRel = relDir === "." ? dirent.name : `${relDir}/${dirent.name}`;

        try {
            normalizeRelative(childRel);
        } catch {
            continue; // dossier ou fichier masqué (sensible, .git, node_modules...)
        }

        const isDir = dirent.isDirectory();
        out.push({ path: childRel, type: isDir ? "directory" : "file" });

        if (isDir && depth < maxDepth) {
            await walkDirectory(
                path.join(absDir, dirent.name),
                childRel,
                depth + 1,
                maxDepth,
                out
            );
        }
    }
}

// Profondeur d'un arbre compact : un projet Rojo réel descend à 4-6 niveaux
// (src/client/ui/...), au-delà de la limite de 2 de "recursive".
const TREE_DEPTH = 5;

/** Arbre textuel compact : dossiers puis fichiers, regroupés par dossier. */
function renderTree(entries) {
    const lines = [];
    for (const entry of entries) {
        const depth = entry.path.split("/").length - 1;
        const name = entry.path.slice(entry.path.lastIndexOf("/") + 1);
        lines.push(`${"  ".repeat(depth)}${entry.type === "directory" ? name + "/" : name}`);
    }
    return lines.join("\n");
}

async function listDirectory(args = {}) {
    const { rel, target } = await resolveInWorkspace(state.workspace, args.path ?? ".");
    const info = await fs.stat(target);

    if (!info.isDirectory()) throw new Error("Ce chemin n'est pas un dossier.");

    const tree = args.tree === true;
    const entries = [];
    const depth = tree ? TREE_DEPTH : args.recursive === true ? 2 : 0;
    await walkDirectory(target, rel, 0, depth, entries);

    const shown = entries.slice(0, CONFIG.maxDirectoryEntries);

    memory.rememberDir(rel, shown.length);

    const result = {
        path: rel,
        entries: shown,
        truncated: entries.length > shown.length,
        message: `${shown.length} élément(s).`
    };

    // L'arbre est une aide de lecture : entries reste la source de vérité.
    if (tree) result.tree = renderTree(shown);
    return result;
}

function check(args) {
    optionalString(args.path, "path");
    optionalBool(args.recursive, "recursive");
    optionalBool(args.tree, "tree");
}

function describe(a) {
    return a.path ?? ".";
}

module.exports = { name: "list_directory", run: listDirectory, check, describe, listDirectory };
