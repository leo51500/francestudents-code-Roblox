"use strict";

/**
 * Détection et lancement des applications de la chaîne Roblox + Blender.
 *
 * Aucun chemin n'est supposé unique : on combine le réglage manuel, les
 * installations classiques, les bibliothèques Steam (libraryfolders.vdf) et
 * le PATH. Seuls les exécutables connus peuvent être enregistrés et lancés.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFile, execFileSync, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const settings = require("./settings");

const execFileAsync = promisify(execFile);
const APPLICATION_CACHE_MS = 60_000;
let applicationCache = { at: 0, items: [] };

/** Dossiers Windows désignés par les GUID utilisés dans les AppID du menu Démarrer. */
const START_APP_FOLDERS = {
    "{6d809377-6af0-444b-8957-a3773f02200e}": () => process.env.ProgramFiles,
    "{905e63b6-c1bf-494e-b29c-65b732d3d21a}": () => process.env.ProgramFiles,
    "{7c5a40ef-a0fb-4bfc-874a-c0f2e0b9fa8e}": () => process.env["ProgramFiles(x86)"],
    "{f38bf404-1d43-42f2-9305-67de0b28fc23}": () => process.env.windir,
    "{1ac14e77-02e7-4e5d-b744-2eb1ae5198b7}": () => process.env.windir && path.join(process.env.windir, "System32"),
    "{f1b32785-6fba-4fcf-9d55-7b8e7f157091}": () => process.env.LOCALAPPDATA,
    "{3eb685db-65f9-4cf6-a03a-e3ef65729f3d}": () => process.env.APPDATA,
    "{5e6c858f-0e22-4760-9afe-ea3317b67173}": () => process.env.USERPROFILE
};

const DEFINITIONS = {
    blender: {
        id: "blender",
        label: "Blender",
        aliases: ["blender"],
        executables: ["blender.exe", "blender-launcher.exe"],
        steamFolders: ["Blender"]
    },
    robloxStudio: {
        id: "robloxStudio",
        label: "Roblox Studio",
        aliases: ["robloxstudio", "roblox-studio", "roblox studio", "studio", "roblox"],
        executables: ["RobloxStudioBeta.exe", "RobloxStudioLauncherBeta.exe"],
        steamFolders: ["Roblox Studio", "Roblox"]
    }
};

const PROGRAM_IDS = Object.keys(DEFINITIONS);
const REGISTRY_TIMEOUT = 5000;

function isFile(file) {
    try {
        return fs.statSync(file).isFile();
    } catch {
        return false;
    }
}

function isDirectory(dir) {
    try {
        return fs.statSync(dir).isDirectory();
    } catch {
        return false;
    }
}

function readDirectory(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
}

function fileTime(file) {
    try {
        return fs.statSync(file).mtimeMs;
    } catch {
        return 0;
    }
}

function pathDirectories() {
    return String(process.env.PATH || "")
        .split(path.delimiter)
        .map(item => item.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
}

function normalizeId(value) {
    const wanted = String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
    return Object.values(DEFINITIONS).find(definition =>
        definition.id.toLowerCase() === wanted || definition.aliases.includes(wanted)
    ) || null;
}

function getDefinition(value) {
    if (value && typeof value === "object" && typeof value.id === "string" && Object.hasOwn(DEFINITIONS, value.id)) {
        return DEFINITIONS[value.id];
    }
    const definition = normalizeId(value);
    if (!definition) {
        throw new Error(`Programme inconnu : ${value}. Programmes : ${PROGRAM_IDS.join(", ")}.`);
    }
    return definition;
}

function configuredPaths() {
    const value = settings.load().programPaths;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Lit une valeur de chaîne dans le registre Windows ("" si absente). */
function registryValue(key, name) {
    if (process.platform !== "win32") return "";
    try {
        const stdout = execFileSync("reg.exe", ["query", key, "/v", name], {
            encoding: "utf8",
            windowsHide: true,
            timeout: REGISTRY_TIMEOUT,
            stdio: ["ignore", "pipe", "ignore"]
        });
        const line = String(stdout).split(/\r?\n/).find(item => new RegExp(`\\b${name}\\b`, "i").test(item));
        if (!line) return "";
        const match = /\sREG_[A-Z]+\s+(.+)$/i.exec(line);
        return match ? match[1].trim() : "";
    } catch {
        return "";
    }
}

/** Extrait les chemins de bibliothèques d'un libraryfolders.vdf Steam. */
function parseSteamLibraryFolders(text) {
    const folders = [];
    const pattern = /"path"\s+"((?:[^"\\]|\\.)*)"/gi;
    let match;
    while ((match = pattern.exec(String(text || "")))) {
        const value = match[1].replace(/\\\\/g, "\\").replace(/\\"/g, '"');
        if (value) folders.push(value);
    }
    return folders;
}

