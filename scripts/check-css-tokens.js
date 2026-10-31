#!/usr/bin/env node
"use strict";

/**
 * Vérifie que les feuilles qui partagent le thème Onyx ne divergent pas.
 *
 * Les tokens sont volontairement répétés dans plusieurs fichiers pour rester
 * lisibles sans build CSS. Ce contrôle empêche une ancienne palette de revenir
 * silencieusement dans une feuille chargée plus tard.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "desktop", "renderer");
const FILES = ["styles.css", "theme.css", "workbench.css", "controls.css"];
const TOKENS = [
    "--bg",
    "--bg-side",
    "--bg-panel",
    "--bg-input",
    "--bg-hover",
    "--bg-active",
    "--border",
    "--border-strong",
    "--fg",
    "--fg-strong",
    "--fg-dim",
    "--fg-faint",
    "--accent",
    "--accent-hover",
    "--accent-soft",
    "--accent-ink",
    "--link",
    "--danger",
    "--warn",
    "--ok",
    "--error",
    "--titlebar",
    "--radius"
];
const FORBIDDEN = ["#007acc", "#0078d4", "#5b8cff", "#3979dc"];

function rootTokens(text) {
    const found = new Map();
    const blocks = text.matchAll(/:root\s*\{([^}]*)\}/g);
    for (const block of blocks) {
        for (const match of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
            found.set(match[1], match[2].trim().replace(/\s+/g, " "));
        }
    }
    return found;
}

const byToken = new Map();
const problems = [];

for (const file of FILES) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const color of FORBIDDEN) {
        if (text.toLowerCase().includes(color)) problems.push(`${file} réintroduit la couleur ${color}.`);
    }
    const tokens = rootTokens(text);
    for (const token of TOKENS) {
        if (!tokens.has(token)) continue;
        const value = tokens.get(token);
        if (!byToken.has(token)) byToken.set(token, new Map());
        byToken.get(token).set(file, value);
    }
}

for (const [token, values] of byToken) {
    if (values.size < 2) continue;
    const distinct = new Set(values.values());
    if (distinct.size > 1) {
        const detail = [...values].map(([file, value]) => `${file}=${value}`).join(", ");
        problems.push(`${token} diverge : ${detail}.`);
    }
}

if (problems.length) {
    console.error("Tokens CSS incohérents :");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
} else {
    console.log("Tokens CSS cohérents (thème Onyx).");
}
