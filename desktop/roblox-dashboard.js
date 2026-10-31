"use strict";

/**
 * Tableau de bord Roblox : état Rojo en direct, recompilation du projet et actions Wally.
 *
 * - `rojo('status')`     : état du serveur géré par l'IDE (vert = Studio connecté, orange = en attente).
 * - `rojo('start')`      : lance rojo serve sur le projet ouvert (pour recompiler la sourcemap).
 * - `rojo('stop')`       : arrête le serveur.
 * - `rojo('build')`      : rojo build vers .frst/build/game.rbxlx (résultat réel : code de sortie, sortie).
 * - `buildInfo()`        : dernier build réussi, sa date et le détecteur de fichiers Luau plus récents.
 * - `wally('status')`    : wally.toml / wally.lock, présence de wally, dossier des paquets.
 * - `wally('install')` / `wally('update')` : lance wally install / wally update, puis relit les paquets.
 *
 * Aucune commande arbitraire : les binaires sont ceux du projet (Aftman) ou du PATH, et les
 * arguments sont fixés ici. Le wally.toml, s'il est modifié par `wally install`, l'est par
 * wally lui-même ; le fichier de l'utilisateur n'est jamais réécrit à la main.
 */

const fs = require("node:fs");
const path = require("node:path");

const rojoServer = require("../src/tools/rojo-server");
const sandbox = require("../src/tools/sandbox");
const { findRojoProject, inspectLuau } = require("../src/tools/roblox-check");

const BUILD_DIR = path.join(".frst", "build");
const BUILD_FILE = path.join(BUILD_DIR, "game.rbxlx");
const MAX_PACKAGES = 600;
const IGNORED = new Set(["node_modules", ".git", ".frst", "build", "dist"]);
// Un script Luau plus gros est rarement lu à l'écran ; on évite de le charger à chaque actualisation.
const MAX_DIAGNOSTIC_FILE = 512 * 1024;

/** Dossier du projet ouvert, ou erreur explicite. */
function currentWorkspace() {
    const workspace = require("../src/state").state.workspace;
    if (!workspace) throw new Error("Ouvre un dossier de projet Roblox d'abord.");
    return workspace;
}

function buildPath(workspace) {
    return path.join(workspace, BUILD_FILE);
}

/** Date de la dernière modification d'un fichier, ou null. */
function mtimeOf(file) {
    try { return fs.statSync(file).mtimeMs; } catch { return null; }
}

/** Script Luau le plus récemment modifié du projet (sert à dire « le build est en retard »). */
function newestLuau(workspace, rel = ".", depth = 0, best = { file: null, at: 0 }) {
    if (depth > 10) return best;
    let entries;
    try { entries = fs.readdirSync(path.join(workspace, rel), { withFileTypes: true }); } catch { return best; }
    for (const entry of entries) {
        if (entry.name.startsWith(".") || IGNORED.has(entry.name)) continue;
        const child = rel === "." ? entry.name : `${rel}/${entry.name}`;
        if (entry.isDirectory()) {
            newestLuau(workspace, child, depth + 1, best);
        } else if (/\.luau?$/i.test(entry.name)) {
            const at = mtimeOf(path.join(workspace, child)) || 0;
            if (at > best.at) {
                best.at = at;
                best.file = child;
            }
        }
    }
    return best;
}

/** Informations de build : dernier .rbxlx, date, retard éventuel. */
function buildInfo(workspace = currentWorkspace()) {
    const file = buildPath(workspace);
    const at = mtimeOf(file);
    const newest = newestLuau(workspace);
    let size = 0;
    if (at) {
        try { size = fs.statSync(file).size; } catch { size = 0; }
    }
    return {
        path: BUILD_FILE.split(path.sep).join("/"),
        exists: Boolean(at),
        at: at || null,
        size,
        newest_script: newest.file,
        stale: Boolean(at && newest.at > at),
        project: findRojoProject(workspace)
    };
}

function status(workspace = currentWorkspace()) {
    const state = rojoServer.statusOf();
    return {
        running: Boolean(state.running),
        connected: Boolean(state.connected),
        host: state.host || "127.0.0.1",
        port: state.port || 34872,
        project: state.project || findRojoProject(workspace),
        url: state.url || null,
        clients: state.clients || 0,
        uptime_ms: state.uptime_ms || 0,
        last_error: state.last_error || null,
        log: Array.isArray(state.log) ? state.log.slice(-6) : [],
        build: buildInfo(workspace),
        diagnostics: diagnosticsInfo(workspace),
        // Vert = Studio connecté au serveur Rojo ; orange = serveur en attente de connexion.
        tone: state.running ? (state.connected ? "live" : "waiting") : "offline"
    };
}

