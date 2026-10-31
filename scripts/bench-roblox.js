"use strict";

// Banc de tâches Roblox : node scripts/bench-roblox.js
// Note des solutions avec des contrôles déterministes (aucun appel de modèle) :
// fichiers attendus, règles Luau, motifs requis/interdits, mapping Rojo, build optionnel.
// Sans argument, note les solutions de référence : c'est le test de santé du banc.
// Pour mesurer un agent : --task <id> --solution <dossier produit>.

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { inspectLuau } = require("../src/tools/roblox-check");
const sandbox = require("../src/tools/sandbox");

const ROOT = path.join(__dirname, "..");
const BENCH_DIR = path.join(ROOT, "bench", "roblox");
const TASKS_FILE = path.join(BENCH_DIR, "tasks.json");
const PLACEHOLDERS = {
    "__GAME_NAME__": "Bench Obby",
    "__PROJECT_NAME__": "BenchObby",
    "__STORE_NAME__": "BenchObbyBest",
};

function flagValue(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? null : process.argv[index + 1] || null;
}

async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...await walk(abs));
        else if (entry.isFile()) files.push(abs);
    }
    return files;
}

async function copyContents(source, target) {
    await fsp.mkdir(target, { recursive: true });
    for (const entry of await fsp.readdir(source)) {
        await fsp.cp(path.join(source, entry), path.join(target, entry), { recursive: true });
    }
}

async function copySolution(task, target) {
    const source = task.solution.startsWith("template:")
        ? path.join(ROOT, "src", "game-templates", task.solution.slice("template:".length))
        : path.join(BENCH_DIR, task.solution);
    if (!fs.existsSync(source)) throw new Error(`Solution introuvable pour ${task.id} : ${source}`);
    await copyContents(source, target);

    for (const file of await walk(target)) {
        if (!/\.(lua|luau|json|toml)$/i.test(file)) continue;
        let text = await fsp.readFile(file, "utf8");
        let changed = false;
        for (const [key, value] of Object.entries(PLACEHOLDERS)) {
            if (text.includes(key)) {
                text = text.split(key).join(value);
                changed = true;
            }
        }
        if (changed) await fsp.writeFile(file, text);
    }
}

function relativeFiles(workspace, rel) {
    const abs = path.resolve(workspace, rel);
    const inside = path.relative(workspace, abs);
    if (inside.startsWith("..") || path.isAbsolute(inside)) return null;
    return abs;
}

function readText(workspace, rel) {
    const abs = relativeFiles(workspace, rel);
    if (!abs || !fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, "utf8");
}

function checkFiles(workspace, task) {
    const missing = (task.files || []).filter(rel => !fs.existsSync(path.join(workspace, rel)));
    return {
        name: "fichiers",
        passed: missing.length === 0,
        detail: missing.length ? `absent(s) : ${missing.join(", ")}` : `${(task.files || []).length} fichier(s) présent(s)`,
    };
}

async function luauDiagnostics(workspace) {
    const files = (await walk(workspace)).filter(file => /\.(luau|lua)$/i.test(file));
    const diagnostics = [];
    for (const file of files) {
        const source = await fsp.readFile(file, "utf8");
        diagnostics.push(...inspectLuau(source, path.relative(workspace, file).split(path.sep).join("/")));
    }
    return { files: files.length, diagnostics };
}

function formatDiagnostic(item) {
    return `${item.file}:${item.line} [${item.code}] ${item.message}`;
}

async function checkLuau(workspace, spec = {}) {
    const { files, diagnostics } = await luauDiagnostics(workspace);
    if (!files) return { name: "luau", passed: false, detail: "aucun fichier .luau/.lua" };

    const failCodes = new Set(spec.fail_on || []);
    const failed = spec.clean
        ? diagnostics
        : diagnostics.filter(item => (item.severity === "error" && failCodes.has("error")) || failCodes.has(item.code));

    return {
        name: "luau",
        passed: failed.length === 0,
        detail: failed.length
            ? `${failed.length} diagnostic(s) bloquant(s) : ${failed.slice(0, 5).map(formatDiagnostic).join(" | ")}`
            : `${files} fichier(s), aucun diagnostic bloquant`,
        diagnostics: failed.slice(0, 20),
    };
}

function checkPatterns(workspace, list = [], wanted) {
    const failures = [];
    for (const item of list) {
        const source = readText(workspace, item.file);
        if (source === null) {
            failures.push(`${item.file} absent`);
            continue;
        }
        const pattern = new RegExp(item.pattern, item.flags || "m");
        if (pattern.test(source) !== wanted) {
            failures.push(`${item.file} : ${wanted ? "motif absent" : "motif interdit"} /${item.pattern}/`);
        }
    }
    return {
        name: wanted ? "motifs requis" : "motifs interdits",
        passed: failures.length === 0,
        detail: failures.length ? failures.join(" | ") : `${list.length} contrôle(s) respecté(s)`,
    };
}

function valueAt(object, dotted) {
    return dotted.split(".").reduce((value, key) => (value == null ? undefined : value[key]), object);
}

