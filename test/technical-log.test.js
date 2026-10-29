"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTechnicalLog, describe, MAX_ENTRIES } = require("../desktop/technical-log");

test("le journal horodate les erreurs et reconnaît les codes HTTP et réseau", () => {
    const log = createTechnicalLog({ now: () => Date.parse("2026-01-02T03:04:05.000Z") });
    const entry = log.push({ type: "error", source: "service", text: "Erreur du flux API : HTTP 429 Too Many Requests\nréessaie" });
    assert.equal(entry.at, "2026-01-02T03:04:05.000Z");
    assert.equal(entry.type, "error");
    assert.equal(entry.status, 429);
    assert.equal(entry.message.includes("\n"), false);
    assert.match(entry.message, /réessaie$/);
    assert.equal(log.push({ type: "error", source: "réseau", text: "fetch failed ETIMEDOUT" }).errorCode, "ETIMEDOUT");
    assert.equal(log.count(), 2);
});

test("les messages vides sont ignorés et les types inconnus rangés en information", () => {
    const log = createTechnicalLog();
    assert.equal(log.push({ type: "error", text: "   " }), null);
    assert.equal(log.count(), 0);
    assert.equal(log.push({ type: "bruit", text: "info utile" }).type, "info");
});

test("le journal reste borné et se vide sur demande", () => {
    const log = createTechnicalLog({ max: 5 });
    for (let i = 0; i < 12; i++) log.push({ type: "warn", text: `message ${i}` });
    assert.equal(log.count(), 5);
    assert.equal(log.list().at(-1).message, "message 11");
    log.clear();
    assert.equal(log.count(), 0);
    assert.ok(MAX_ENTRIES >= 100);
});

test("describe ne conserve ni jeton ni texte arbitraire au-delà de la limite", () => {
    const long = "x".repeat(4000);
    const info = describe(long);
    assert.equal(info.status, null);
    assert.equal(info.errorCode, null);
});
