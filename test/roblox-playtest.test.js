"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseStudioLog } = require("../src/tools/roblox-playtest");

test("parseStudioLog ignore le bruit Windows de démarrage de Studio", () => {
    const log = [
        "2026-10-31T02:53:30.354Z,0.354281,82e4,6,Info [FLog::WndProcessCheck] waitForNewPlayerProcess new waiting for mutex result is 0X000000, ERROR The operation completed successfully.",
        "2026-10-31T02:54:54.719Z,0.719698,7b48,6,Error [FLog::Error] Redundant Flag ID: AnimationGraphStateMachine",
        "2026-10-31T02:54:54.719Z,0.719698,7b48,6,Error [FLog::Graphics] Potential graphics modes: 1",
        "2026-10-31T02:54:54.719Z,0.719698,7b48,6,Error [FLog::Network] HTTP Request user-heartbeats-api/action-report failed: Place does not exist.",
        "2026-10-31T02:54:54.719Z,0.719698,7b48,6,Error [FLog::Debugger] DAPClient: Response was an error: Failed to send message to server.",
        "2026-10-31T02:53:31.000Z,0.1,82e4,6,Info [FLog::Output] Chargement terminé."
    ].join("\n");
    assert.deepEqual(parseStudioLog(log), { errors: [], warnings: [] });
});

test("parseStudioLog conserve les vraies erreurs et avertissements Luau", () => {
    const log = [
        "ServerScriptService.Server.Main:12: attempt to index nil with 'Value'",
        "stack traceback:",
        "ServerScriptService.Server.Main:12: in function 'onPlayerAdded'",
        "Warning: quelque chose à vérifier",
        "ERREUR: sauvegarde impossible"
    ].join("\n");
    const parsed = parseStudioLog(log);
    assert.equal(parsed.errors.length, 3);
    assert.match(parsed.errors[0], /attempt to index nil/);
    assert.equal(parsed.warnings.length, 1);
});
