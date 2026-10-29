"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const renderer = file => fs.readFileSync(path.join(__dirname, "..", "desktop", "renderer", file), "utf8");

test("le zoom est exposé par le pont et persisté dans les réglages", () => {
    const preload = fs.readFileSync(path.join(__dirname, "..", "desktop", "preload.js"), "utf8");
    const main = fs.readFileSync(path.join(__dirname, "..", "desktop", "main.js"), "utf8");
    assert.match(preload, /uiZoom:\s*\(action = "get", value\) => call\("uiZoom"/);
    assert.match(main, /handle\("uiZoom"/);
    assert.match(main, /save\(\{ desktopZoom: uiZoom \}\)/);
    assert.match(main, /settings"\)\.load\(\)\?\.desktopZoom/);
    assert.match(main, /setZoomFactor\(uiZoom\)/);
});

test("le zoom fonctionne partout : molette avec Ctrl, raccourcis et pastille", () => {
    const zoom = renderer("src/59-zoom.js");
    assert.match(zoom, /event\.ctrlKey \|\| event\.metaKey/);
    assert.match(zoom, /key === "=" \|\| key === "\+"/);
    assert.match(zoom, /key === "0"/);
    assert.match(zoom, /id = "st-zoom"/);
    // Le menu Affichage et les raccourcis partagés le proposent aussi.
    assert.match(renderer("src/13-editor-tools.js"), /\["Zoom avant", "Ctrl\+="/);
    assert.match(renderer("src/13-editor-tools.js"), /\["Zoom 100 %", "Ctrl\+0"/);
});

test("le panneau Logs existe, se rafraîchit et se vide sans doublon de badge", () => {
    const html = renderer("index.html");
    assert.match(html, /id="tab-logs"/);
    assert.match(html, /id="logs-list"/);
    assert.match(html, /data-log-filter="error"/);
    assert.match(html, /class="tab-count log-error-count" hidden/);
    const logs = renderer("src/60-logs.js");
    // Lecture seule depuis l'interface : aucune écriture locale ne part au processus principal.
    assert.match(logs, /api\.technicalLog\("list"\)/);
    assert.doesNotMatch(logs, /api\.technicalLog\("add"/);
    assert.match(logs, /querySelector\("\.log-error-count"\)/);
    assert.match(logs, /unhandledrejection/);
    assert.match(renderer("src/14-panel.js"), /\$\("logs"\)\?\.classList\.toggle\("hidden", name !== "logs"\)/);
});

test("les erreurs du service rejoignent le journal depuis tous les chemins", () => {
    assert.match(renderer("src/03-transcript.js"), /recordLog\(\{ type: "error", source: "agent"/);
    assert.match(renderer("src/03-transcript.js"), /recordLog\(\{ type: "error", source: "outil"/);
    assert.match(renderer("src/09-composer.js"), /recordLog\(\{ type: "error", source: "envoi"/);
    assert.match(renderer("src/44-api-notices.js"), /source:info\.kind==="locked"/);
});

test("les animations respectent le mouvement réduit et animent la réflexion", () => {
    const css = renderer("motion-ui.css");
    assert.match(renderer("index.html"), /href="motion-ui\.css"/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /@keyframes frst-thinking-sweep/);
    assert.match(css, /@keyframes frst-thinking-text/);
    assert.match(css, /\.chat-thinking/);
    assert.match(css, /\.entry\.is-replayed \{\s*animation: none;/);
    const transcript = renderer("src/03-transcript.js");
    assert.match(transcript, /function showThinkingIndicator/);
    assert.match(transcript, /function hideThinkingIndicator/);
    assert.match(transcript, /classList\?\.add\("is-live"\)/);
    // Le rythme des formules ne tourne que pendant une réflexion.
    assert.match(transcript, /function startThinkingRhythm/);
    assert.match(transcript, /stopThinkingRhythm\(\);/);
});