async function build(workspace = currentWorkspace()) {
    const project = findRojoProject(workspace);
    if (!project) throw new Error("Aucun *.project.json : ce dossier n'est pas un projet Rojo.");
    const rojo = sandbox.findRobloxTool(workspace, "rojo");
    if (!rojo) throw new Error("rojo absent : installe-le avec « aftman add rojo-rbx/rojo ».");
    fs.mkdirSync(path.join(workspace, BUILD_DIR), { recursive: true });
    const output = BUILD_FILE.split(path.sep).join("/");
    const result = await sandbox.runProcess(rojo, ["build", project, "--output", output], { cwd: workspace, timeoutMs: 180000 });
    const ok = result.exit_code === 0;
    return {
        ok,
        project,
        output: ok ? output : null,
        exit_code: result.exit_code,
        timed_out: Boolean(result.timed_out),
        log: String(result.output || "").slice(-4000),
        build: buildInfo(workspace),
        message: ok
            ? `Build terminé : ${output}. La sourcemap Rojo se recharge à la prochaine synchronisation.`
            : `rojo build a échoué (code ${result.exit_code ?? "inconnu"}).`
    };
}

/* ---------- Diagnostics Luau du cockpit ----------
   Les règles Roblox locales (roblox_check) ne coûtent rien : ni binaire, ni
   confirmation. Les afficher dans le cockpit montre OÙ le problème se trouve au
   lieu de le laisser caché dans une réponse de chat. selene, luau-analyze et
   rojo build restent réservés à l'agent, qui en discute avec l'utilisateur. */