/** Racines Steam connues, y compris les bibliothèques des autres disques. */
function steamLibraries() {
    if (process.platform !== "win32") return [];

    const roots = new Set();
    for (const value of [
        registryValue("HKCU\\Software\\Valve\\Steam", "SteamPath"),
        registryValue("HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"),
        registryValue("HKLM\\SOFTWARE\\Valve\\Steam", "InstallPath")
    ]) {
        if (value && isDirectory(value)) roots.add(path.normalize(value));
    }
    for (const variable of ["ProgramFiles(x86)", "ProgramFiles"]) {
        const base = process.env[variable];
        if (!base) continue;
        const candidate = path.join(base, "Steam");
        if (isDirectory(candidate)) roots.add(candidate);
    }

    const libraries = new Set(roots);
    for (const root of roots) {
        const vdf = path.join(root, "steamapps", "libraryfolders.vdf");
        let text;
        try {
            text = fs.readFileSync(vdf, "utf8");
        } catch {
            continue;
        }
        for (const folder of parseSteamLibraryFolders(text)) {
            if (isDirectory(folder)) libraries.add(path.normalize(folder));
        }
    }

    const seen = new Set();
    return [...libraries].filter(library => {
        const key = path.normalize(library).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function uniqueCandidates(items) {
    const seen = new Set();
    return items.filter(item => {
        const key = path.normalize(item.path).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function steamCandidates(definition) {
    const results = [];
    for (const library of steamLibraries()) {
        const common = path.join(library, "steamapps", "common");
        if (!isDirectory(common)) continue;

        for (const folder of definition.steamFolders) {
            for (const executable of definition.executables) {
                const candidate = path.join(common, folder, executable);
                if (isFile(candidate)) results.push({ path: candidate, source: "Steam" });
            }
        }

        // Dossier renommé, par exemple « Blender 5.2 ».
        for (const entry of readDirectory(common)) {
            if (!entry.isDirectory()) continue;
            const lower = entry.name.toLowerCase();
            const relevant = definition.steamFolders.some(folder =>
                lower.includes(folder.toLowerCase().split(" ")[0])
            );
            if (!relevant) continue;
            for (const executable of definition.executables) {
                const candidate = path.join(common, entry.name, executable);
                if (isFile(candidate)) results.push({ path: candidate, source: "Steam" });
            }
        }
    }
    return results;
}

function versionedExecutables(base, prefix, executables) {
    const files = [];
    for (const entry of readDirectory(base)) {
        if (!entry.isDirectory() || !entry.name.toLowerCase().startsWith(prefix.toLowerCase())) continue;
        for (const executable of executables) {
            const candidate = path.join(base, entry.name, executable);
            if (isFile(candidate)) files.push(candidate);
        }
    }
    return files.sort((left, right) => right.localeCompare(left, "en", { numeric: true }));
}

function blenderCandidates() {
    const results = [];
    const bases = [
        process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Blender Foundation"),
        process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Blender Foundation"),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Blender Foundation")
    ].filter(Boolean);

    for (const base of bases) {
        for (const file of versionedExecutables(base, "Blender", DEFINITIONS.blender.executables)) {
            results.push({ path: file, source: "Installation" });
        }
    }

    results.push(...steamCandidates(DEFINITIONS.blender));

    for (const directory of pathDirectories()) {
        for (const executable of DEFINITIONS.blender.executables) {
            const candidate = path.join(directory, executable);
            if (isFile(candidate)) results.push({ path: candidate, source: "PATH" });
        }
    }

    if (process.env.USERPROFILE) {
        for (const executable of DEFINITIONS.blender.executables) {
            const scoop = path.join(process.env.USERPROFILE, "scoop", "apps", "blender", "current", executable);
            if (isFile(scoop)) results.push({ path: scoop, source: "Scoop" });
        }
    }
    if (process.env.ProgramData) {
        const chocolatey = path.join(process.env.ProgramData, "chocolatey", "bin", "blender.exe");
        if (isFile(chocolatey)) results.push({ path: chocolatey, source: "Chocolatey" });
    }

    return uniqueCandidates(results);
}

function robloxStudioCandidates() {
    const results = [];

    if (process.env.LOCALAPPDATA) {
        const versions = path.join(process.env.LOCALAPPDATA, "Roblox", "Versions");
        const found = [];
        for (const entry of readDirectory(versions)) {
            if (!entry.isDirectory()) continue;
            for (const executable of DEFINITIONS.robloxStudio.executables) {
                const candidate = path.join(versions, entry.name, executable);
                if (isFile(candidate)) found.push(candidate);
            }
        }
        found.sort((left, right) => fileTime(right) - fileTime(left));
        for (const file of found) results.push({ path: file, source: "Roblox" });

        const direct = path.join(process.env.LOCALAPPDATA, "RobloxStudio", "RobloxStudioBeta.exe");
        if (isFile(direct)) results.push({ path: direct, source: "Roblox" });
    }

    results.push(...steamCandidates(DEFINITIONS.robloxStudio));

    for (const directory of pathDirectories()) {
        for (const executable of DEFINITIONS.robloxStudio.executables) {
            const candidate = path.join(directory, executable);
            if (isFile(candidate)) results.push({ path: candidate, source: "PATH" });
        }
    }

    return uniqueCandidates(results);
}

function candidatesFor(definition) {
    return definition.id === "blender" ? blenderCandidates() : robloxStudioCandidates();
}

function runningImages() {
    if (process.platform !== "win32") return new Set();
    try {
        const names = [...new Set(Object.values(DEFINITIONS)
            .flatMap(definition => definition.executables)
            .map(executable => path.parse(executable).name))];
        const script = `$names=@(${names.map(name => `'${name}'`).join(",")}); Get-Process -Name $names -ErrorAction SilentlyContinue | ForEach-Object { "$($_.ProcessName).exe" }; exit 0`;
        const stdout = execFileSync("powershell.exe", [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            script
        ], {
            encoding: "utf8",
            windowsHide: true,
            timeout: REGISTRY_TIMEOUT,
            stdio: ["ignore", "pipe", "ignore"]
        });
        return new Set(String(stdout).split(/\r?\n/).map(image => image.trim().toLowerCase()).filter(Boolean));
    } catch (error) {
        console.warn(`Impossible de vérifier si Blender ou Roblox Studio est déjà ouvert : ${error.message}`);
        return new Set();
    }
}

function isRunning(definition, images = runningImages()) {
    return definition.executables.some(executable => images.has(executable.toLowerCase()));
}

/** État d'un programme : chemin retenu, provenance et processus en cours. */
function detectProgram(value, images = null) {
    const definition = getDefinition(value);
    const manual = configuredPaths()[definition.id];
    const manualPath = typeof manual === "string" && manual.trim() ? path.resolve(manual) : "";
    let found = manualPath && isFile(manualPath) ? { path: manualPath, source: "Choisi" } : null;

    if (!found) {
        found = candidatesFor(definition).find(candidate => isFile(candidate.path)) || null;
    }

    const result = {
        id: definition.id,
        label: definition.label,
        found: Boolean(found),
        path: found ? found.path : "",
        source: found ? found.source : "",
        configured: Boolean(manualPath),
        running: isRunning(definition, images || undefined)
    };
    if (manualPath && !isFile(manualPath)) result.configuredMissing = true;
    return result;
}

function detectPrograms() {
    const images = runningImages();
    return {
        platform: process.platform,
        programs: PROGRAM_IDS.map(id => detectProgram(id, images))
    };
}

/** Enregistre un exécutable choisi manuellement, après vérification du nom. */
function setProgramPath(value, file) {
    const definition = getDefinition(value);
    const full = path.resolve(String(file || "").trim());
    if (!isFile(full)) throw new Error("Fichier introuvable.");
    if (path.extname(full).toLowerCase() !== ".exe") throw new Error("Choisis un fichier .exe.");
    const basename = path.basename(full).toLowerCase();
    if (!definition.executables.some(executable => executable.toLowerCase() === basename)) {
        throw new Error(`Ce fichier n’est pas ${definition.label}. Attendu : ${definition.executables.join(" ou ")}.`);
    }
    settings.save({ programPaths: { ...configuredPaths(), [definition.id]: full } });
    return detectProgram(definition);
}

function clearProgramPath(value) {
    const definition = getDefinition(value);
    const paths = { ...configuredPaths() };
    delete paths[definition.id];
    settings.save({ programPaths: paths });
    return detectProgram(definition);
}

/* ---------- Catalogue de toutes les applications Windows ---------- */

function foldText(value) {
    return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Lit la sortie JSON de Get-StartApps (objet seul ou tableau). */
function parseStartApps(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return [];
    let data;
    try {
        data = JSON.parse(trimmed);
    } catch {
        return [];
    }
    const rows = Array.isArray(data) ? data : [data];
    const items = [];
    const seen = new Set();
    for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const name = String(row.Name || "").trim();
        const target = String(row.AppID || "").trim();
        if (!name || !target || /^https?:\/\//i.test(target)) continue;
        const key = target.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
            id: target,
            name,
            target,
            source: target.startsWith("steam://") ? "Steam" : target.includes("!") ? "Microsoft Store" : "Menu Démarrer",
            kind: target.startsWith("steam://") ? "steam" : "app"
        });
    }
    return items.sort((left, right) =>
        left.name.localeCompare(right.name, "fr", { numeric: true, sensitivity: "base" })
    );
}

function searchApplications(applications, query, limit = 20) {
    const list = Array.isArray(applications) ? applications : [];
    const terms = foldText(query).trim().split(/\s+/).filter(Boolean);
    const matching = terms.length
        ? list.filter(item => {
            const haystack = foldText(`${item.name} ${item.source}`);
            return terms.every(term => haystack.includes(term));
        })
        : list;
    return matching.slice(0, Math.max(1, limit));
}

/** Applications du menu Démarrer, y compris jeux Steam et applications du Store. */
async function listApplications({ refresh = false } = {}) {
    if (process.platform !== "win32") return [];
    const now = Date.now();
    if (!refresh && applicationCache.items.length && now - applicationCache.at < APPLICATION_CACHE_MS) {
        return applicationCache.items;
    }

    let items;
    try {
        const { stdout } = await execFileAsync("powershell.exe", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress"
        ], {
            encoding: "utf8",
            windowsHide: true,
            timeout: 20_000,
            maxBuffer: 16 * 1024 * 1024
        });
        items = parseStartApps(stdout);
    } catch {
        items = [];
    }

    applicationCache = { at: now, items };
    return items;
}

function findApplication(applications, name) {
    const needle = foldText(name).trim();
    if (!needle) throw new Error("Indique le nom de l’application.");
    const list = Array.isArray(applications) ? applications : [];
    const exact = list.filter(item => foldText(item.name) === needle);
    if (exact.length) return exact[0];

    for (const test of [
        item => foldText(item.name).startsWith(needle),
        item => foldText(item.name).includes(needle)
    ]) {
        const matches = list.filter(test);
        if (matches.length === 1) return matches[0];
        if (matches.length > 1) {
            throw new Error(`Plusieurs applications correspondent : ${matches.slice(0, 6).map(item => item.name).join(", ")}. Précise le nom.`);
        }
    }
    throw new Error(`Application introuvable : ${name}.`);
}

function spawnDetached(file, args, { windowsHide = true } = {}) {
    return new Promise((resolve, reject) => {
        let child;
        try {
            child = spawn(file, args, { detached: true, stdio: "ignore", windowsHide });
        } catch (error) {
            reject(error);
            return;
        }
        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            child.unref();
            resolve(value);
        };
        const timer = setTimeout(() => finish({ pid: child.pid }), 1200);
        child.once("spawn", () => finish({ pid: child.pid }));
        child.once("error", error => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
        });
    });
}

/** Lance un .exe, ou passe par cmd pour les scripts .cmd/.bat. */
function spawnExecutable(file, args, options = {}) {
    if (/\.(cmd|bat)$/i.test(file)) {
        return spawnDetached("cmd.exe", ["/d", "/s", "/c", file, ...args], options);
    }
    return spawnDetached(file, args, options);
}

/** Exécutable réel derrière une application du menu Démarrer, si connu. */
function resolveStartAppExecutable(application) {
    if (!application) return "";
    if (application.kind === "exe" && isFile(application.target)) return application.target;
    const match = /^\{([0-9a-f-]{36})\}\\(.+)$/i.exec(String(application.target || ""));
    if (!match) return "";
    const base = START_APP_FOLDERS[match[1].toLowerCase()]?.();
    if (!base) return "";
    const parts = match[2].split(/[\\/]+/).filter(Boolean);
    if (!parts.length) return "";
    const full = path.join(base, ...parts);
    return path.extname(full).toLowerCase() === ".exe" && isFile(full) ? full : "";
}

function isUrl(value) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(String(value || ""));
}

