"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { repeatLimitFor, repeatSteering, stuckSummary, lockedFileHint } = require("../src/agent/stuck-guard");

test("les vérifications peuvent être relancées plus souvent qu'une lecture identique", () => {
    assert.equal(repeatLimitFor({ name: "read_file", args: { path: "a.js" } }), 3);
    assert.equal(repeatLimitFor({ name: "run_command", args: { command: "npm test" } }), 6);
    assert.equal(repeatLimitFor({ name: "roblox_check", args: {} }), 6);
    assert.equal(repeatLimitFor({ calls: [{ name: "read_file", args: {} }] }), 3);
});

test("la consigne de boucle nomme l'action et impose une autre démarche", () => {
    const text = repeatSteering({ name: "read_file", args: { path: "src/main.js" } }, 3, 1);
    assert.match(text, /read_file \(src\/main\.js\)/);
    assert.match(text, /BOUCLE D'AGENT/);
    assert.match(text, /search_files/);
    assert.match(text, /ask_user/);
});

test("un arrêt de boucle résume les dernières étapes au lieu d'un abandon sec", () => {
    const message = stuckSummary([
        { tool: "read_file", args: { path: "a.js" }, ok: true },
        { tool: "list_directory", args: { path: "b" }, ok: false }
    ]);
    assert.match(message, /read_file a\.js : exécuté/);
    assert.match(message, /list_directory b : échec/);
    assert.match(message, /conservé/);
    assert.doesNotMatch(message, /Précise ta demande/);
});

test("un fichier verrouillé produit une consigne de sortie, pas une relance", () => {
    const text = lockedFileHint(
        { name: "write_file", args: { path: "src/Server/GameStore.server.luau" } },
        { error: "EBUSY: resource busy or locked, open 'src/Server/GameStore.server.luau'" }
    );
    assert.match(text, /FICHIER VERROUILLÉ/);
    assert.match(text, /nouveau/);
    assert.match(text, /Ne rejoue pas/);
    assert.match(text, /Ne prétends jamais que le fichier a été enregistré/);
});

test("la phrase Studio « autre instance » est reconnue comme un verrou de fichier", () => {
    const text = lockedFileHint(
        { name: "write_file", args: { path: "Place.rbxl" } },
        { error: "Ce fichier est actuellement utilisé par une autre instance du Studio ou est en lecture seule." }
    );
    assert.ok(text);
    assert.match(text, /Place\.rbxl/);
});

test("un échec sans rapport avec un verrou ne déclenche aucune consigne", () => {
    assert.equal(lockedFileHint({ name: "run_command", args: { command: "npm test" } }, { error: "code 1" }), null);
    assert.equal(lockedFileHint({ name: "write_file", args: { path: "a.js" } }, { error: "Contenu invalide." }), null);
});