function diagnosticsInfo(workspace, limit = 40) {
    const files = [];
    const walkDir = (rel, depth) => {
        if (depth > 10 || files.length >= 500) return;
        let entries;
        try { entries = fs.readdirSync(path.join(workspace, rel), { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (entry.name.startsWith(".") || IGNORED.has(entry.name)) continue;
            const child = rel === "." ? entry.name : `${rel}/${entry.name}`;
            if (entry.isDirectory()) walkDir(child, depth + 1);
            else if (/\.luau?$/i.test(entry.name)) files.push(child);
        }
    };
    walkDir(".", 0);

    const all = [];
    for (const rel of files) {
        try {
            const info = fs.statSync(path.join(workspace, rel));
            if (info.size > MAX_DIAGNOSTIC_FILE) continue;
            all.push(...inspectLuau(fs.readFileSync(path.join(workspace, rel), "utf8"), rel));
        } catch { /* fichier illisible */ }
    }
    const errors = all.filter(item => item.severity === "error").length;
    const sorted = all
        .filter(item => item.severity === "error" || item.severity === "warning")
        .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
    return {
        files: files.length,
        errors,
        warnings: all.length - errors,
        clean: all.length === 0,
        items: sorted.slice(0, limit).map(item => ({
            file: item.file,
            line: item.line,
            severity: item.severity,
            code: item.code,
            message: item.message
        })),
        truncated: sorted.length > limit,
        message: !files.length
            ? "Aucun fichier Luau dans ce projet."
            : all.length
                ? `${errors} erreur(s) et ${all.length - errors} avertissement(s) Luau.`
                : "Aucun problème détecté par les règles Roblox locales."
    };
}

async function restart(workspace = currentWorkspace()) {
    rojoServer.stopServer();
    const project = findRojoProject(workspace);
    if (!project) throw new Error("Aucun *.project.json : ce dossier n'est pas un projet Rojo.");
    const started = await rojoServer.startServer(workspace, { project });
    if (started.error) throw new Error(started.error);
    // Etat lu tout de suite après le démarrage : le renderer actualise la barre d'état.
    return { ...status(workspace), message: `Rojo relancé sur ${started.host}:${started.port} (sourcemap régénérée).` };
}

async function rojo(action, workspace) {
    const dir = workspace || currentWorkspace();
    switch (String(action || "status")) {
        case "status": return status(dir);
        case "start": {
            const project = findRojoProject(dir);
            if (!project) throw new Error("Aucun *.project.json : ce dossier n'est pas un projet Rojo.");
            const started = await rojoServer.startServer(dir, { project });
            if (started.error) throw new Error(started.error);
            return { ...status(dir), message: `Rojo écoute sur ${started.host}:${started.port}.` };
        }
        case "stop": {
            rojoServer.stopServer();
            return { ...status(dir), message: "Serveur Rojo arrêté." };
        }
        case "build": return build(dir);
        case "restart": return restart(dir);
        case "diagnostics": return diagnosticsInfo(dir);
        default: throw new Error(`Action Rojo inconnue : ${action}.`);
    }
}

/* ---------- Wally ---------- */

/** Lit les dépendances déclarées dans wally.toml (section [dependencies] simple). */
function readWallyManifest(workspace) {
    const file = path.join(workspace, "wally.toml");
    if (!fs.existsSync(file)) return null;
    let text;
    try { text = fs.readFileSync(file, "utf8"); } catch { return null; }
    const dependencies = [];
    let inDependencies = false;
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        if (/^\[/.test(line)) {
            inDependencies = /^\[(dependencies|server-dependencies|dev-dependencies)\]/.test(line);
            continue;
        }
        if (!inDependencies) continue;
        const match = /^([A-Za-z0-9_-]+)\s*=\s*["']([^"']+)["']/.exec(line);
        if (match) dependencies.push({ name: match[1], version: match[2] });
    }
    return { file: "wally.toml", dependencies };
}

/** Paquets installés par wally : Packages/ et ServerPackages/. */
function listPackages(workspace) {
    const packages = [];
    for (const folder of ["Packages", "ServerPackages"]) {
        const root = path.join(workspace, folder);
        let entries;
        try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
        for (const entry of entries) {
            if (packages.length >= MAX_PACKAGES) break;
            if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
            const dir = path.join(root, entry.name);
            let version = null;
            for (const candidate of ["package.json", "wally.toml"]) {
                try {
                    const text = fs.readFileSync(path.join(dir, candidate), "utf8");
                    version = candidate === "package.json"
                        ? (JSON.parse(text).version || null)
                        : (/version\s*=\s*["']([^"']+)["']/.exec(text)?.[1] || null);
                    if (version) break;
                } catch { /* pas de métadonnée */ }
            }
            packages.push({ name: entry.name, folder, path: `${folder}/${entry.name}`, version });
        }
    }
    return packages.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
}

/** Ajoute Packages et ServerPackages aux alias .luaurc, pour que luau-lsp les indexe. */
function ensureLuaurcAliases(workspace) {
    const file = path.join(workspace, ".luaurc");
    const aliases = {};
    if (fs.existsSync(path.join(workspace, "Packages"))) aliases.shared = "Packages";
    if (fs.existsSync(path.join(workspace, "ServerPackages"))) aliases.server = "ServerPackages";
    if (!Object.keys(aliases).length) return null;
    if (!fs.existsSync(file)) {
        // Création : aucune configuration existante n'est écrasée.
        fs.writeFileSync(file, `${JSON.stringify({ languageMode: "nonstrict", aliases }, null, 2)}\n`, "utf8");
        return ".luaurc";
    }
    let data;
    try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
    // Fichier présent mais non JSON (commentaires) : on n'y touche pas.
    if (!data || typeof data !== "object") return null;
    const current = data.aliases && typeof data.aliases === "object" ? data.aliases : {};
    if (Object.entries(aliases).every(([key, value]) => current[key] === value)) return ".luaurc";
    data.aliases = { ...current, ...aliases };
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    return ".luaurc";
}

function wallyStatus(workspace = currentWorkspace()) {
    const manifest = readWallyManifest(workspace);
    const lock = fs.existsSync(path.join(workspace, "wally.lock"));
    const binary = sandbox.findRobloxTool(workspace, "wally");
    return {
        manifest: manifest?.file || null,
        dependencies: manifest?.dependencies || [],
        lock,
        binary: binary ? sandbox.relativeTo(workspace, binary) || binary : null,
        packages: listPackages(workspace),
        install: "aftman add UpliftGames/wally",
        message: !manifest
            ? "Aucun wally.toml : ce projet n'utilise pas Wally."
            : binary
                ? `${manifest.dependencies.length} dépendance(s) déclarée(s), ${listPackages(workspace).length} paquet(s) installé(s).`
                : "wally.toml détecté, mais wally est absent (aftman add UpliftGames/wally)."
    };
}

async function wally(action, workspace) {
    const dir = workspace || currentWorkspace();
    const verb = String(action || "status");
    if (verb === "status") return wallyStatus(dir);
    if (!["install", "update"].includes(verb)) throw new Error(`Action Wally inconnue : ${verb}.`);
    if (!readWallyManifest(dir)) throw new Error("Aucun wally.toml dans ce projet.");
    const binary = sandbox.findRobloxTool(dir, "wally");
    if (!binary) throw new Error("wally absent : installe-le avec « aftman add UpliftGames/wally ».");
    const result = await sandbox.runProcess(binary, [verb], { cwd: dir, timeoutMs: 180000 });
    const ok = result.exit_code === 0;
    const luaurc = ok ? ensureLuaurcAliases(dir) : null;
    const state = wallyStatus(dir);
    return {
        ...state,
        ok,
        action: verb,
        exit_code: result.exit_code,
        timed_out: Boolean(result.timed_out),
        log: String(result.output || "").slice(-4000),
        luaurc,
        message: ok
            ? `wally ${verb} terminé : ${state.packages.length} paquet(s) indexé(s)${luaurc ? " et alias .luaurc mis à jour" : ""}.`
            : `wally ${verb} a échoué (code ${result.exit_code ?? "inconnu"}).`
    };
}

module.exports = { rojo, status, build, restart, diagnosticsInfo, wally, wallyStatus, buildInfo, listPackages, readWallyManifest, ensureLuaurcAliases, newestLuau };
