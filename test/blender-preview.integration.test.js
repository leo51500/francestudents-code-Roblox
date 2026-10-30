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