/** Résout un fichier, un dossier ou une URL par rapport au projet ouvert. */
function resolveOpenTarget(value) {
    const text = String(value || "").trim();
    if (!text) throw new Error("Indique un fichier, un dossier ou une URL.");
    if (isUrl(text)) {
        let url;
        try {
            url = new URL(text);
        } catch {
            throw new Error("L’URL est invalide.");
        }
        if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Seules les URL HTTP et HTTPS peuvent être ouvertes.");
        }
        return { target: url.href, url: true, directory: false, file: false };
    }

    const { state } = require("./state");
    const base = state.workspace || process.cwd();
    const full = path.isAbsolute(text) ? path.normalize(text) : path.resolve(base, text);
    let stats;
    try {
        stats = fs.statSync(full);
    } catch {
        throw new Error(`Chemin introuvable : ${text}.`);
    }
    return { target: full, url: false, directory: stats.isDirectory(), file: stats.isFile() };
}

function findOnPath(names) {
    for (const directory of pathDirectories()) {
        for (const name of names) {
            const candidate = path.join(directory, name);
            if (isFile(candidate)) return candidate;
        }
    }
    return "";
}

function vscodeExecutable() {
    const candidates = [];
    for (const directory of pathDirectories()) {
        candidates.push(path.join(directory, "Code.exe"), path.join(directory, "code.cmd"));
    }
    for (const base of [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs"), process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]) {
        if (!base) continue;
        candidates.push(path.join(base, "Microsoft VS Code", "Code.exe"));
    }
    return candidates.find(isFile) || "";
}

function openWithDefault(target) {
    return spawnDetached("explorer.exe", [target]);
}

function revealPath(target) {
    if (target.directory) return spawnDetached("explorer.exe", [target.target]);
    return spawnDetached("explorer.exe", [`/select,${target.target}`]);
}

function launchTerminal(directory) {
    const terminal = findOnPath(["wt.exe"]);
    if (terminal) return spawnDetached(terminal, ["-d", directory], { windowsHide: false });
    const quoted = directory.replace(/'/g, "''");
    return spawnDetached("powershell.exe", ["-NoExit", "-Command", `Set-Location -LiteralPath '${quoted}'`], { windowsHide: false });
}

function launchVsCode(target) {
    const executable = vscodeExecutable();
    if (!executable) {
        throw new Error("Visual Studio Code est introuvable. Installe-le ou indique son Code.exe avec app.");
    }
    return spawnExecutable(executable, [target.target], { windowsHide: false });
}

async function launchApplicationWithTarget(application, target) {
    if (application.kind === "steam") {
        throw new Error(`${application.name} est un jeu Steam : il ne peut pas ouvrir un fichier.`);
    }
    const executable = resolveStartAppExecutable(application);
    if (!executable) {
        throw new Error(`${application.name} ne peut pas recevoir de fichier depuis le menu Démarrer. Indique son exécutable .exe avec path.`);
    }
    return spawnExecutable(executable, [target.target], { windowsHide: false });
}

/** Ouvre un fichier, un dossier ou une URL avec l'application choisie. */
async function openPathWith({ target: targetValue, app = "default", appId } = {}) {
    const target = resolveOpenTarget(targetValue);
    const requested = foldText(app).trim();

    let started;
    let label;
    if (!requested || ["default", "defaut", "open", "ouvrir"].includes(requested)) {
        started = await openWithDefault(target.target);
        label = "Application par défaut";
    } else if (["vscode", "vs code", "code", "visual studio code"].includes(requested)) {
        started = await launchVsCode(target);
        label = "Visual Studio Code";
    } else if (["explorer", "explorateur", "explorateur de fichiers", "dossier"].includes(requested)) {
        started = await revealPath(target);
        label = "Explorateur";
    } else if (["terminal", "powershell", "console", "wt"].includes(requested)) {
        if (!target.directory) throw new Error("Le terminal s’ouvre sur un dossier, pas sur un fichier.");
        started = await launchTerminal(target.target);
        label = "Terminal";
    } else if (appId || /^([a-z]:\\|\\\\|.*\.exe$)/i.test(String(app).trim())) {
        if (appId) {
            const applications = await listApplications();
            const wanted = String(appId).trim().toLowerCase();
            const application = applications.find(item => item.id.toLowerCase() === wanted);
            if (!application) throw new Error("Application inconnue. Actualise la liste et réessaie.");
            started = await launchApplicationWithTarget(application, target);
            label = application.name;
        } else {
            const executable = path.resolve(String(app).trim());
            if (!isFile(executable) || path.extname(executable).toLowerCase() !== ".exe") {
                throw new Error(`Exécutable introuvable : ${app}.`);
            }
            started = await spawnExecutable(executable, [target.target], { windowsHide: false });
            label = path.basename(executable, path.extname(executable));
        }
    } else {
        const applications = await listApplications();
        const application = findApplication(applications, app);
        started = await launchApplicationWithTarget(application, target);
        label = application.name;
    }

    return {
        name: label,
        app: label,
        target: target.target,
        launched: true,
        pid: started.pid,
        message: `${label} : ouverture demandée.`
    };
}

function launchTarget(application) {
    if (application.kind === "exe") {
        return spawnDetached(application.target, [], { windowsHide: false });
    }
    if (application.kind === "shortcut") {
        return spawnDetached("explorer.exe", [application.target]);
    }
    if (application.kind === "steam") {
        return spawnDetached("cmd.exe", ["/d", "/s", "/c", "start", "", application.target]);
    }
    return spawnDetached("explorer.exe", [`shell:AppsFolder\\${application.target}`]);
}

/** Ouvre une application du menu Démarrer, un jeu Steam ou un fichier choisi. */
async function launchApplication({ appId, name, path: filePath, target } = {}) {
    const provided = [appId, name, filePath].filter(value => typeof value === "string" && value.trim());
    if (provided.length !== 1) throw new Error("Indique soit appId, soit name, soit path (un seul).");

    let application;
    if (filePath) {
        const full = path.resolve(filePath.trim());
        if (!isFile(full)) throw new Error("Fichier introuvable.");
        const extension = path.extname(full).toLowerCase();
        if (![".exe", ".lnk", ".url"].includes(extension)) {
            throw new Error("Choisis un fichier .exe, .lnk ou .url.");
        }
        application = {
            id: `file:${full.toLowerCase()}`,
            name: path.basename(full, extension),
            target: full,
            source: "Fichier",
            kind: extension === ".exe" ? "exe" : "shortcut"
        };
    } else {
        const applications = await listApplications();
        if (appId) {
            const wanted = String(appId).trim().toLowerCase();
            application = applications.find(item => item.id.toLowerCase() === wanted);
            if (!application) throw new Error("Application inconnue. Actualise la liste et réessaie.");
        } else {
            application = findApplication(applications, name);
        }
    }

    let targetInfo = null;
    try {
        if (target && String(target).trim()) targetInfo = resolveOpenTarget(target);
        const opened = targetInfo ? await launchApplicationWithTarget(application, targetInfo) : null;
        const started = opened || await launchTarget(application);
        return {
            id: application.id,
            name: application.name,
            target: application.target,
            source: application.source,
            launched: true,
            pid: started.pid,
            message: opened
                ? `${application.name} : ${targetInfo.url ? targetInfo.target : path.basename(targetInfo.target)} ouvert.`
                : application.kind === "steam"
                    ? `${application.name} : lancement demandé à Steam.`
                    : `${application.name} : ouverture demandée.`
        };
    } catch (error) {
        throw new Error(`${application.name} n’a pas pu démarrer : ${error.message}`, { cause: error });
    }
}

/** Lance le programme détecté, sauf s'il tourne déjà. */
function launchProgram(value) {
    const definition = getDefinition(value);
    const info = detectProgram(definition);
    if (!info.found) {
        throw new Error(`${definition.label} est introuvable. Installe-le ou choisis son exécutable dans Extensions > Serveurs MCP.`);
    }
    if (info.running) {
        return Promise.resolve({
            id: definition.id,
            label: definition.label,
            path: info.path,
            launched: false,
            alreadyRunning: true,
            message: `${definition.label} est déjà ouvert.`
        });
    }

    return new Promise((resolve, reject) => {
        let child;
        try {
            child = spawn(info.path, [], { detached: true, stdio: "ignore", windowsHide: false });
        } catch (error) {
            reject(new Error(`${definition.label} n’a pas pu démarrer : ${error.message}`));
            return;
        }
        const done = () => {
            child.unref();
            resolve({
                id: definition.id,
                label: definition.label,
                path: info.path,
                launched: true,
                alreadyRunning: false,
                pid: child.pid,
                message: `${definition.label} démarré.`
            });
        };
        const timer = setTimeout(done, 800);
        child.once("spawn", () => {
            clearTimeout(timer);
            done();
        });
        child.once("error", error => {
            clearTimeout(timer);
            reject(new Error(`${definition.label} n’a pas pu démarrer : ${error.message}`));
        });
    });
}

module.exports = {
    PROGRAM_IDS,
    getDefinition,
    parseSteamLibraryFolders,
    steamLibraries,
    detectProgram,
    detectPrograms,
    setProgramPath,
    clearProgramPath,
    launchProgram,
    parseStartApps,
    searchApplications,
    listApplications,
    findApplication,
    launchApplication,
    openPathWith,
    resolveStartAppExecutable,
    resolveOpenTarget
};
