"use strict";

/**
 * Exécution de Blender en arrière-plan pour produire de vrais modèles 3D.
 *
 * Le script Python construit le maillage, applique des textures procédurales,
 * génère LOD0 à LOD3, exporte des GLB et rend une prévisualisation. Blender
 * reste la seule source de géométrie : Roblox Studio ne reçoit que les GLB.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const { ui } = require("../ui-bridge");
const programs = require("../programs");
const { runProcess } = require("../tools/command/runner");
const { readSpec, modelDir, updateLibraryAsset, specPath } = require("./assets");
const { json, writeGenerated } = require("./project");

function template(name) {
    const file = path.join(__dirname, "templates", "blender", name);
    const marker = `${path.sep}app.asar${path.sep}`;
    return file.includes(marker)
        ? file.replace(marker, `${path.sep}app.asar.unpacked${path.sep}`)
        : file;
}

const SCRIPT = template("build_asset.py");
const IMPORT_SCRIPT = template("import_asset.py");

function detectBlender() {
    const info = programs.detectProgram("blender");
    return {
        found: info.found,
        path: info.path,
        label: info.label,
        source: info.source
    };
}

async function readReport(workspace, id) {
    const rel = `${modelDir(id)}/report.json`;
    const raw = await fs.readFile(path.join(workspace, rel), "utf8");
    return { report: JSON.parse(raw), path: rel };
}

/** Lance un script Blender headless sur une spécification. */
async function runScript(workspace, script, spec, outAbs, options = {}) {
    const result = await runProcess({
        file: options.blender.path,
        args: [
            "--background",
            "--factory-startup",
            "--python",
            script,
            "--",
            "--spec", path.join(workspace, specPath(spec.id)),
            "--out", outAbs
        ],
        cwd: workspace,
        timeoutMs: options.timeoutMs || 300000
    });

    if (result.exit_code !== 0 || result.timed_out) {
        return {
            ok: false,
            result,
            message: result.timed_out
                ? "Blender n'a pas terminé dans le délai imparti."
                : `Blender a échoué (code ${result.exit_code}). Lis output pour corriger la spécification.`
        };
    }

    try {
        const { report } = await readReport(workspace, spec.id);
        return { ok: true, result, report };
    } catch (error) {
        return {
            ok: false,
            result,
            message: `Blender a terminé mais report.json est illisible : ${error.message}`
        };
    }
}

/** Enregistre le rapport dans la bibliothèque et dans assets/models/<id>/asset.json. */
async function registerReport(workspace, spec, report, blender) {
    const outRel = modelDir(spec.id);
    const entry = {
        id: spec.id,
        name: spec.name,
        kind: spec.kind,
        description: spec.description,
        tags: spec.tags,
        spec: specPath(spec.id),
        preview: `${outRel}/${report.preview}`,
        files: Object.fromEntries((report.lods || []).map(lod => [`lod${lod.index}`, `${outRel}/${lod.file}`])),
        lods: (report.lods || []).length,
        dimensions: report.dimensions,
        polygons: report.polygons,
        triangles: report.triangles,
        textures: (report.textures || []).map(texture => `${outRel}/${texture}`),
        builtAt: new Date().toISOString(),
        blender: { version: report.blender, file: blender.path }
    };
    if (spec.source) entry.source = spec.source;
    if (report.imported) entry.imported = true;

    await updateLibraryAsset(workspace, entry);
    await writeGenerated(workspace, `${outRel}/asset.json`, json(entry));
    return entry;
}

function blocked(blender, message) {
    return { ok: false, blender, message };
}

/**
 * Lance Blender sur une spécification de primitives. Retourne le rapport, les
 * chemins des LOD et la prévisualisation, et met à jour assets/library.json.
 */
