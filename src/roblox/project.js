"use strict";

/**
 * Accès disque du projet Roblox : lecture du blueprint, écriture groupée avec
 * confirmation unique, journal d'annulation et sauvegarde des versions.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const { CONFIG } = require("../config");
const { ui } = require("../ui-bridge");
const { resolveInWorkspace } = require("../tools/security");
const { statOrNull, ensureParent } = require("../tools/core/fs-utils");
const { writeAtomic } = require("../tools/core/atomic");
const { finishMutation } = require("../tools/core/journal");
const memory = require("../project/memory");
const { newId } = require("../tools/core/args");
const { BLUEPRINT_FILE, LIBRARY_FILE, normalizeBlueprint } = require("./blueprint");

const TEXT_LIMIT = CONFIG.maxWriteBytes;
const MAX_PROJECT_FILES = 4000;

async function readText(workspace, rel) {
    const { target } = await resolveInWorkspace(workspace, rel);
    return fs.readFile(target, "utf8");
}

async function readJson(workspace, rel) {
    const raw = await readText(workspace, rel);
    try {
        return JSON.parse(raw.replace(/^\uFEFF/, ""));
    } catch (error) {
        throw new Error(`${rel} : JSON invalide (${error.message}).`, { cause: error });
    }
}

async function exists(workspace, rel) {
    try {
        const { target } = await resolveInWorkspace(workspace, rel);
        return Boolean(await statOrNull(target));
    } catch {
        return false;
    }
}

async function readBlueprint(workspace) {
    if (!(await exists(workspace, BLUEPRINT_FILE))) {
        throw new Error(
            `Aucun projet Roblox ici (${BLUEPRINT_FILE} absent). ` +
            "Appelle roblox_game avec action:init et le nom du jeu pour le créer."
        );
    }
    return normalizeBlueprint(await readJson(workspace, BLUEPRINT_FILE));
}

async function readLibrary(workspace) {
    if (!(await exists(workspace, LIBRARY_FILE))) {
        return { version: 1, assets: [] };
    }
    const raw = await readJson(workspace, LIBRARY_FILE);
    return {
        version: 1,
        ...raw,
        assets: Array.isArray(raw.assets) ? raw.assets : []
    };
}

function json(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Écrit une liste de fichiers { rel, content } en une seule opération confirmée.
 * Les fichiers existants sont ignorés sauf `overwrite: true`.
 */
async function writeProjectFiles(workspace, files, { overwrite = false, label = "Écrire les fichiers du projet", confirm = true } = {}) {
    if (!workspace) throw new Error("Aucun projet sélectionné.");
    if (!Array.isArray(files) || !files.length) throw new Error("Aucun fichier à écrire.");

    const planned = [];

    for (const file of files) {
        if (!file || typeof file.rel !== "string" || typeof file.content !== "string") {
            throw new Error("Chaque fichier doit avoir rel et content.");
        }
        if (file.content.includes("\0")) throw new Error(`Contenu binaire interdit : ${file.rel}`);
        if (Buffer.byteLength(file.content, "utf8") > TEXT_LIMIT) {
            throw new Error(`${file.rel} dépasse la limite de ${TEXT_LIMIT} octets.`);
        }
        const { rel, target } = await resolveInWorkspace(workspace, file.rel);
        if (rel === ".") throw new Error("Chemin de fichier invalide.");
        planned.push({ ...file, rel, target });
    }

    const states = [];
    for (const file of planned) {
        const info = await statOrNull(file.target);
        states.push({ ...file, exists: Boolean(info), previous: info ? await fs.readFile(file.target, "utf8") : null });
    }

    const toWrite = states.filter(file => !file.exists || overwrite);
    const skipped = states.filter(file => file.exists && !overwrite).map(file => file.rel);

    if (!toWrite.length) {
        return { created: 0, updated: 0, skipped, files: skipped, message: "Tous les fichiers existent déjà ; rien n'a été écrasé." };
    }

    if (confirm && !(await ui.confirm(`${label} (${toWrite.length} fichier${toWrite.length > 1 ? "s" : ""}) ?`))) {
        return { created: 0, updated: 0, skipped: states.map(file => file.rel), denied: true, message: "Écriture refusée par l'utilisateur." };
    }

    let created = 0;
    let updated = 0;
    const written = [];

    for (const file of toWrite) {
        // Revalidation juste avant écriture (le dossier peut avoir changé).
        const { target } = await resolveInWorkspace(workspace, file.rel);
        const backup = file.exists ? await memory.backupFile(newId(), file.previous) : null;
        const createdRoot = await ensureParent(target, workspace);

        await writeAtomic(target, file.content, {
            expected: file.exists ? file.previous : null,
            read: current => fs.readFile(current, "utf8")
        });

        memory.rememberFile(file.rel, file.content);
        await finishMutation({
            kind: file.exists ? "write" : "create",
            rel: file.rel,
            backup,
            createdDirs: createdRoot ? [createdRoot] : [],
            label: `fichier ${file.exists ? "modifié" : "créé"} : ${file.rel}`
        }, `fichier ${file.exists ? "modifié" : "créé"} : ${file.rel}`);

        if (file.exists) updated++;
        else created++;
        written.push(file.rel);
    }

    return {
        created,
        updated,
        skipped,
        files: written,
        message: `${created} fichier(s) créé(s), ${updated} mis à jour` +
            (skipped.length ? `, ${skipped.length} conservé(s)` : "") + "."
    };
}

/** Liste bornée des fichiers du projet (chemins relatifs, séparateur "/"). */
async function listProjectFiles(workspace, { limit = MAX_PROJECT_FILES } = {}) {
    const skip = new Set(["node_modules", ".git", ".frst", "build", "release", "dist"]);
    const files = [];

    async function walk(absolute, prefix, depth) {
        if (files.length >= limit || depth > 12) return;
        let entries;
        try {
            entries = await fs.readdir(absolute, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (files.length >= limit) return;
            if (entry.name.startsWith(".") && entry.name !== ".gitignore") continue;
            if (entry.isDirectory()) {
                if (skip.has(entry.name)) continue;
                await walk(path.join(absolute, entry.name), `${prefix}${entry.name}/`, depth + 1);
            } else if (entry.isFile()) {
                files.push(`${prefix}${entry.name}`);
            }
        }
    }

    await walk(workspace, "", 0);
    return files.sort();
}

/** Écritures atomiques de fichiers internes hors confirmation (build, rapport). */
async function writeGenerated(workspace, rel, content) {
    const { target } = await resolveInWorkspace(workspace, rel);
    await ensureParent(target, workspace);
    const previous = await statOrNull(target) ? await fs.readFile(target, "utf8") : null;
    await writeAtomic(target, content, {
        expected: previous,
        read: current => fs.readFile(current, "utf8")
    });
    return { rel, bytes: Buffer.byteLength(content, "utf8") };
}

module.exports = {
    readText,
    readJson,
    exists,
    readBlueprint,
    readLibrary,
    json,
    writeProjectFiles,
    writeGenerated,
    listProjectFiles
};