function checkJson(workspace, list = []) {
    const failures = [];
    for (const item of list) {
        const source = readText(workspace, item.file);
        if (source === null) {
            failures.push(`${item.file} absent`);
            continue;
        }
        let parsed;
        try {
            parsed = JSON.parse(source);
        } catch (error) {
            failures.push(`${item.file} JSON invalide : ${error.message}`);
            continue;
        }
        const actual = valueAt(parsed, item.path);
        if (item.equals !== undefined && actual !== item.equals) {
            failures.push(`${item.file} ${item.path} = ${JSON.stringify(actual)} au lieu de ${JSON.stringify(item.equals)}`);
        }
        if (item.exists === true && actual === undefined) {
            failures.push(`${item.file} ${item.path} absent`);
        }
        if (item.exists === false && actual !== undefined) {
            failures.push(`${item.file} ${item.path} ne devrait pas exister`);
        }
    }
    return {
        name: "json",
        passed: failures.length === 0,
        detail: failures.length ? failures.join(" | ") : `${list.length} valeur(s) vérifiée(s)`,
    };
}

async function checkBuild(workspace) {
    const rojo = sandbox.findRobloxTool(workspace, "rojo");
    if (!rojo) return { name: "rojo build", passed: true, skipped: true, detail: "rojo absent : contrôle ignoré" };
    const output = path.join(workspace, "build", "bench-place.rbxlx");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const result = await sandbox.runProcess(rojo, ["build", "-o", output], { cwd: workspace, timeoutMs: 120000 });
    const ok = result.exit_code === 0 && fs.existsSync(output);
    return {
        name: "rojo build",
        passed: ok,
        detail: ok ? "build réussi" : `échec (code ${result.exit_code}) : ${result.output.slice(-400)}`,
    };
}

async function gradeTask(task, candidate) {
    const temp = await fsp.mkdtemp(path.join(os.tmpdir(), `frst-bench-${task.id}-`));
    const workspace = path.join(temp, "workspace");
    try {
        if (candidate) await copyContents(candidate, workspace);
        else await copySolution(task, workspace);

        const checks = [checkFiles(workspace, task)];
        if (task.luau) checks.push(await checkLuau(workspace, task.luau));
        if (task.json) checks.push(checkJson(workspace, task.json));
        if (task.require) checks.push(checkPatterns(workspace, task.require, true));
        if (task.forbid) checks.push(checkPatterns(workspace, task.forbid, false));
        if (task.build) checks.push(await checkBuild(workspace));

        const graded = checks.filter(check => !check.skipped);
        const passed = graded.filter(check => check.passed).length;
        return {
            id: task.id,
            title: task.title,
            difficulty: task.difficulty,
            weight: task.weight || 1,
            passed: graded.every(check => check.passed),
            score: graded.length ? passed / graded.length : 1,
            checks,
        };
    } finally {
        await fsp.rm(temp, { recursive: true, force: true });
    }
}

function printResult(result, verbose) {
    const state = result.passed ? "OK" : "ECHEC";
    const graded = result.checks.filter(check => !check.skipped);
    const passed = graded.filter(check => check.passed).length;
    console.log(`${state}  ${result.id} (${result.difficulty}, poids ${result.weight}) — ${passed}/${graded.length}`);
    for (const check of result.checks) {
        const mark = check.skipped ? "ignore" : check.passed ? "ok" : "echec";
        if (!verbose && mark === "ok") continue;
        console.log(`   ${mark.padEnd(6)} ${check.name} : ${check.detail}`);
    }
}

async function main() {
    const tasks = JSON.parse(await fsp.readFile(TASKS_FILE, "utf8")).tasks || [];
    const taskId = flagValue("--task");
    const solution = flagValue("--solution");
    const json = process.argv.includes("--json");
    const verbose = process.argv.includes("--verbose") || Boolean(solution);

    if (solution && !taskId) {
        console.error("--solution exige --task <id> : une solution candidate ne vaut que pour une tâche.");
        process.exitCode = 2;
        return;
    }
    if (solution && !fs.existsSync(solution)) {
        console.error(`Solution candidate introuvable : ${solution}`);
        process.exitCode = 2;
        return;
    }

    const selected = taskId ? tasks.filter(task => task.id === taskId) : tasks;
    if (!selected.length) {
        console.error(`Tâche inconnue : ${taskId}. Disponibles : ${tasks.map(task => task.id).join(", ")}`);
        process.exitCode = 2;
        return;
    }

    const results = [];
    for (const task of selected) results.push(await gradeTask(task, solution));

    const passed = results.filter(result => result.passed).length;
    const weightedTotal = results.reduce((sum, result) => sum + result.weight, 0);
    const weightedPassed = results.reduce((sum, result) => sum + (result.passed ? result.weight : 0), 0);
    const percent = weightedTotal ? Math.round(weightedPassed / weightedTotal * 100) : 0;

    if (json) {
        console.log(JSON.stringify({
            version: 1,
            task: taskId || null,
            solution: solution ? path.resolve(solution) : null,
            results,
            summary: { passed, total: results.length, weighted_passed: weightedPassed, weighted_total: weightedTotal, percent },
        }, null, 2));
    } else {
        console.log(`Bench Roblox — ${passed}/${results.length} tâche(s), ${percent} % pondéré${solution ? " (solution candidate)" : ""}\n`);
        for (const result of results) printResult(result, verbose);
    }

    if (passed !== results.length) process.exitCode = 1;
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
