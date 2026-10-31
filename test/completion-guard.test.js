"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createCompletionGuard } = require("../src/agent/completion-guard");

function luauWrite(guard, path = "src/server/Main.server.luau") {
    guard.record({ tool: "write_file", args: { path }, ok: true, result: {} });
}

function cleanCheck(guard) {
    guard.record({ tool: "roblox_check", args: {}, ok: true, result: { clean: true, build: { status: "ok" } } });
}

test("une écriture Luau sans validation bloque la conclusion terminée", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    luauWrite(guard);

    const verdict = guard.evaluateFinal({ completed: true, message: "Le jeu est prêt." });
    assert.equal(verdict.force, true);
    assert.match(verdict.steering, /VÉRIFICATION BLOQUANTE/);
    assert.match(verdict.steering, /roblox_check/);
});

test("roblox_check postérieur à la modification autorise la conclusion et ajoute la checklist", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    luauWrite(guard);
    cleanCheck(guard);

    const verdict = guard.evaluateFinal({ completed: true, message: "Le jeu est prêt." });
    assert.equal(verdict.force, false);
    assert.equal(verdict.completed, true);
    assert.match(verdict.checklist, /CONTRÔLE DE FIN DE TÂCHE/);
    assert.match(verdict.checklist, /Validation : roblox_check clean/);
    assert.match(verdict.checklist, /Reste à vérifier/);
});

test("une nouvelle écriture après validation rend la vérification obsolète", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    luauWrite(guard);
    cleanCheck(guard);
    luauWrite(guard, "src/client/Hud.client.luau");

    const verdict = guard.evaluateFinal({ completed: true, message: "Fini." });
    assert.equal(verdict.force, true);
    assert.match(verdict.steering, /antérieure|Aucune vérification/);
});

test("une validation en échec force completed:false avec une checklist explicite", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    luauWrite(guard);
    guard.record({ tool: "roblox_check", args: {}, ok: true, result: { clean: false, errors: 2, build: { status: "failed" } } });

    const verdict = guard.evaluateFinal({ completed: true, message: "Tout fonctionne." });
    assert.equal(verdict.force, false);
    assert.equal(verdict.completed, false);
    assert.match(verdict.message, /2 erreur/);
    assert.match(verdict.checklist, /build Rojo/);
    assert.match(verdict.checklist, /corriger puis relancer roblox_check/);
});

test("un test réussi antérieur à une modification est relancé avant de conclure", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    luauWrite(guard);
    cleanCheck(guard);
    guard.record({ tool: "roblox_playtest", args: {}, ok: true, result: { status: "ok" } });

    luauWrite(guard, "src/client/Hud.client.luau");
    cleanCheck(guard);

    const verdict = guard.evaluateFinal({ completed: true, message: "Fini." });
    assert.equal(verdict.force, true);
    assert.match(verdict.steering, /TEST BLOQUANT/);

    guard.record({ tool: "roblox_playtest", args: {}, ok: true, result: { status: "ok" } });
    const retested = guard.evaluateFinal({ completed: true, message: "Fini." });
    assert.equal(retested.force, false);
    assert.equal(retested.completed, true);
    assert.match(retested.checklist, /Test d'exécution : roblox_playtest OK/);
});

test("un test en échec sur la version actuelle interdit une conclusion terminée", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    luauWrite(guard);
    cleanCheck(guard);
    guard.record({ tool: "roblox_playtest", args: {}, ok: false, result: { status: "failed" } });

    const verdict = guard.evaluateFinal({ completed: true, message: "Fini." });
    assert.equal(verdict.completed, false);
    assert.match(verdict.message, /dernier test d'exécution/i);
    assert.match(verdict.checklist, /corriger l'échec du test/);
});

test("une affirmation de test Studio sans résultat est refusée", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    luauWrite(guard);
    cleanCheck(guard);

    const verdict = guard.evaluateFinal({ completed: true, message: "J'ai testé dans Roblox Studio, tout fonctionne." });
    assert.equal(verdict.completed, false);
    assert.match(verdict.message, /aucun roblox_playtest réussi/i);
});

test("une affirmation de build sans build Rojo réussi est refusée", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    luauWrite(guard);
    guard.record({ tool: "roblox_check", args: {}, ok: true, result: { clean: true, build: { status: "failed" } } });

    const verdict = guard.evaluateFinal({ completed: true, message: "Le build est réussi." });
    assert.equal(verdict.completed, false);
    assert.match(verdict.message, /build réussi/i);
});

test("une affirmation de build est acceptée quand roblox_check a réellement construit", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    luauWrite(guard);
    cleanCheck(guard);

    const verdict = guard.evaluateFinal({ completed: true, message: "Le build est réussi." });
    assert.equal(verdict.completed, true);
});

test("roblox_game déclenche la validation et sa validation intégrée peut conclure", () => {
    const guard = createCompletionGuard({ task: "Crée un obby Roblox" });
    guard.record({
        tool: "roblox_game",
        args: { action: "scaffold" },
        ok: true,
        result: { files: ["src/server/Main.server.luau", "src/client/Hud.client.luau"], validation: { clean: true } }
    });

    const verdict = guard.evaluateFinal({ completed: true, message: "Scaffold créé." });
    assert.equal(verdict.force, false);
    assert.equal(verdict.completed, true);
    assert.match(verdict.checklist, /Validation : roblox_game clean/);
});

test("une session en lecture seule ne déclenche aucun blocage", () => {
    const guard = createCompletionGuard({ task: "Explique le projet Roblox", readOnly: true });
    const verdict = guard.evaluateFinal({ completed: true, message: "Voici l'explication." });
    assert.equal(verdict.force, false);
    assert.equal(verdict.completed, true);
    assert.equal(verdict.checklist, "");
});
