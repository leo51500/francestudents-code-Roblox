"use strict";

const fs = require("node:fs/promises");

const { CONFIG } = require("../../config");
const { state } = require("../../state");
const { resolveInWorkspace } = require("../security");
const { requireString, optionalString, optionalInt } = require("../core/args");
const { walkFiles } = require("../core/walk");

/*
 * Recherche de FICHIERS par nom approximatif.
 *
 * search_files cherche un texte DANS les fichiers ; find_files retrouve un
 * fichier dont l'agent ne connaît pas le chemin exact. C'est le cas fréquent
 * sur un gros projet : « le HUD », « le module de sauvegarde », « sprite ».
 * Aucun contenu n'est lu : le parcours reste rapide et sans confirmation.
 */

const MAX_RESULTS_DEFAULT = 20;
const MAX_RESULTS_LIMIT = 50;

const normalize = text =>
    String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const stem = name => name.replace(/\.[^.]+$/, "");

/** Sous-séquence : « hudclt » retrouve « HUD.client.luau ». */
function subsequence(needle, haystack) {
    let index = 0;

    for (const ch of haystack) {
        if (ch === needle[index]) index++;
        if (index === needle.length) return true;
    }

    return needle.length === 0;
}

function scoreFile(rel, query) {
    const target = normalize(rel);
    const name = normalize(rel.slice(rel.lastIndexOf("/") + 1));
    const base = stem(name);

    if (name === query || base === query) return 100;
    if (base.startsWith(query)) return 85;
    if (name.startsWith(query)) return 80;
    if (base.includes(query)) return 70;
    if (name.includes(query)) return 65;
    if (target.includes(query)) return 55;

    const tokens = query.split(/[\s/_\-.:]+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every(token => target.includes(token))) return 45;
    if (query.length >= 2 && subsequence(query, base)) return 35;
    if (query.length >= 3 && subsequence(query, name)) return 30;

    return 0;
}

function extFilter(ext) {
    if (!ext) return () => true;
    const wanted = normalize(ext).replace(/^\./, "");

    return rel => {
        const dot = rel.lastIndexOf(".");
        return dot > rel.lastIndexOf("/") && normalize(rel.slice(dot + 1)) === wanted;
    };
}

async function findFiles(args = {}) {
    const query = normalize(requireString(args.query, "query").trim());
    const maxResults = Math.min(
        Math.max(Number.isInteger(args.max_results) ? args.max_results : MAX_RESULTS_DEFAULT, 1),
        MAX_RESULTS_LIMIT
    );

    const { rel, target } = await resolveInWorkspace(state.workspace, args.path ?? ".");
    const info = await fs.stat(target);

    if (!info.isDirectory()) throw new Error("find_files doit cibler un dossier.");

    const accept = extFilter(args.ext);
    const all = await walkFiles(target, rel, { maxFiles: CONFIG.maxSearchFiles });

    const matches = [];

    for (const file of all) {
        if (!accept(file.rel)) continue;

        const score = scoreFile(file.rel, query);
        if (score <= 0) continue;

        const slash = file.rel.lastIndexOf("/");

        matches.push({
            path: file.rel,
            name: file.rel.slice(slash + 1),
            dir: slash >= 0 ? file.rel.slice(0, slash) : ".",
            score
        });
    }

    matches.sort((a, b) =>
        b.score - a.score ||
        a.path.length - b.path.length ||
        a.path.localeCompare(b.path)
    );

    const truncated = matches.length > maxResults;
    const kept = matches.slice(0, maxResults);

    return {
        query: args.query,
        ...(args.path ? { path: args.path } : {}),
        ...(args.ext ? { ext: args.ext } : {}),
        matches: kept,
        truncated,
        message: `${kept.length} fichier(s) trouvé(s) dans ${all.length} fichier(s) parcouru(s).`
    };
}

function check(args) {
    requireString(args.query, "query");
    optionalString(args.path, "path");
    optionalString(args.ext, "ext");
    optionalInt(args.max_results, "max_results");

    if (args.max_results !== undefined && (args.max_results < 1 || args.max_results > MAX_RESULTS_LIMIT)) {
        throw new Error(`max_results doit être compris entre 1 et ${MAX_RESULTS_LIMIT}.`);
    }
}

function describe(a) {
    const filter = a.ext ? ` (.${String(a.ext).replace(/^\./, "")})` : "";
    return `"${a.query}"${filter} dans ${a.path ?? "."}`;
}

module.exports = {
    name: "find_files",
    run: findFiles,
    check,
    describe,
    findFiles,
    scoreFile
};
