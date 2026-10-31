"use strict";

/**
 * Test d'intégration Blender : le rendu de contrôle à quatre angles est réellement
 * produit et vérifié, au lieu de supposer que l'assembleur fonctionne.
 *
 * Sans Blender installé, le test est ignoré (skip) : il ne bloque pas une machine
 * qui n'a que la partie code. Blender est cherché par `detectBlender`, comme le fait
 * l'application.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { detectBlender } = require("../src/tools/blender");
const sandbox = require("../src/tools/sandbox");
const { decode, regionContrast } = require("./helpers/png");

/** Proportion de pixels chauds (bois : rouge nettement supérieur au bleu). */
function countTinted(png) {
    const { channels, data } = png;
    let warm = 0;
    let total = 0;
    for (let i = 0; i + channels <= data.length; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        total++;
        if (r > 70 && r - b > 40 && g > b) warm++;
    }
    return { warm: total ? warm / total : 0, total };
}

const ROOT = path.join(__dirname, "..");
const TEMPLATE = path.join(ROOT, "src", "blender", "templates", "prop_palette.py");

test("rendu Blender silhouette : modèle noir sur fond clair, sans couleur", { timeout: 240000, concurrency: false }, async (t) => {
    const blender = await detectBlender(ROOT);
    if (!blender.found) {
        t.skip(`Blender introuvable : silhouette non vérifiée (${blender.message})`);
        return;
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-silhouette-"));
    const render = path.join(dir, "forme.png");
    const harness = path.join(dir, "silhouette.py");
    fs.writeFileSync(harness, [
        "import os, sys",
        "sys.path.insert(0, os.path.abspath('src/blender'))",
        "import blender_common as bc",
        "bc.reset_scene()",
        "bc.box('SilhouetteTest', 2.0, 3.0, 1.0, (0, 0, 0))",
        "import bpy",
        "bpy.context.view_layer.update()",
        "argv = sys.argv[sys.argv.index('--') + 1:]",
        "bc.render_preview(argv[0], resolution=512, mode='silhouette')",
        "print('SILHOUETTE_OK')"
    ].join("\n"));

    try {
        const result = await sandbox.runProcess(blender.path, [
            "--background", "--factory-startup", "--python", harness, "--", render
        ], { timeoutMs: 220000, cwd: ROOT });

        const output = String(result.output || "");
        assert.equal(result.exit_code, 0, `Blender a échoué :\n${output.slice(-3000)}`);
        assert.doesNotMatch(output, /ERREUR:|Traceback \(most recent call last\)/, output.slice(-3000));
        assert.ok(fs.existsSync(render), `Aucune image silhouette produite : ${render}`);

        const png = decode(fs.readFileSync(render));
        assert.equal(png.width, 512);
        assert.equal(png.height, 512);

        let dark = 0;
        let light = 0;
        let colored = 0;
        let total = 0;
        for (let i = 0; i + 3 <= png.data.length; i += png.channels) {
            const r = png.data[i];
            const g = png.data[i + 1];
            const b = png.data[i + 2];
            total++;
            if (r < 60 && g < 60 && b < 60) dark++;
            // Fond clair après gestion de couleur Blender (0,97 sort autour de 190).
            if (r > 170 && g > 170 && b > 170) light++;
            if (Math.max(r, g, b) - Math.min(r, g, b) > 24) colored++;
        }

        assert.ok(dark / total > 0.02, `le modèle noir est absent (${(dark / total * 100).toFixed(1)} % de pixels sombres)`);
        assert.ok(light / total > 0.5, `le fond clair est absent (${(light / total * 100).toFixed(1)} % de pixels clairs)`);
        assert.ok(colored / total < 0.02, `la couleur parasite le mode silhouette (${(colored / total * 100).toFixed(1)} %)`);
    } finally {
        if (process.env.FRST_KEEP_PREVIEW !== "1") fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("rendu Blender réel : quatre angles distincts dans une image 1024 px", { timeout: 240000, concurrency: false }, async (t) => {
    const blender = await detectBlender(ROOT);
    if (!blender.found) {
        t.skip(`Blender introuvable : rendu non vérifié (${blender.message})`);
        return;
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-preview-"));
    const render = path.join(dir, "caisse.png");
    try {
        const result = await sandbox.runProcess(blender.path, [
            "--background", "--factory-startup", "--python", TEMPLATE, "--",
            "--name", "Caisse", "--output", dir, "--render", render, "--no-export"
        ], { timeoutMs: 220000, cwd: ROOT });

        // Blender peut finir avec un code 0 alors que le script Python a levé une exception
        // (il l'écrit sur la sortie standard) : on exige aussi l'absence d'ERREUR.
        const output = String(result.output || "");
        assert.equal(result.exit_code, 0, `Blender a échoué :\n${output.slice(-3000)}`);
        assert.doesNotMatch(output, /ERREUR:|Traceback \(most recent call last\)/, `Le script Blender a signalé une erreur :\n${output.slice(-3000)}`);
        assert.ok(fs.existsSync(render), `Aucune image produite : ${render}`);

        const png = decode(fs.readFileSync(render));
        assert.equal(png.width, 1024, "largeur de l'image assemblée");
        assert.equal(png.height, 1024, "hauteur de l'image assemblée");

        // Les vues individuelles existent, nommées, pour un diagnostic plus fin.
        const views = path.join(path.dirname(render), `${path.basename(render, ".png")}_vues`);
        for (const label of ["face", "trois-quarts", "cote", "dessus"]) {
            assert.ok(fs.existsSync(path.join(views, `${label}.png`)), `vue manquante : ${label}`);
        }

        // Chaque quart doit contenir le modèle (contraste net), et non un fond uni.
        // Un assemblage décalé ou à l'envers laisse au moins un quart vide.
        const half = 512;
        const quarters = {
            "haut-gauche": [0, 0, half, half],
            "haut-droit": [half, 0, 1024, half],
            "bas-gauche": [0, half, half, 1024],
            "bas-droit": [half, half, 1024, 1024]
        };
        for (const [name, [x0, y0, x1, y1]] of Object.entries(quarters)) {
            const contrast = regionContrast(png, x0, y0, x1, y1);
            assert.ok(contrast > 12, `quart ${name} vide ou uniforme (contraste ${contrast.toFixed(1)})`);
        }

        // La palette doit apparaître : du bois chaud (rouge > bleu) et du métal/pierre
        // neutre. Tout gris = matériaux ignorés (Workbench) ; diagonales de couleur =
        // réindexation des faces faussée après triangulation.
        const tinted = countTinted(png);
        assert.ok(tinted.warm > 0.04, `aucune zone boisée visible (${(tinted.warm * 100).toFixed(1)} % de pixels chauds)`);
        assert.ok(tinted.warm < 0.9, `image uniformément colorée : les pièces ne sont plus distinctes (${(tinted.warm * 100).toFixed(1)} %)`);
    } finally {
        if (process.env.FRST_KEEP_PREVIEW !== "1") fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("comparaison de référence : score mesuré, proportions prises en compte", { timeout: 120000, concurrency: false }, async (t) => {
    const blender = await detectBlender(ROOT);
    if (!blender.found) {
        t.skip(`Blender introuvable : comparaison non vérifiée (${blender.message})`);
        return;
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-compare-"));
    const harness = path.join(dir, "compare.py");
    fs.writeFileSync(harness, [
        "import json, os, sys",
        "sys.path.insert(0, os.path.abspath('src/blender'))",
        "import bpy",
        "import blender_common as bc",
        "out = sys.argv[sys.argv.index('--') + 1]",
        "def save(name, rect):",
        "    img = bpy.data.images.new('TMP', width=96, height=96, alpha=False)",
        "    px = [1.0, 1.0, 1.0, 1.0] * (96 * 96)",
        "    x0, y0, x1, y1 = rect",
        "    for y in range(y0, y1):",
        "        for x in range(x0, x1):",
        "            i = (y * 96 + x) * 4",
        "            px[i] = px[i + 1] = px[i + 2] = 0.0",
        "    img.pixels.foreach_set(px)",
        "    img.filepath_raw = os.path.join(out, name)",
        "    img.file_format = 'PNG'",
        "    img.save()",
        "    bpy.data.images.remove(img)",
        "save('tall.png', (36, 12, 60, 84))",
        "save('wide.png', (12, 36, 84, 60))",
        "same = bc.compare_render(os.path.join(out, 'tall.png'), os.path.join(out, 'tall.png'), angle='face')",
        "diff = bc.compare_render(os.path.join(out, 'wide.png'), os.path.join(out, 'tall.png'), angle='face')",
        "print('SAME ' + json.dumps(same, ensure_ascii=False))",
        "print('DIFF ' + json.dumps(diff, ensure_ascii=False))"
    ].join("\n"));

    try {
        const result = await sandbox.runProcess(blender.path, [
            "--background", "--factory-startup", "--python", harness, "--", dir
        ], { timeoutMs: 110000, cwd: ROOT });

        const output = String(result.output || "");
        assert.equal(result.exit_code, 0, `Blender a échoué :\n${output.slice(-3000)}`);
        assert.doesNotMatch(output, /ERREUR:|Traceback \(most recent call last\)/, output.slice(-3000));

        const read = marker => {
            const line = new RegExp(`^${marker} (.+)$`, "m").exec(output);
            assert.ok(line, `marqueur ${marker} absent de la sortie Blender`);
            return JSON.parse(line[1]);
        };

        const same = read("SAME");
        assert.equal(same.verdict, "très proche", "une image comparée à elle-même est identique");
        assert.ok(same.iou >= 0.99, `IoU attendu proche de 1, obtenu ${same.iou}`);
        assert.ok(same.ssim >= 0.99, `SSIM attendu proche de 1, obtenu ${same.ssim}`);

        const diff = read("DIFF");
        assert.equal(diff.verdict, "différent", "un rectangle large ne ressemble pas à un rectangle haut");
        assert.ok(diff.iou < 0.8, `IoU attendu bas, obtenu ${diff.iou}`);
        assert.match(diff.reason, /proportions/, "la différence de proportions est expliquée");
    } finally {
        if (process.env.FRST_KEEP_PREVIEW !== "1") fs.rmSync(dir, { recursive: true, force: true });
    }
});
