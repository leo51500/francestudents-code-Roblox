#!/usr/bin/env node
"use strict";
// Génère l'icône de l'application (hexagone avec « R » en creux) à partir de la source
// vectorielle desktop/renderer/assets/francestudent-logo.svg, puis met à jour :
//   - desktop/renderer/assets/francestudent-logo.png (1024x1024)
//   - desktop/icon.png (1024x1024, icône de fenêtre et build Windows)
// Le SVG de l'interface est la source : modifier ce fichier, puis relancer le script.
// Lancer : node scripts/make-logo.js

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SIZE = 1024;
const SOURCE_SVG = path.join(ROOT, "desktop", "renderer", "assets", "francestudent-logo.svg");

function readSourceSvg() {
    if (!fs.existsSync(SOURCE_SVG)) throw new Error("Source absente : " + path.relative(ROOT, SOURCE_SVG));
    const raw = fs.readFileSync(SOURCE_SVG, "utf8");
    const match = raw.match(/<svg[\s\S]*<\/svg>/);
    if (!match) throw new Error("SVG source invalide : " + path.relative(ROOT, SOURCE_SVG));
    return match[0];
}

/* Le logo d'interface reprend tel quel l'image source du contributeur. */
function logoSvg() {
    return readSourceSvg();
}

/* L'icône Windows conserve le fond bleu pour rester lisible en petit sur les tuiles. */
function iconSvg() {
    return readSourceSvg()
        .replace(/<linearGradient id="hex"[\s\S]*?<\/linearGradient>/, '<linearGradient id="hex" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#2450de"/><stop offset="0.55" stop-color="#1236c4"/><stop offset="1" stop-color="#0a2591"/></linearGradient>')
        .replace(/<linearGradient id="spark"[\s\S]*?<\/linearGradient>/, '<linearGradient id="spark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2450de"/><stop offset="1" stop-color="#0a2591"/></linearGradient>');
}

function write(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    console.log("[logo] " + path.relative(ROOT, file));
}

async function renderPng(sharp, svg, size) {
    return sharp(Buffer.from(svg), { density: 384 })
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toBuffer();
}

async function main() {
    const { default: sharp } = await import("sharp");
    write(path.join(ROOT, "desktop", "icon.png"), await renderPng(sharp, iconSvg(), SIZE));
    write(path.join(ROOT, "desktop", "renderer", "assets", "francestudent-logo.png"), await renderPng(sharp, logoSvg(), SIZE));
}

if (require.main === module) {
    main().catch((error) => {
        console.error("[logo] " + error.message);
        process.exitCode = 1;
    });
}

module.exports = { iconSvg, logoSvg, SIZE };
