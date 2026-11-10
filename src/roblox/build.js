"use strict";

/**
 * Construction de la place Roblox avec Rojo. Le fichier .rbxlx est écrit dans
 * build/ ; aucune publication distante n'est effectuée.
 */

const path = require("node:path");
const fs = require("node:fs/promises");

const { readBlueprint, exists, writeGenerated } = require("./project");
const { setPhase } = require("./blueprint");
const { writeBlueprint } = require("./scaffold");
const { validateProject } = require("./validate");
const { runProcess } = require("../tools/command/runner");

async function findRojo() {
    const candidates = process.platform === "win32" ? ["rojo.exe", "rojo"] : ["rojo"];
    for (const directory of String(process.env.PATH || "").split(path.delimiter)) {
        for (const name of candidates) {
            const file = path.join(directory.replace(/^"|"$/g, ""), name);
            try {
                const { stat } = require("node:fs/promises");
                if ((await stat(file)).isFile()) return file;
            } catch {
                // absent
            }
        }
    }
    return "rojo";
}

/**
 * Valide puis construit la place. `skipChecks` évite la double compilation
 * quand l'agent vient déjà de valider.
 */
async function buildProject(workspace, { skipChecks = false, timeoutMs = 180000 } = {}) {
    const blueprint = await readBlueprint(workspace);
    if (!(await exists(workspace, "default.project.json"))) {
        throw new Error("default.project.json absent : la structure Rojo doit être créée avant le build.");
    }

    let validation = null;
    if (!skipChecks) {
        validation = await validateProject(workspace);
        if (!validation.ok) {
            return {
                ok: false,
                blocked: true,
                validation,
                message: "Build annulé : corriger les erreurs de validation d'abord."
            };
        }
    }

    const rojo = await findRojo();
    const output = `build/${blueprint.slug}.rbxlx`;
    await fs.mkdir(path.join(workspace, "build"), { recursive: true });
    const result = await runProcess({
        file: rojo,
        args: ["build", "default.project.json", "-o", output],
        cwd: workspace,
        timeoutMs
    });

    if (result.exit_code !== 0 || result.timed_out) {
        const outputText = String(result.output || "").trim().slice(-2500);
        const missing = result.exit_code === null || /Programme introuvable :/i.test(outputText);
        const message = result.timed_out
            ? "Rojo n'a pas terminé dans le délai imparti."
            : missing
                ? "Rojo est introuvable. Installe-le (https://rojo.space) ou ajoute rojo.exe au PATH."
                : `Rojo a échoué (code ${result.exit_code}).`;
        return {
            ok: false,
            validation,
            rojo,
            output: outputText,
            message
        };
    }

    if (!(await exists(workspace, output))) {
        return {
            ok: false,
            validation,
            rojo,
            output: String(result.output || "").slice(-2000),
            message: "Rojo a terminé sans produire le fichier attendu."
        };
    }

    const stats = await fs.stat(path.join(workspace, output));
    await writeGenerated(
        workspace,
        "build/last-build.json",
        `${JSON.stringify({ at: new Date().toISOString(), file: output, bytes: stats.size, rojo }, null, 2)}\n`
    );

    setPhase(blueprint, "build", "completed", `${output} (${(stats.size / 1024).toFixed(1)} Ko).`);
    if (validation?.ok) setPhase(blueprint, "validation", "completed", "Structure et syntaxe vérifiées.");
    await writeBlueprint(workspace, blueprint);

    return {
        ok: true,
        validation,
        rojo,
        file: output,
        bytes: stats.size,
        output: String(result.output || "").trim().slice(-1500),
        message: `Place construite : ${output} (${(stats.size / 1024).toFixed(1)} Ko). Ouvre-la dans Roblox Studio.`
    };
}

module.exports = { buildProject, findRojo };