async function buildAsset(workspace, id, options = {}) {
    const blender = detectBlender();
    if (!blender.found) {
        return blocked(
            blender,
            "Blender est introuvable. Installe Blender ou choisis son exécutable dans les réglages, " +
            "puis relance roblox_asset. Aucune géométrie ne sera fabriquée dans Roblox Studio."
        );
    }

    const spec = await readSpec(workspace, id);
    if (spec.source) {
        return blocked(
            blender,
            `« ${spec.name} » est un modèle importé : relance action:import (path, id) pour reconstruire ses LOD.`
        );
    }

    if (options.confirm !== false && !(await ui.confirm(
        `Construire « ${spec.name} » dans Blender (LOD0–LOD3, textures, aperçu) ?`
    ))) {
        return { ok: false, denied: true, message: "Construction refusée par l'utilisateur." };
    }

    const outRel = modelDir(spec.id);
    const outAbs = path.join(workspace, outRel);
    await fs.mkdir(outAbs, { recursive: true });

    const outcome = await runScript(workspace, SCRIPT, spec, outAbs, { ...options, blender });
    if (!outcome.ok) {
        return {
            ok: false,
            blender,
            output: String(outcome.result?.output || "").trim().slice(-4000),
            message: outcome.message
        };
    }

    const entry = await registerReport(workspace, spec, outcome.report, blender);
    return {
        ok: true,
        blender,
        asset: entry,
        report: outcome.report,
        output: String(outcome.result.output || "").trim().slice(-1500),
        message:
            `« ${spec.name} » exporté : ${entry.lods} LOD, ${entry.triangles?.lod0 ?? "?"} triangles (LOD0). ` +
            `Aperçu : ${entry.preview}. Examine l'aperçu avant d'insérer le modèle dans Studio.`
    };
}

/**
 * Importe un fichier 3D existant (GLB, glTF, FBX, OBJ, STL ou BLEND) et produit
 * les LOD0–LOD3, l'aperçu et le rapport. Le fichier source reste intact.
 */
async function importAsset(workspace, id, options = {}) {
    const blender = detectBlender();
    if (!blender.found) {
        return blocked(
            blender,
            "Blender est introuvable. Installe Blender ou choisis son exécutable dans les réglages, " +
            "puis relance roblox_asset. Aucune géométrie ne sera fabriquée dans Roblox Studio."
        );
    }

    const spec = await readSpec(workspace, id);
    if (!spec.source) {
        return blocked(blender, `« ${spec.name} » n'a pas de fichier source : utilise action:import avec path.`);
    }

    const sourceAbs = path.join(workspace, spec.source);
    if (!(await fs.stat(sourceAbs).catch(() => null))) {
        return blocked(blender, `Fichier source absent : ${spec.source}. Relance action:import avec le chemin du modèle.`);
    }

    if (options.confirm !== false && !(await ui.confirm(
        `Importer « ${spec.name} » dans Blender (LOD0–LOD3, aperçu) ?`
    ))) {
        return { ok: false, denied: true, message: "Import refusé par l'utilisateur." };
    }

    const outRel = modelDir(spec.id);
    const outAbs = path.join(workspace, outRel);
    await fs.mkdir(outAbs, { recursive: true });

    const outcome = await runScript(workspace, IMPORT_SCRIPT, spec, outAbs, { ...options, blender });
    if (!outcome.ok) {
        return {
            ok: false,
            blender,
            output: String(outcome.result?.output || "").trim().slice(-4000),
            message: outcome.message
        };
    }

    const entry = await registerReport(workspace, spec, outcome.report, blender);
    return {
        ok: true,
        blender,
        asset: entry,
        report: outcome.report,
        output: String(outcome.result.output || "").trim().slice(-1500),
        message:
            `« ${spec.name} » importé depuis ${spec.source} : ${entry.lods} LOD, ` +
            `${entry.triangles?.lod0 ?? "?"} triangles (LOD0). Aperçu : ${entry.preview}. ` +
            "Examine l'aperçu ; si l'échelle est fausse, relance action:import avec height ou scale."
    };
}

module.exports = {
    SCRIPT,
    IMPORT_SCRIPT,
    template,
    detectBlender,
    buildAsset,
    importAsset,
    readReport
};
